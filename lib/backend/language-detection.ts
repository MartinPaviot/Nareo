import { openai } from "@/lib/openai-vision";
import {
  languageDetectionCache,
  LLMCache,
  withRetry,
  llmLogger,
  LLM_CONFIG,
  FAST_RETRY_OPTIONS,
} from "@/lib/llm";

type SupportedLanguage = "en" | "fr" | "de";

interface DetectionResult {
  language: SupportedLanguage;
  confidence: number;
  reason: string;
  detector: "llm" | "heuristic" | "cached";
  sample: string;
}

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["en", "fr", "de"];

/**
 * Heuristic-based language detection using common word patterns
 */
function heuristicDetect(text: string): DetectionResult {
  const sample = text.slice(0, 4000);
  const lower = sample.toLowerCase();
  const counts: Record<SupportedLanguage, number> = {
    en: 0,
    fr: 0,
    de: 0,
  };

  const indicators: Record<SupportedLanguage, string[]> = {
    en: [" the ", " an ", " and ", " what ", " how ", " why ", " which ", " of ", " to ", " for ", "with ", " is ", " are ", " this ", " that "],
    fr: [" le ", " la ", " les ", " un ", " une ", " des ", " et ", " pourquoi ", " comment ", " que ", " qu'", " de ", " est ", " sont ", " ce ", " cette "],
    de: [" der ", " die ", " das ", " und ", " warum ", " wie ", " was ", " welches ", " den ", " dem ", " ist ", " sind ", " ein ", " eine ", " nicht "],
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

/**
 * Generate a cache key from text sample
 */
function generateCacheKey(text: string): string {
  // Use first 2000 chars for cache key to balance uniqueness and performance
  const sample = text.slice(0, 2000);
  return LLMCache.generateKey({ text: sample, type: "language" });
}

/**
 * Detect content language from text
 * Uses caching and gpt-4o-mini for cost efficiency
 */
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

  // Check cache first
  const cacheKey = generateCacheKey(normalized);
  const cached = languageDetectionCache.get(cacheKey);
  if (cached) {
    console.log("[language-detection] Cache hit");
    return {
      language: cached.language as SupportedLanguage,
      confidence: cached.confidence,
      reason: "Cached result",
      detector: "cached",
      sample,
    };
  }

  // Compute heuristic first (fast fallback)
  const heuristic = heuristicDetect(sample);

  // If heuristic is very confident (>0.8), skip LLM call
  if (heuristic.confidence > 0.8) {
    console.log(`[language-detection] High confidence heuristic: ${heuristic.language} (${heuristic.confidence.toFixed(2)})`);
    // Cache the heuristic result
    languageDetectionCache.set(cacheKey, {
      language: heuristic.language,
      confidence: heuristic.confidence,
    });
    return heuristic;
  }

  const logContext = llmLogger.createContext("detectContentLanguage", LLM_CONFIG.models.fast);

  try {
    // Use gpt-4o-mini for cost efficiency (language detection is simple)
    const response = await withRetry(
      async () => {
        const result = await openai.chat.completions.create({
          model: LLM_CONFIG.models.fast, // gpt-4o-mini
          messages: [
            {
              role: "system",
              content:
                'Language classifier. Return JSON: {"language": "en"|"fr"|"de", "confidence": 0-1}. No other text.',
            },
            {
              role: "user",
              content: `Classify language:\n${sample.slice(0, 3000)}`,
            },
          ],
          temperature: LLM_CONFIG.temperatures.languageDetection,
          response_format: { type: "json_object" },
          max_tokens: LLM_CONFIG.maxTokens.languageDetection,
        });
        return result;
      },
      FAST_RETRY_OPTIONS
    );

    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    const llmLanguage = String(parsed.language || "").toLowerCase();
    const validLanguage = SUPPORTED_LANGUAGES.includes(llmLanguage as SupportedLanguage)
      ? (llmLanguage as SupportedLanguage)
      : heuristic.language;

    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : heuristic.confidence;

    // Log token usage
    if (response.usage) {
      logContext.setTokens(response.usage);
    }
    logContext.success();

    // Cache the result
    languageDetectionCache.set(cacheKey, {
      language: validLanguage,
      confidence,
    });

    console.log(`[language-detection] LLM detected: ${validLanguage} (${confidence.toFixed(2)})`);

    return {
      language: validLanguage,
      confidence,
      reason: `LLM detection${validLanguage === heuristic.language ? "" : " (overrode heuristic)"}`,
      detector: "llm",
      sample,
    };
  } catch (error) {
    console.warn("[language-detection] LLM detection failed, falling back to heuristic", error);
    logContext.setFallbackUsed().failure(error as Error);

    // Cache the heuristic result as fallback
    languageDetectionCache.set(cacheKey, {
      language: heuristic.language,
      confidence: heuristic.confidence,
    });

    return heuristic;
  }
}

/**
 * Get cache statistics for monitoring
 */
export function getLanguageDetectionCacheStats() {
  return languageDetectionCache.getStats();
}

/**
 * Clear language detection cache (for testing/admin)
 */
export function clearLanguageDetectionCache() {
  languageDetectionCache.clear();
}
