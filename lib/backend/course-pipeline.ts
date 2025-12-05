import path from "path";
import { randomUUID } from "crypto";
import { getServiceSupabase } from "@/lib/supabase";
import { parsePDF } from "@/lib/pdf-parser";
import { parseDocx } from "@/lib/document-parser";
import { parseImage } from "@/lib/image-parser";
import {
  extractTextFromImage,
  generateChapterQuestions,
  generateChapterStructureFromCourseText,
  generateConceptChapterQuestions,
} from "@/lib/openai-vision";
import { validateExtractedText, truncateTextIntelligently } from "@/lib/openai-fallback";
import { logEvent } from "./analytics";
import { detectContentLanguageFromText } from "./language-detection";
import {
  extractChapterText,
  LLM_CONFIG,
  CourseDeduplicationTracker,
  detectDocumentStructure,
  structureToChapters,
  type ChapterBoundary,
  type DocumentStructure,
} from "@/lib/llm";

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
  // Real chapter positions (from document structure detection)
  _startPosition?: number;
  _endPosition?: number;
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

  setImmediate(() => {
    processCourseJob(job?.id ?? "").catch(err => {
      console.error("Background course processing failed", err);
    });
  });

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
    await admin.from("pipeline_jobs").update({ stage: "download" }).eq("id", jobId);

    const download = await admin.storage.from(bucket).download(storagePath);
    if (download.error || !download.data) {
      throw download.error || new Error("Unable to download source file");
    }
    const buffer = Buffer.from(await download.data.arrayBuffer());
    const ext = path.extname(storagePath).toLowerCase();

    logStep("extraction_start", { courseId: course.id, ext });
    await admin.from("pipeline_jobs").update({ stage: "extraction" }).eq("id", jobId);

    let extractedText = "";
    if (ext === ".pdf") {
      extractedText = await parsePDF(buffer);
    } else if (ext === ".docx" || ext === ".doc") {
      extractedText = await parseDocx(buffer);
    } else {
      const dataUrl = await parseImage(buffer);
      await logEvent("vision_success", { userId: course.user_id, courseId: course.id });
      extractedText = await extractTextFromImage(dataUrl);
    }

    const validation = validateExtractedText(extractedText, MIN_TEXT_LENGTH);
    if (!validation.isValid) {
      await logEvent("vision_failed", { userId: course.user_id, courseId: course.id, payload: { reason: validation.reason } });
      throw new Error(`Insufficient text extracted (${validation.reason})`);
    }

    logStep("llm_structuring_start", { courseId: course.id });
    await admin.from("pipeline_jobs").update({ stage: "structuring" }).eq("id", jobId);

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

    // === PHASE 1: Detect REAL chapters from the document structure ===
    logStep("detecting_real_chapters", { courseId: course.id });

    let documentStructure: DocumentStructure | null = null;
    let useRealChapters = false;

    try {
      // Detect real document structure (uses LLM for refinement)
      documentStructure = await detectDocumentStructure(extractedText, modelLanguage, true);

      // Use real chapters if detection has good confidence (>= 0.6) and found at least 2 sections
      useRealChapters = documentStructure.confidence >= 0.6 && documentStructure.sections.length >= 2;

      logStep("document_structure_detected", {
        courseId: course.id,
        confidence: documentStructure.confidence,
        sectionsFound: documentStructure.sections.length,
        documentType: documentStructure.documentType,
        useRealChapters,
      });
    } catch (structureError: any) {
      logStep("document_structure_detection_failed", {
        courseId: course.id,
        error: structureError?.message,
      });
    }

    let chapterStructure: any[];

    if (useRealChapters && documentStructure) {
      // === Use REAL chapters detected from the document ===
      logStep("using_real_chapters", { courseId: course.id, count: documentStructure.sections.length });

      // Convert detected structure to chapter format
      const realChapters = structureToChapters(documentStructure, extractedText);

      chapterStructure = realChapters.map(ch => ({
        index: ch.index,
        title: ch.title,
        short_summary: ch.short_summary,
        difficulty: ch.difficulty,
        learning_objectives: [], // Will be enriched by LLM later if needed
        key_concepts: [],
        // Store real positions for accurate text extraction
        _startPosition: ch.startPosition,
        _endPosition: ch.endPosition,
        _hasFormulas: ch.hasFormulas,
      }));
    } else {
      // === Fallback: LLM generates chapter structure (original behavior) ===
      logStep("using_llm_chapters", { courseId: course.id });

      chapterStructure = await generateChapterStructureFromCourseText(
        cleanText,
        course.title || course.original_filename || undefined,
        modelLanguage
      );
    }

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
        // Store real chapter positions if available (from document structure detection)
        _startPosition: ch._startPosition,
        _endPosition: ch._endPosition,
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
      mode: useRealChapters ? "real_chapters" : "llm_generated",
    });

    // === Chapter text extraction ===
    // If we have real chapter positions, use them directly
    // Otherwise, fall back to intelligent marker-based extraction
    let chapterBoundaries: ChapterBoundary[] = [];

    const hasRealPositions = chapters.some(ch => ch._startPosition !== undefined);

    if (hasRealPositions) {
      // Use real positions from document structure detection
      logStep("using_real_chapter_positions", { courseId: course.id });

      chapterBoundaries = chapters.map(ch => ({
        index: ch.orderIndex + 1,
        title: ch.title,
        startPosition: ch._startPosition || 0,
        endPosition: ch._endPosition || extractedText.length,
        text: extractedText.substring(
          ch._startPosition || 0,
          Math.min(ch._endPosition || extractedText.length, (ch._startPosition || 0) + LLM_CONFIG.truncation.chapterText)
        ).trim(),
      }));
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
      mode: hasRealPositions ? "real_positions" : "marker_based",
    });

    // Initialize course-level deduplication tracker to prevent cross-chapter duplicates
    const deduplicationTracker = new CourseDeduplicationTracker(0.65); // 65% similarity threshold

    for (const chapter of chapters) {
      // Find matching boundary or fall back to full text
      const boundary = chapterBoundaries.find(b => b.index === chapter.orderIndex + 1);
      const chapterText = boundary?.text || extractedText.substring(0, LLM_CONFIG.truncation.chapterText);
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
      });
      if (chapterInsertError) {
        console.error("Chapter insert failed", chapterInsertError);
        throw chapterInsertError;
      }

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

      const coverageMap = new Map<string, number>();
      chapter.concepts.forEach(c => coverageMap.set(c.id, 0));

      // Up to two passes to reach 95% coverage and double coverage for importance=3
      let pass = 0;
      let finalCoverage = 0;
      let finalImportantCovered = false;
      while (pass < 2) {
        logStep("llm_questions_start", { courseId: course.id, chapterId: chapter.id, pass });
        await admin.from("pipeline_jobs").update({ stage: `questions_pass_${pass}` }).eq("id", jobId);

        logStep("chapter_text_sample", {
          courseId: course.id,
          chapterId: chapter.id,
          sample: chapterText.substring(0, 300),
          length: chapterText.length,
        });

        const generated = await generateConceptChapterQuestions(
          {
            index: chapter.orderIndex + 1,
            title: chapter.title,
            short_summary: chapter.summary,
            difficulty: chapter.concepts[0]?.importance || 1,
            // Pass learning objectives and key concepts for better question generation
            learning_objectives: chapter.learning_objectives,
            key_concepts: chapter.key_concepts,
          },
          chapterText,
          modelLanguage,
          {
            // Enable semantic validation to reject questions that aren't well-supported by source text
            enableSemanticValidation: true,
          }
        );

        // The helper now always returns an array after validation/deduplication
        const rawQuestions: any[] = Array.isArray(generated) ? generated : (generated as any).questions || [];

        // Apply cross-chapter deduplication to remove questions similar to previous chapters
        const dedupeResult = deduplicationTracker.filterQuestions(
          rawQuestions.map(q => ({ prompt: q.prompt || q.question, ...q })),
          chapter.orderIndex
        );
        const questions: any[] = dedupeResult.filtered as any[]; // Keep as any[] to preserve original properties

        if (dedupeResult.duplicatesRemoved > 0) {
          logStep("cross_chapter_deduplication", {
            courseId: course.id,
            chapterId: chapter.id,
            chapterIndex: chapter.orderIndex,
            originalCount: rawQuestions.length,
            afterDeduplication: questions.length,
            duplicatesRemoved: dedupeResult.duplicatesRemoved,
            duplicateDetails: dedupeResult.duplicateDetails.slice(0, 3), // Log first 3 for debugging
          });
          console.log(`🔄 Removed ${dedupeResult.duplicatesRemoved} cross-chapter duplicate(s) in chapter ${chapter.orderIndex + 1}`);
        }

        logStep("questions_parsed", {
          courseId: course.id,
          chapterId: chapter.id,
          pass,
          count: questions.length,
          withConceptIds: questions.some((q: any) => Array.isArray((q as any).concept_ids) && (q as any).concept_ids.length > 0),
        });

        for (let idx = 0; idx < questions.length; idx++) {
          const q = questions[idx];
          const questionId = randomUUID();

          // Map concept ids coming from the LLM when present; fallback to a round-robin assignment.
          const conceptIdsFromLLM: string[] = Array.isArray((q as any).concept_ids) ? (q as any).concept_ids.filter((id: string) => coverageMap.has(id)) : [];
          const fallbackConceptId = chapter.concepts[(idx + pass) % chapter.concepts.length]?.id;
          const targetConceptIds: string[] = conceptIdsFromLLM.length > 0
            ? Array.from(new Set(conceptIdsFromLLM))
            : fallbackConceptId
              ? [fallbackConceptId]
              : [];
          const primaryConceptId = targetConceptIds.find(id => coverageMap.has(id));

          // Enforce MCQ-only: ensure 4 options and a valid correct option index
          const rawOptions: string[] = Array.isArray(q.options) ? q.options : [];
          const fixedOptions: string[] =
            rawOptions.length === 4
              ? rawOptions
              : [...rawOptions, "Option C", "Option D"].slice(0, 4);
          const textCandidates = [q.expected_answer, q.correctAnswer, q.answer, q.answer_text].filter(Boolean) as string[];
          const findIndexFromText = () =>
            fixedOptions.findIndex((opt: string) =>
              textCandidates.some(txt => txt && opt.toLowerCase() === txt.toLowerCase())
            );
          const providedIndex =
            typeof q.correct_option_index === "number" &&
            q.correct_option_index >= 0 &&
            q.correct_option_index < fixedOptions.length
              ? q.correct_option_index
              : -1;
          const derivedIndex = findIndexFromText();
          const correctIndex = providedIndex >= 0 ? providedIndex : derivedIndex >= 0 ? derivedIndex : 0;
          const correctOption = fixedOptions[correctIndex];

          const { error: questionInsertError } = await admin.from("questions").insert({
            id: questionId,
            chapter_id: chapter.id,
            concept_id: null, // keep concept mapping in question_concepts; avoid FK failures here
            question_number: q.questionNumber ?? q.order ?? idx + 1,
            question_text: q.prompt || q.question,
            answer_text: q.expected_answer || correctOption || q.correctAnswer || q.answer || null,
            options: fixedOptions,
            type: "mcq", // force multiple choice
            difficulty: q.phase === "mcq" ? 2 : 3,
            phase: q.phase || "mcq",
            points: q.points ?? (q.type === "mcq" ? 10 : 35),
            // store correct option index in options payload for clarity
            correct_option_index: correctIndex,
            explanation: q.explanation || null,
            // Phase 1: Store source_reference and cognitive_level for quality audit
            source_reference: q.source_reference || null,
            cognitive_level: q.cognitive_level || null,
          });
          if (questionInsertError) {
            console.error("Question insert failed", questionInsertError);
            throw questionInsertError;
          }

          for (const conceptId of targetConceptIds) {
            const { error: linkError } = await admin.from("question_concepts").insert({
              question_id: questionId,
              concept_id: conceptId,
            });
            if (linkError) {
              console.error("Question-concept link insert failed", linkError);
              // If the concept row is missing, skip linking to avoid breaking the pipeline
              continue;
            }
            coverageMap.set(conceptId, (coverageMap.get(conceptId) ?? 0) + 1);
          }
        }

        const covered = Array.from(coverageMap.values()).filter(v => v > 0).length;
        finalCoverage = chapter.concepts.length > 0 ? covered / chapter.concepts.length : 1;
        finalImportantCovered = chapter.concepts
          .filter(c => c.importance >= 3)
          .every(c => (coverageMap.get(c.id) ?? 0) >= 2);

        logStep("coverage_check", {
          courseId: course.id,
          chapterId: chapter.id,
          pass,
          coverageRatio: finalCoverage,
          covered,
          total: chapter.concepts.length,
          importantCovered: finalImportantCovered,
        });

        await admin
          .from("chapters")
          .update({
            concept_count: chapter.concepts.length,
            covered_concepts: covered,
          coverage_ratio: finalCoverage,
        })
        .eq("id", chapter.id);

        if (finalCoverage >= 0.95 && finalImportantCovered) {
          break;
        }
        pass += 1;
      }

      // If coverage is still low, keep the generated questions but warn instead of failing the whole course.
      if (finalCoverage < 0.95 || !finalImportantCovered) {
        logStep("coverage_warning", {
          courseId: course.id,
          chapterId: chapter.id,
          coverage: finalCoverage,
          importantCovered: finalImportantCovered,
          message: "Coverage below target after two passes; keeping questions and continuing.",
        });
      }
    }

    // No global LLM metadata here; keep existing course title/language
    const makePublic = !course.user_id; // guest uploads should be publicly readable
    await admin.from("courses").update({
      status: "ready",
      title: course.title,
      language: contentLanguage,
      content_language: contentLanguage,
      is_public: makePublic ? true : course.is_public,
      error_message: null,
    }).eq("id", course.id);

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
