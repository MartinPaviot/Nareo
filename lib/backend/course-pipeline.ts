import path from "path";
import { randomUUID } from "crypto";
import { getServiceSupabase } from "@/lib/supabase";
import { parsePDF, parsePDFWithPages } from "@/lib/pdf-parser";
import { parseDocx } from "@/lib/document-parser";
import { parseImage } from "@/lib/image-parser";
import {
  extractTextFromImage,
  generateChapterStructureFromCourseText,
} from "@/lib/openai-vision";
import { validateExtractedText, truncateTextIntelligently } from "@/lib/openai-fallback";
import { logEvent } from "./analytics";
import { detectContentLanguageFromText } from "./language-detection";
import {
  extractChapterText,
  LLM_CONFIG,
  type ChapterBoundary,
} from "@/lib/llm";
// Note: Quiz, Flashcards, and A+ Notes are all generated ON-DEMAND by the user
// This allows customization before generation and makes upload much faster

const RAW_BUCKET = "courses_raw";
const MAX_PAGES = 100;
const MAX_IMAGES = 6;
const MIN_TEXT_LENGTH = 500;
const DEFAULT_CONTENT_LANGUAGE = "en";

interface UploadPayload {
  userId: string | null;
  file: File;
  isPublic?: boolean;
  guestSessionId?: string | null;
}

interface ChapterInput {
  id: string;
  title: string;
  summary: string;
  difficulty: "easy" | "medium" | "hard";
  orderIndex: number;
  // Added for better chunking and question generation
  learning_objectives?: string[];
  key_concepts?: string[];
  // Real chapter page positions (from document structure detection)
  _startPage?: number;
  _endPage?: number;
  _hasFormulas?: boolean;
  concepts: Array<{
    id: string;
    title: string;
    description: string;
    importance: number;
    sourceText?: string;
  }>;
}

function logStep(label: string, extra?: Record<string, any>) {
  const msg = `[pipeline] ${label}${extra ? " " + JSON.stringify(extra) : ""}`;
  console.log(msg);
}

function estimatePdfPages(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return Math.max(1, matches?.length ?? 1);
}

function estimateDocxPages(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  return Math.max(1, Math.ceil(words.length / 400));
}

function buildStoragePath(userId: string, courseId: string, filename: string) {
  const ext = path.extname(filename || "").replace(".", "") || "bin";
  return `${userId}/${courseId}.${ext}`;
}

function normalizeContentLanguage(language?: string | null): "en" | "fr" | "de" {
  const lower = (language || "").toLowerCase();
  return lower === "fr" || lower === "de" ? (lower as "fr" | "de") : "en";
}

function toModelLanguageCode(language: string): "EN" | "FR" | "DE" {
  const normalized = normalizeContentLanguage(language);
  return normalized.toUpperCase() as "EN" | "FR" | "DE";
}

