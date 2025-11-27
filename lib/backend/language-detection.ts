import { openai } from "@/lib/openai-vision";

type SupportedLanguage = "en" | "fr" | "de";

interface DetectionResult {
  language: SupportedLanguage;
  confidence: number;
  reason: string;
  detector: "llm" | "heuristic";
  sample: string;
}

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["en", "fr", "de"];

function heuristicDetect(text: string): DetectionResult {
  const sample = text.slice(0, 4000);
  const lower = sample.toLowerCase();
  const counts: Record<SupportedLanguage, number> = {
    en: 0,
    fr: 0,
    de: 0,
  };

  const indicators: Record<SupportedLanguage, string[]> = {
    en: [" the ", " an ", " and ", " what ", " how ", " why ", " which ", " of ", " to ", " for ", "with "],
    fr: [" le ", " la ", " les ", " un ", " une ", " des ", " et ", " pourquoi ", " comment ", " que ", " qu'", " de "],
    de: [" der ", " die ", " das ", " und ", " warum ", " wie ", " was ", " welches ", " den ", " dem "],
  };

  (Object.keys(indicators) as SupportedLanguage[]).forEach(lang => {
    counts[lang] = indicators[lang].reduce((acc, token) => acc + (lower.includes(token) ? 1 : 0), 0);
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]) as Array<[SupportedLanguage, number]>;
  const [winner, winnerScore] = sorted[0];
  const [, runnerUpScore] = sorted[1];
  const confidence = winnerScore === 0 ? 0 : winnerScore / Math.max(1, winnerScore + runnerUpScore);

  return {
    language: winner,
    confidence,
    reason: `Heuristic tokens matched: ${winnerScore}`,
    detector: "heuristic",
    sample,
  };
}

export async function detectContentLanguageFromText(text: string): Promise<DetectionResult> {
  const normalized = (text || "").trim();
  const sample = normalized.slice(0, 6000);

  if (!normalized) {
    return {
      language: "en",
      confidence: 0,
      reason: "Empty text; defaulting to en",
      detector: "heuristic",
      sample: "",
    };
  }

  const heuristic = heuristicDetect(sample);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a strict language identifier for educational course material. " +
            'Return ONLY JSON with keys "language" (en|fr|de|unknown) and "confidence" (0-1). ' +
            "Never translate or paraphrase the input; your job is only to classify the language. " +
            "Always respond in the same language as the input course text is written.",
        },
        {
          role: "user",
          content: `Detect the primary language (en, fr, de) of the following normalized course text.\nReturn JSON only.\n\nTEXT SAMPLE:\n${sample}`,
        },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 200,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    const llmLanguage = String(parsed.language || "").toLowerCase();
    const validLanguage = SUPPORTED_LANGUAGES.includes(llmLanguage as SupportedLanguage)
      ? (llmLanguage as SupportedLanguage)
      : heuristic.language;

    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : heuristic.confidence;

    return {
      language: validLanguage,
      confidence,
      reason: `LLM detection${validLanguage === heuristic.language ? "" : " (overrode heuristic)"}`,
      detector: "llm",
      sample,
    };
  } catch (error) {
    console.warn("[language-detection] LLM detection failed, falling back to heuristic", error);
    return heuristic;
  }
}
