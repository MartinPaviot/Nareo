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

const RAW_BUCKET = "courses_raw";
const MAX_PAGES = 100;
const MAX_IMAGES = 6;
const MIN_TEXT_LENGTH = 500;
const DEFAULT_CONTENT_LANGUAGE = "en";

interface UploadPayload {
  userId: string | null;
  file: File;
  isPublic?: boolean;
}

interface ChapterInput {
  id: string;
  title: string;
  summary: string;
  difficulty: "easy" | "medium" | "hard";
  orderIndex: number;
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

export async function queueCourseProcessing({ userId, file, isPublic = false }: UploadPayload) {
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

  const storagePath = buildStoragePath(userId, courseId, file.name || "upload.bin");

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
    user_id: userId,
    title: file.name || "Cours importe",
    original_filename: file.name || null,
    storage_bucket: RAW_BUCKET,
    storage_path: storagePath,
    status: "pending",
    pages_count: pagesCount,
    language: "fr",
    content_language: null,
    is_public: isPublic,
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

  await logEvent("upload_started", { userId, courseId });
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

    const cleanText = truncateTextIntelligently(extractedText, 20000);
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
    }).eq("id", course.id);

    const chapterStructure = await generateChapterStructureFromCourseText(
      cleanText,
      course.title || course.original_filename || undefined,
      modelLanguage
    );

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

    logStep("llm_structuring_done", { courseId: course.id, chapters: chapters.length });

    // Découpage simple du texte extrait pour ancrer les questions dans le contenu réel
    const chunkSize = Math.max(1000, Math.floor(cleanText.length / Math.max(chapters.length, 1)));

    for (const chapter of chapters) {
      const chapterText =
        cleanText.substring(chapter.orderIndex * chunkSize, (chapter.orderIndex + 1) * chunkSize) || cleanText;
      const { error: chapterInsertError } = await admin.from("chapters").insert({
        id: chapter.id,
        course_id: course.id,
        user_id: course.user_id,
        order_index: chapter.orderIndex,
        difficulty: chapter.difficulty,
        title: chapter.title,
        summary: chapter.summary,
        importance: Math.min(3, Math.max(1, chapter.orderIndex + 1)),
        source_text: chapterText.substring(0, 4000),
        extracted_text: chapterText.substring(0, 4000),
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
          },
          chapterText,
          modelLanguage
        );

        // The helper may return either an array or an object with a questions array
        const questions = Array.isArray(generated) ? generated : generated.questions || [];
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
          const conceptIdsFromLLM = Array.isArray((q as any).concept_ids) ? (q as any).concept_ids.filter((id: string) => coverageMap.has(id)) : [];
          const fallbackConceptId = chapter.concepts[(idx + pass) % chapter.concepts.length]?.id;
          const targetConceptIds = conceptIdsFromLLM.length > 0
            ? Array.from(new Set(conceptIdsFromLLM))
            : fallbackConceptId
              ? [fallbackConceptId]
              : [];
          const primaryConceptId = targetConceptIds.find(id => coverageMap.has(id));

          // Enforce MCQ-only: ensure 4 options and a valid correct option index
          const rawOptions = Array.isArray(q.options) ? q.options : [];
          const fixedOptions =
            rawOptions.length === 4
              ? rawOptions
              : [...rawOptions, "Option C", "Option D"].slice(0, 4);
          const textCandidates = [q.expected_answer, q.correctAnswer, q.answer, q.answer_text].filter(Boolean) as string[];
          const findIndexFromText = () =>
            fixedOptions.findIndex(opt =>
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
