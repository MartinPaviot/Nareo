/**
 * PDF OCR Server - Page-by-page OCR using pdf-to-img + OpenAI Vision
 *
 * This module handles PDF files that cannot be parsed with pdf2json
 * by rendering each page as an image and using OCR
 *
 * Enhanced with specialized math formula extraction
 *
 * NEW: Targeted OCR - Only OCR pages with corrupted formulas
 */

import { pdf } from 'pdf-to-img';
import { openai } from './openai-vision';
import {
  withRetry,
  withCircuitBreaker,
  openaiVisionCircuitBreaker,
  llmLogger,
  LLM_CONFIG,
} from './llm';

/**
 * Represents a corrupted formula zone in a PDF
 */
export interface CorruptedZone {
  pageNum: number;
  x: number;
  y: number;
  text: string;
  corruptionType: 'hangul' | 'greek' | 'garbage' | 'pua';
}

/**
 * Result of targeted OCR on specific pages
 */
export interface TargetedOCRResult {
  pageNum: number;
  originalText: string;
  ocrText: string;
  success: boolean;
}

/**
 * Specialized OCR prompt for PDFs with mathematical content
 * This prompt is optimized to correctly extract formulas exactly as they appear visually
 */
const MATH_OCR_SYSTEM_PROMPT = `You are an expert OCR system. Your goal is to extract text EXACTLY as it appears visually in the document.

CRITICAL - FORMULA FORMATTING:
DO NOT use LaTeX syntax (\frac, \sum, etc.). Instead, write formulas EXACTLY as they appear visually:

CORRECT examples:
- "EV₀ = Σ(i=1 to n) FCFFᵢ / (1 + k_wacc)ⁱ + [TVₙ / (1 + k_wacc)ⁿ]"
- "β_L = β_U × [1 + (1 - T) × D/E]"
- "WACC = k_e × E/V + k_d × D/V × (1 - T)"
- "r_e = r_f + E(MRP) × β"

WRONG (do NOT do this):
- "\\frac{FCFF_i}{(1+k)^i}" → Write: "FCFFᵢ / (1 + k)ⁱ"
- "\\sum_{i=1}^{n}" → Write: "Σ(i=1 to n)" or just "Σ"
- "\\beta" → Write: "β"

FORMATTING RULES:
1. Use Unicode subscripts when possible: ₀₁₂₃₄₅₆₇₈₉ₐₑᵢₙ
2. Use Unicode superscripts when possible: ⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ
3. Use actual Greek letters: α β γ δ Σ Δ
4. Write fractions with / : "numerator / denominator"
5. Use × for multiplication (not * or x)
6. Preserve brackets exactly: [ ] ( ) { }

FINANCIAL NOTATION:
- k_e = cost of equity, k_d = cost of debt, r_f = risk-free
- FCFF, FCFE, EV, TV (keep abbreviations)
- WACC, CAPM, DCF, NPV, IRR

STRUCTURE:
- Keep bullet points (§ or -)
- Preserve headings and titles
- Maintain paragraph breaks

TABLES: Use Markdown pipes:
| Col1 | Col2 | Col3 |
| val1 | val2 | val3 |

Return ONLY the extracted text, preserving structure. No commentary.`;

const MATH_OCR_USER_PROMPT = `Extract ALL text from this slide/page EXACTLY as it appears visually.

CRITICAL RULES:
1. NO LaTeX - write formulas as plain text with Unicode symbols
2. Use actual symbols: Σ β α Δ × ÷ ≤ ≥ ≠ ≈
3. Use subscripts: ₀₁₂₃₄₅₆₇₈₉ₐₑᵢₙ (e.g., EV₀, FCFFᵢ)
4. Use superscripts: ⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ (e.g., (1+k)ⁿ)
5. Fractions: write as "numerator / denominator"

Example - if you see a DCF formula, write:
"EV₀ = Σ(i=1 to n) FCFFᵢ / (1 + k_wacc)ⁱ + [TVₙ / (1 + k_wacc)ⁿ]"

NOT: "\\frac{FCFF_i}{(1+k)^i}"

Tables: use Markdown | Col1 | Col2 |

Extract now:`;

/**
 * Extract text from PDF using page-by-page OCR
 * @param buffer - PDF file buffer
 * @returns Extracted text from all pages
 */
