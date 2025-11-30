import { ChatCompletionMessageParam } from "openai/resources/chat";

/**
 * Production-grade prompt templates for Nareo.
 *
 * Each builder returns the full message array (system + user) ready for OpenAI chat completions
 * with the response_format set to { type: "json_object" } to enforce strict JSON outputs.
 */

export function buildChapterExtractionMessages(courseText: string): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You are a senior instructional designer.",
        "Given the full plain text of a course, split it into a logical ordered list of chapters that a student can revise in one sitting.",
        "Rules:",
        "- Read the entire course text.",
        "- Identify natural structure; do not merge unrelated sections.",
        "- Produce short, clear titles.",
        "- Output strict JSON only.",
        'JSON schema: { "chapters": [ { "index": 1, "title": "..." } ] }',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "Course text:",
        courseText,
        "Return ONLY the JSON structure, no markdown.",
      ].join("\n"),
    },
  ];
}

export function buildConceptExtractionMessages(args: {
  chapterText: string;
  chapterIndex: number;
  chapterTitle: string;
}): ChatCompletionMessageParam[] {
  const { chapterText, chapterIndex, chapterTitle } = args;
  return [
    {
      role: "system",
      content: [
        "You are an expert pedagogy model.",
        "Given the text of a single chapter, list every unit of knowledge a student must master to know the chapter at ~99% level.",
        "A concept can be: definition, formula, important fact, key reasoning step, cause/effect.",
        "Each concept must have: id, short title, detailed plain-language description, importance 1-3 (3 = critical).",
        "The concept set must cover ALL important ideas of the chapter.",
        'Output strict JSON only with schema: { "chapter_index": number, "chapter_title": string, "concepts": [ { "id": "c1", "title": "...", "description": "...", "importance": 1 } ] }',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Chapter index: ${chapterIndex}`,
        `Chapter title: ${chapterTitle}`,
        "Chapter text:",
        chapterText,
        "Return ONLY the JSON structure, no markdown.",
      ].join("\n"),
    },
  ];
}

export function buildQuizGenerationMessages(args: {
  chapterText: string;
  chapterIndex: number;
  chapterTitle: string;
  conceptsJson: string;
}): ChatCompletionMessageParam[] {
  const { chapterText, chapterIndex, chapterTitle, conceptsJson } = args;
  return [
    {
      role: "system",
      content: [
        "You are an assessment designer.",
        "Given a chapter and its concepts, create a quiz that covers at least 95% of concepts and 100% of importance-3 concepts.",
        "Use multiple-choice and short-answer questions.",
        "Coverage rules:",
        "- Each concept must be targeted by ≥1 question.",
        "- If importance is 3, create ≥2 questions from different angles (e.g., definition + application).",
        "Question fields:",
        'type ("mcq" | "short"), prompt, options and correct_option_index for mcq, expected_answer for short, explanation, concept_ids (array).',
        "Generate as many questions as needed to meet coverage.",
        'Output strict JSON only with schema: { "chapter_index": number, "chapter_title": string, "questions": [ { "type": "mcq", "prompt": "...", "options": ["..."], "correct_option_index": 0, "expected_answer": null, "explanation": "...", "concept_ids": ["c1"] } ] }',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Chapter index: ${chapterIndex}`,
        `Chapter title: ${chapterTitle}`,
        "Chapter text:",
        chapterText,
        "Concept list JSON:",
        conceptsJson,
        "Return ONLY the JSON structure, no markdown.",
      ].join("\n"),
    },
  ];
}