export async function queueCourseProcessing({ userId, file, isPublic = false, guestSessionId }: UploadPayload) {
  // Allow guest uploads with guestSessionId
  const effectiveUserId = userId || 'guest';

  const admin = getServiceSupabase();
  const courseId = randomUUID();

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const ext = path.extname(file.name || "").toLowerCase();

  if (![".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) {
    throw new Error("Unsupported file type");
  }

  let pagesCount = 1;
  if (ext === ".pdf") {
    pagesCount = estimatePdfPages(buffer);
  } else if (ext === ".docx" || ext === ".doc") {
    const text = await parseDocx(buffer);
    pagesCount = estimateDocxPages(text);
  }

  if (pagesCount > MAX_PAGES) {
    throw new Error(`Document too long (${pagesCount} pages). Maximum allowed: ${MAX_PAGES}.`);
  }

  if (ext !== ".pdf" && ext !== ".docx" && ext !== ".doc") {
    if (MAX_IMAGES < 1) {
      throw new Error("Image uploads are disabled");
    }
  }

  const storagePath = buildStoragePath(effectiveUserId, courseId, file.name || "upload.bin");

  const { error: uploadError } = await admin.storage
    .from(RAW_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { error: courseInsertError } = await admin.from("courses").insert({
    id: courseId,
    user_id: userId, // null for guests
    title: file.name || "Cours importe",
    original_filename: file.name || null,
    storage_bucket: RAW_BUCKET,
    storage_path: storagePath,
    status: "pending",
    pages_count: pagesCount,
    language: "fr",
    content_language: null,
    is_public: isPublic || !userId, // public for guests
    guest_session_id: !userId ? guestSessionId : null, // store guest session ID
  });
  if (courseInsertError) {
    console.error("Course insert failed", courseInsertError);
    throw courseInsertError;
  }

  const { data: job, error: jobInsertError } = await admin
    .from("pipeline_jobs")
    .insert({ course_id: courseId, user_id: userId })
    .select("id")
    .single();
  if (jobInsertError) {
    console.error("Pipeline job insert failed", jobInsertError);
    throw jobInsertError;
  }

  await logEvent("upload_started", { userId: userId ?? undefined, courseId });
  logStep("queued", { courseId, jobId: job?.id, ext, pagesCount });

  // Note: Background processing is now handled by Next.js after() in the upload route
  // setImmediate doesn't work properly in serverless environments like Vercel

  return { courseId, jobId: job?.id };
}

export async function processCourseJob(jobId: string) {
  if (!jobId) return;

  const admin = getServiceSupabase();

  const { data: jobRow, error: jobError } = await admin
    .from("pipeline_jobs")
    .select("*, courses(*)")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError || !jobRow?.courses) {
    throw jobError || new Error("Pipeline job not found");
  }

  const course = jobRow.courses;
  const bucket = course.storage_bucket || RAW_BUCKET;
  const storagePath = course.storage_path;

  await admin
    .from("pipeline_jobs")
    .update({ status: "processing", attempts: (jobRow.attempts ?? 0) + 1, updated_at: new Date().toISOString(), stage: "start" })
    .eq("id", jobId);
  await admin.from("courses").update({ status: "processing" }).eq("id", course.id);

  try {
    logStep("download_start", { courseId: course.id, stage: "download" });
    await admin.from("pipeline_jobs").update({ stage: "download", updated_at: new Date().toISOString() }).eq("id", jobId);

    const download = await admin.storage.from(bucket).download(storagePath);
    if (download.error || !download.data) {
      throw download.error || new Error("Unable to download source file");
    }
    const buffer = Buffer.from(await download.data.arrayBuffer());
    const ext = path.extname(storagePath).toLowerCase();

    logStep("extraction_start", { courseId: course.id, ext });
    await admin.from("pipeline_jobs").update({ stage: "extraction", updated_at: new Date().toISOString() }).eq("id", jobId);

    let extractedText = "";
    let documentPages: string[] = [];
    if (ext === ".pdf") {
      // Use combined function to get both text and pages in a single parse
      // This avoids buffer consumption issues when parsing twice
      const pdfResult = await parsePDFWithPages(buffer);
      extractedText = pdfResult.text;
      documentPages = pdfResult.pages;
    } else if (ext === ".docx" || ext === ".doc") {
      extractedText = await parseDocx(buffer);
      // For non-PDFs, split by page breaks or paragraphs
      documentPages = extractedText.split(/\n\n+/).filter(p => p.trim().length > 0);
    } else {
      const dataUrl = await parseImage(buffer);
      await logEvent("vision_success", { userId: course.user_id, courseId: course.id });
      extractedText = await extractTextFromImage(dataUrl);
      // For images, treat as single page
      documentPages = [extractedText];
    }

    const validation = validateExtractedText(extractedText, MIN_TEXT_LENGTH);
    if (!validation.isValid) {
      await logEvent("vision_failed", { userId: course.user_id, courseId: course.id, payload: { reason: validation.reason } });
      throw new Error(`Insufficient text extracted (${validation.reason})`);
    }

    // === GRAPHICS EXTRACTION (PDF only) ===
    // Extract and analyze pedagogical graphics with Mistral OCR + Claude Vision
    if (ext === ".pdf") {
      try {
        logStep("graphics_extraction_start", { courseId: course.id });
        await admin.from("pipeline_jobs").update({ stage: "graphics_extraction", updated_at: new Date().toISOString() }).eq("id", jobId);

        // Download PDF again to avoid buffer consumption issues
        // (parsePDFWithPages may have consumed the original buffer)
        const download2 = await admin.storage.from(bucket).download(storagePath);
        if (download2.error || !download2.data) {
          throw new Error("Unable to download PDF for graphics extraction");
        }
        const pdfBuffer = Buffer.from(await download2.data.arrayBuffer());

        const { processDocumentGraphics } = await import('./graphics-processor');
        const graphicsResult = await processDocumentGraphics(
          course.id,
          course.user_id,
          pdfBuffer,
          course.original_filename || 'document.pdf'
        );

        logStep("graphics_extraction_complete", {
          courseId: course.id,
          totalImages: graphicsResult.totalImages,
          analyzed: graphicsResult.analyzed,
          stored: graphicsResult.stored,
          errors: graphicsResult.errors
        });

        await logEvent("graphics_extracted", {
          userId: course.user_id,
          courseId: course.id,
          payload: {
            totalImages: graphicsResult.totalImages,
            analyzed: graphicsResult.analyzed,
            stored: graphicsResult.stored
          }
        });
      } catch (graphicsError: any) {
        // Don't fail the whole pipeline if graphics processing fails
        console.error('[pipeline] Graphics processing failed:', graphicsError.message);
        logStep("graphics_extraction_failed", { courseId: course.id, error: graphicsError.message });
        await logEvent("graphics_extraction_failed", {
          userId: course.user_id,
          courseId: course.id,
          payload: { error: graphicsError.message }
        });
        // Continue with the rest of the pipeline
      }
    }

    // Update stage to language_detection
    await admin.from("pipeline_jobs").update({ stage: "language_detection", updated_at: new Date().toISOString() }).eq("id", jobId);

    const cleanText = truncateTextIntelligently(extractedText, LLM_CONFIG.truncation.courseText);
    const detectedLanguage = await detectContentLanguageFromText(cleanText);
    const contentLanguage = normalizeContentLanguage(detectedLanguage.language || course.language || DEFAULT_CONTENT_LANGUAGE);
    const modelLanguage = toModelLanguageCode(contentLanguage);

    logStep("language_detected", {
      courseId: course.id,
      contentLanguage,
      confidence: detectedLanguage.confidence,
      detector: detectedLanguage.detector,
    });
    await logEvent("content_language_detected", {
      userId: course.user_id,
      courseId: course.id,
      payload: {
        contentLanguage,
        detector: detectedLanguage.detector,
        confidence: detectedLanguage.confidence,
      },
    });

    await admin.from("courses").update({
      content_language: contentLanguage,
      language: contentLanguage,
      source_text: extractedText, // Store FULL source text (not truncated) for A+ Note generation
    }).eq("id", course.id);

    // === PHASE 1: Detect chapters using LLM ===
    // LLM provides better chapter detection than algorithmic approach
    // as it understands document structure, TOC, and content organization
    await admin.from("pipeline_jobs").update({ stage: "structuring", updated_at: new Date().toISOString() }).eq("id", jobId);
    logStep("detecting_chapters_llm", { courseId: course.id });

    let chapterStructure: any[];

    chapterStructure = await generateChapterStructureFromCourseText(
      cleanText,
      course.title || course.original_filename || undefined,
      modelLanguage
    );

    logStep("chapters_detected", {
      courseId: course.id,
      chaptersFound: chapterStructure?.length || 0,
    });

    const fallbackTitle = course.title || (contentLanguage === "fr" ? "Chapitre 1" : contentLanguage === "de" ? "Kapitel 1" : "Chapter 1");
    const fallbackSummary = contentLanguage === "fr"
      ? "Synthèse du cours"
      : contentLanguage === "de"
        ? "Kurszusammenfassung"
        : "Course summary";
    const chapters: ChapterInput[] = (chapterStructure && chapterStructure.length > 0
      ? chapterStructure
      : [{ index: 1, title: fallbackTitle, short_summary: fallbackSummary, difficulty: 2 }]
    ).map((ch: any, idx: number) => {
      const difficultyLabel: "easy" | "medium" | "hard" =
        ch.difficulty >= 3 ? "hard" : ch.difficulty === 2 ? "medium" : "easy";
      const conceptId = randomUUID();
      const chapterLabel = contentLanguage === "fr" ? "Chapitre" : contentLanguage === "de" ? "Kapitel" : "Chapter";
      return {
        id: randomUUID(),
        title: ch.title || `${chapterLabel} ${idx + 1}`,
        summary: ch.short_summary || fallbackSummary,
        difficulty: difficultyLabel,
        orderIndex: (ch.index && Number.isFinite(ch.index)) ? ch.index - 1 : idx,
        // Store learning objectives and key concepts for better chunking and question generation
        learning_objectives: ch.learning_objectives || [],
        key_concepts: ch.key_concepts || [],
        // Store real chapter page positions if available (from document structure detection)
        _startPage: ch._startPage,
        _endPage: ch._endPage,
        _hasFormulas: ch._hasFormulas,
        concepts: [
          {
            id: conceptId,
            title: ch.title || `Concept ${idx + 1}`,
            description: ch.short_summary || "",
            importance: ch.difficulty || 1,
            sourceText: ch.short_summary || "",
          },
        ],
      };
    });

    logStep("llm_structuring_done", {
      courseId: course.id,
      chapters: chapters.length,
      mode: "llm_generated",
    });

    // === Chapter text extraction ===
    // If we have real chapter page positions, use them to extract text from pages
    // Otherwise, fall back to intelligent marker-based extraction
    let chapterBoundaries: ChapterBoundary[] = [];

    const hasRealPagePositions = chapters.some(ch => ch._startPage !== undefined);

    if (hasRealPagePositions && documentPages.length > 0) {
      // Use real page positions from document structure detection
      logStep("using_real_chapter_pages", { courseId: course.id });

      chapterBoundaries = chapters.map(ch => {
        // Extract text from the relevant pages (1-indexed to 0-indexed)
        const startIdx = Math.max(0, (ch._startPage || 1) - 1);
        const endIdx = Math.min(documentPages.length, ch._endPage || documentPages.length);
        const chapterPages = documentPages.slice(startIdx, endIdx);
        const fullChapterText = chapterPages.join('\n\n');
        const truncatedText = fullChapterText.substring(0, LLM_CONFIG.truncation.chapterText).trim();

        return {
          index: ch.orderIndex + 1,
          title: ch.title,
          startPosition: startIdx,
          endPosition: endIdx,
          text: truncatedText,
        };
      });
    } else {
      // Fall back to intelligent marker-based extraction
      chapterBoundaries = extractChapterText(
        cleanText,
        chapters.map(ch => ({
          index: ch.orderIndex + 1,
          title: ch.title,
          short_summary: ch.summary,
          key_concepts: ch.key_concepts,  // Pass key_concepts for better text matching
        })),
        { minChunkSize: 500, maxChunkSize: LLM_CONFIG.truncation.chapterText, useMarkerDetection: true }
      );
    }

    logStep("chapter_boundaries_computed", {
      courseId: course.id,
      boundariesCount: chapterBoundaries.length,
      avgLength: Math.round(chapterBoundaries.reduce((sum, b) => sum + b.text.length, 0) / Math.max(1, chapterBoundaries.length)),
      mode: hasRealPagePositions ? "real_page_positions" : "marker_based",
    });

    // === CHAPTER INSERTION (NO QUIZ GENERATION) ===
    // Quiz generation is now ON-DEMAND via /api/courses/[courseId]/quiz/generate
    // This makes upload much faster and allows user customization before generation

    // Update stage to insertion
    await admin.from("pipeline_jobs").update({ stage: "insertion", updated_at: new Date().toISOString() }).eq("id", jobId);

    // Insert chapters with their text (quiz generation is on-demand)
    for (const chapter of chapters) {
      const boundary = chapterBoundaries.find(b => b.index === chapter.orderIndex + 1);
      const chapterText = boundary?.text || extractedText.substring(0, LLM_CONFIG.truncation.chapterText);

      try {
        // Insert chapter with status 'ready' (text extracted, ready for quiz generation)
        // Note: Using 'ready' for DB compatibility - quiz_status on course tracks quiz generation
        const { error: chapterInsertError } = await admin.from("chapters").insert({
          id: chapter.id,
          course_id: course.id,
          user_id: course.user_id,
          order_index: chapter.orderIndex,
          difficulty: chapter.difficulty,
          title: chapter.title,
          summary: chapter.summary,
          importance: Math.min(3, Math.max(1, chapter.orderIndex + 1)),
          source_text: chapterText.substring(0, LLM_CONFIG.truncation.chapterText),
          extracted_text: chapterText.substring(0, LLM_CONFIG.truncation.chapterText),
          status: 'ready', // Chapter text extracted, quiz generation is on-demand
        });
        if (chapterInsertError) {
          console.error("Chapter insert failed", chapterInsertError);
          throw chapterInsertError;
        }

        // Insert concepts
        for (const concept of chapter.concepts) {
          const { error: conceptInsertError } = await admin.from("concepts").insert({
            id: concept.id,
            chapter_id: chapter.id,
            course_id: course.id,
            user_id: course.user_id,
            title: concept.title,
            description: concept.description,
            importance: concept.importance ?? 1,
            source_text: chapterText.substring(0, 2000),
          });
          if (conceptInsertError) {
            console.error("Concept insert failed", conceptInsertError);
            throw conceptInsertError;
          }
        }

        logStep("chapter_inserted", {
          courseId: course.id,
          chapterId: chapter.id,
          chapterIndex: chapter.orderIndex,
          title: chapter.title,
        });

      } catch (chapterError: any) {
        console.error(`Chapter ${chapter.id} insert failed:`, chapterError);
        await admin
          .from("chapters")
          .update({ status: 'failed' })
          .eq("id", chapter.id);
      }
    }

    // Count inserted chapters (regardless of status - if they exist, they were processed)
    const { data: insertedChapters, error: countError } = await admin
      .from("chapters")
      .select("id, status")
      .eq("course_id", course.id);

    const readyChapters = insertedChapters?.filter(ch => ch.status === 'ready') || [];
    const failedChapters = insertedChapters?.filter(ch => ch.status === 'failed') || [];

    logStep("chapter_count_check", {
      courseId: course.id,
      totalInserted: insertedChapters?.length || 0,
      readyCount: readyChapters.length,
      failedCount: failedChapters.length,
      expectedCount: chapters.length,
    });

    // Course is ready if we have at least some chapters inserted (even if not all)
    // This prevents stuck 'processing' state when LLM returns duplicate indices
    const hasChapters = (insertedChapters?.length || 0) > 0;
    const allChaptersInserted = hasChapters;

    // No global LLM metadata here; keep existing course title/language
    const makePublic = !course.user_id; // guest uploads should be publicly readable
    const updateResult = await admin.from("courses").update({
      status: allChaptersInserted ? "ready" : "processing", // Ready for user to generate quiz/flashcards/notes
      title: course.title,
      language: contentLanguage,
      content_language: contentLanguage,
      is_public: makePublic ? true : course.is_public,
      error_message: null,
      chapter_count: readyChapters.length, // Only count ready chapters
      quiz_status: 'pending', // Quiz not yet generated
    }).eq("id", course.id);

    logStep("course_status_updated", {
      courseId: course.id,
      newStatus: allChaptersInserted ? "ready" : "processing",
      chapterCount: readyChapters.length,
      updateError: updateResult.error?.message || null,
    });

    await admin
      .from("pipeline_jobs")
      .update({ status: "succeeded", updated_at: new Date().toISOString(), stage: "done" })
      .eq("id", jobId);

    await logEvent("course_ready", { userId: course.user_id, courseId: course.id });
    logStep("pipeline_done", { courseId: course.id, jobId });
  } catch (error: any) {
    await admin.from("courses").update({
      status: "failed",
      error_message: error?.message || "Pipeline failed",
    }).eq("id", course.id);

    await admin
      .from("pipeline_jobs")
      .update({ status: "failed", error_message: error?.message || "Pipeline failed", updated_at: new Date().toISOString(), stage: "failed" })
      .eq("id", jobId);

    await logEvent("course_failed", { userId: course.user_id, courseId: course.id, payload: { error: error?.message } });
    logStep("pipeline_failed", { courseId: course.id, jobId, error: error?.message });
    throw error;
  }
}