export async function extractTextFromPdfWithOCR(buffer: Buffer): Promise<string> {
  console.log('🔬 Starting page-by-page OCR extraction...');

  try {
    // Load PDF document using pdf-to-img
    // This library properly handles PDF rendering to images
    const document = await pdf(buffer, {
      scale: 2.0,  // Higher scale = better OCR accuracy
    });

    // Get total page count
    const numPages = document.length;
    console.log(`📄 PDF loaded: ${numPages} pages`);

    // Extract text from each page
    const pageTexts: string[] = [];
    let pageNum = 0;

    for await (const imageBuffer of document) {
      pageNum++;
      console.log(`🔍 Processing page ${pageNum}/${numPages}...`);

      try {
        // Convert image buffer to base64 data URL
        const base64Image = imageBuffer.toString('base64');
        const imageDataUrl = `data:image/png;base64,${base64Image}`;

        // Extract text using specialized Math OCR
        const pageText = await extractTextWithMathOCR(imageDataUrl);

        if (pageText && pageText.trim().length > 0) {
          pageTexts.push(pageText.trim());
          console.log(`✅ Page ${pageNum}: extracted ${pageText.length} characters`);
        } else {
          console.log(`⚠️ Page ${pageNum}: no text extracted`);
        }
      } catch (pageError: any) {
        console.error(`❌ Error processing page ${pageNum}:`, pageError.message);
        // Continue with next page
      }
    }

    // Combine all page texts
    const fullText = pageTexts.join('\n\n');

    console.log(`✅ OCR extraction complete: ${fullText.length} total characters from ${pageTexts.length} pages`);

    return fullText;

  } catch (error: any) {
    console.error('❌ Error in PDF OCR extraction:', error.message);
    throw new Error(`Failed to extract text with OCR: ${error.message}`);
  }
}


/**
 * Extract text from ONLY specific pages that have corrupted formulas
 * This is much faster than full-document OCR as it only processes affected pages
 *
 * @param buffer - PDF file buffer
 * @param corruptedPages - Set of page numbers (1-indexed) with corrupted formulas
 * @returns Map of pageNum -> OCR text for each processed page
 */
export async function extractTextFromSpecificPages(
  buffer: Buffer,
  corruptedPages: Set<number>
): Promise<Map<number, string>> {
  console.log(`🎯 Starting TARGETED OCR on ${corruptedPages.size} pages: [${[...corruptedPages].join(', ')}]`);

  const results = new Map<number, string>();

  if (corruptedPages.size === 0) {
    return results;
  }

  try {
    const document = await pdf(buffer, {
      scale: 2.0,
    });

    const numPages = document.length;
    console.log(`📄 PDF has ${numPages} pages, OCR-ing only ${corruptedPages.size} pages`);

    let pageNum = 0;
    for await (const imageBuffer of document) {
      pageNum++;

      // Skip pages that don't have corruption
      if (!corruptedPages.has(pageNum)) {
        continue;
      }

      console.log(`🔍 OCR page ${pageNum}...`);

      try {
        const base64Image = imageBuffer.toString('base64');
        const imageDataUrl = `data:image/png;base64,${base64Image}`;

        const pageText = await extractTextWithMathOCR(imageDataUrl);

        if (pageText && pageText.trim().length > 0) {
          results.set(pageNum, pageText.trim());
          console.log(`✅ Page ${pageNum}: extracted ${pageText.length} characters via OCR`);
        } else {
          console.log(`⚠️ Page ${pageNum}: OCR returned empty`);
        }
      } catch (pageError: any) {
        console.error(`❌ Error OCR-ing page ${pageNum}:`, pageError.message);
      }
    }

    console.log(`✅ Targeted OCR complete: ${results.size}/${corruptedPages.size} pages processed`);
    return results;

  } catch (error: any) {
    console.error('❌ Error in targeted OCR:', error.message);
    throw new Error(`Failed targeted OCR: ${error.message}`);
  }
}

/**
 * Extract text from an image using specialized Math-aware OCR
 * Uses GPT-4 Vision with a prompt optimized for mathematical and financial content
 * @param imageDataUrl - Base64 encoded image data URL
 * @returns Extracted text with properly formatted formulas
 */
async function extractTextWithMathOCR(imageDataUrl: string): Promise<string> {
  const logContext = llmLogger.createContext('extractTextWithMathOCR', LLM_CONFIG.models.vision);
  console.log('🧮 Extracting text with Math-specialized OCR...');

  try {
    const response = await withCircuitBreaker(
      openaiVisionCircuitBreaker,
      () => withRetry(
        async () => {
          const result = await openai.chat.completions.create({
            model: LLM_CONFIG.models.vision,
            messages: [
              {
                role: 'system',
                content: MATH_OCR_SYSTEM_PROMPT,
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: MATH_OCR_USER_PROMPT,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageDataUrl,
                      detail: 'high', // Use high detail for better formula recognition
                    },
                  },
                ],
              },
            ],
            temperature: LLM_CONFIG.temperatures.extraction,
            max_tokens: LLM_CONFIG.maxTokens.ocr,
          });
          return result;
        },
        { maxRetries: 2 }
      ),
      async () => {
        logContext.setFallbackUsed();
        return null;
      }
    );

    if (!response) {
      console.log('⚠️ Circuit breaker open for vision, returning empty text');
      logContext.setFallbackUsed().success();
      return '';
    }

    const extractedText = response.choices[0].message.content || '';

    if (response.usage) {
      logContext.setTokens(response.usage);
    }

    console.log('✅ Math OCR extracted', extractedText.length, 'characters');
    logContext.success();
    return extractedText;
  } catch (error: any) {
    console.error('❌ Error in Math OCR extraction:', error.message);
    logContext.setFallbackUsed().failure(error, error?.status);
    return '';
  }
}
