/**
 * PDF OCR Server - Page-by-page OCR using pdf-to-img + OpenAI Vision
 *
 * This module handles PDF files that cannot be parsed with pdf2json
 * by rendering each page as an image and using OCR
 *
 * Enhanced with specialized math formula extraction
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
 * Specialized OCR prompt for PDFs with mathematical content
 * This prompt is optimized to correctly extract formulas, Greek letters, and financial notation
 */
const MATH_OCR_SYSTEM_PROMPT = `You are an expert OCR system specialized in extracting text from academic and financial documents that contain mathematical formulas, equations, and financial notation.

CRITICAL INSTRUCTIONS:
1. Extract ALL text exactly as it appears in the image
2. For mathematical formulas:
   - Use standard notation: subscripts with _ (e.g., k_wacc, FCFF_n)
   - Use ^ for superscripts (e.g., x^2, (1+r)^n)
   - Preserve Greek letters: β (beta), α (alpha), Σ (sigma), Δ (delta), etc.
   - Write fractions as: numerator / denominator
   - For summations: Σ(i=1 to n) or SUM from i=1 to n

3. For financial formulas specifically:
   - WACC, CAPM, DCF, NPV, IRR should be clearly identified
   - k_e (cost of equity), k_d (cost of debt), r_f (risk-free rate)
   - FCFF (Free Cash Flow to Firm), FCFE (Free Cash Flow to Equity)
   - Terminal Value, Enterprise Value, Equity Value

4. Preserve document structure:
   - Keep headings and titles
   - Maintain paragraph breaks
   - Preserve bullet points and numbered lists
   - Keep table structures readable

5. If a formula is complex, describe it in a readable format, e.g.:
   "WACC = (E/V) × k_e + (D/V) × k_d × (1 - t)"

Return ONLY the extracted text, preserving structure. No commentary.`;

const MATH_OCR_USER_PROMPT = `Extract ALL text from this document page. This is an academic/financial document that likely contains:
- Mathematical formulas and equations
- Financial ratios and metrics (WACC, CAPM, DCF, NPV, etc.)
- Greek letters (α, β, Σ, Δ, etc.)
- Subscripts and superscripts

IMPORTANT:
- Write formulas in a clear, readable format
- Use underscores for subscripts: k_wacc, FCFF_n
- Use carets for exponents: (1+r)^n
- Preserve ALL Greek letters correctly
- Keep the document structure (headings, paragraphs, lists)
- Extract text from any graphs, charts, or diagrams

Return the complete extracted text:`;

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
