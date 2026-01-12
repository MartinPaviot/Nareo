/**
 * PDF OCR Server - Page-by-page OCR using pdfjs-dist + canvas + OpenAI Vision
 *
 * This module handles PDF files that cannot be parsed with pdf2json
 * by rendering each page as an image and using OCR
 *
 * Enhanced with specialized math formula extraction
 *
 * NEW: Targeted OCR - Only OCR pages with corrupted formulas
 *
 * Uses pdfjs-dist directly with worker disabled for Next.js compatibility
 */

// Dynamic imports for server-side only modules
let pdfjsLib: typeof import('pdfjs-dist/legacy/build/pdf.mjs') | null = null;
let canvasLib: typeof import('canvas') | null = null;

async function getPdfjs() {
  if (!pdfjsLib) {
    // IMPORTANT: Set GlobalWorkerOptions BEFORE any pdfjs operations
    // This prevents the "No GlobalWorkerOptions.workerSrc specified" error
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Point to the actual worker file from pdfjs-dist
    // This resolves the "No GlobalWorkerOptions.workerSrc specified" error
    pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

    pdfjsLib = pdfjs;
  }
  return pdfjsLib;
}

async function getCanvas() {
  if (!canvasLib) {
    canvasLib = await import('canvas');
  }
  return canvasLib;
}

/**
 * Create a NodeCanvasFactory for pdfjs-dist
 * This factory must be passed to BOTH getDocument() AND page.render()
 * to fix the "Image or Canvas expected" error
 *
 * Reference: https://stackoverflow.com/questions/79579312/cant-render-a-pdf-page-on-node-canva-nodejs-pdfjs-dist
 */
async function createNodeCanvasFactory() {
  const canvasModule = await getCanvas();

  return class NodeCanvasFactory {
    create(width: number, height: number) {
      const canvas = canvasModule.createCanvas(width, height);
      const context = canvas.getContext('2d');
      return { canvas, context };
    }

    reset(canvasAndContext: any, width: number, height: number) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    }

    destroy(canvasAndContext: any) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    }
  };
}

/**
 * Load a PDF document with canvas factory configured
 * The CanvasFactory must be passed to getDocument() for render to work
 */
async function loadPdfDocument(uint8Array: Uint8Array) {
  const pdfjs = await getPdfjs();
  const NodeCanvasFactory = await createNodeCanvasFactory();

  return pdfjs.getDocument({
    data: uint8Array,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    // @ts-ignore - CanvasFactory is valid but not in types
    CanvasFactory: NodeCanvasFactory,
  }).promise;
}

/**
 * Render a PDF page to a PNG buffer using pdfjs-dist + canvas
 */
async function renderPageToImage(pdfDoc: any, pageNum: number, scale: number = 2.0): Promise<Buffer> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const NodeCanvasFactory = await createNodeCanvasFactory();
  const canvasFactory = new NodeCanvasFactory();
  const canvasAndContext = canvasFactory.create(
    Math.floor(viewport.width),
    Math.floor(viewport.height)
  );

  await page.render({
    canvasContext: canvasAndContext.context,
    viewport,
    canvasFactory,
  }).promise;

  return canvasAndContext.canvas.toBuffer('image/png');
}

/**
 * Extract images from a PDF page using Mistral-provided bounding boxes
 *
 * @param buffer - PDF file buffer
 * @param pageNum - Page number (1-indexed)
 * @param imageMetadata - Image locations from Mistral OCR
 * @returns Array of cropped image buffers
 */
export async function extractImagesFromPage(
  buffer: Buffer,
  pageNum: number,
  imageMetadata: MistralImageMetadata[]
): Promise<{ id: string; imageBuffer: Buffer }[]> {
  console.log(`🖼️ Extracting ${imageMetadata.length} images from page ${pageNum}...`);

  if (imageMetadata.length === 0) {
    return [];
  }

  try {
    const uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const pdfDoc = await loadPdfDocument(uint8Array);

    // Render the full page at high resolution (scale=2.0)
    const scale = 2.0;
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const NodeCanvasFactory = await createNodeCanvasFactory();
    const canvasFactory = new NodeCanvasFactory();
    const canvasAndContext = canvasFactory.create(
      Math.floor(viewport.width),
      Math.floor(viewport.height)
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (page.render as any)({
      canvasContext: canvasAndContext.context,
      viewport,
      canvasFactory,
    }).promise;

    const fullCanvas = canvasAndContext.canvas;
    const canvasModule = await getCanvas();

    // Extract each image using its bounding box
    const extractedImages: { id: string; imageBuffer: Buffer }[] = [];

    for (const img of imageMetadata) {
      try {
        // Mistral coordinates are in PDF points (72 DPI), need to scale to canvas pixels
        const x = Math.floor(img.topLeftX * scale);
        const y = Math.floor(img.topLeftY * scale);
        const width = Math.floor((img.bottomRightX - img.topLeftX) * scale);
        const height = Math.floor((img.bottomRightY - img.topLeftY) * scale);

        // Create a new canvas for the cropped image
        const croppedCanvas = canvasModule.createCanvas(width, height);
        const croppedContext = croppedCanvas.getContext('2d');

        // Copy the image region from the full page
        croppedContext.drawImage(
          fullCanvas,
          x, y, width, height,  // Source rectangle
          0, 0, width, height   // Destination rectangle
        );

        const imageBuffer = croppedCanvas.toBuffer('image/png');
        extractedImages.push({ id: img.id, imageBuffer });

        console.log(`  ✅ Extracted ${img.id}: ${width}x${height}px, ${(imageBuffer.length / 1024).toFixed(1)}KB`);
      } catch (imgError: any) {
        console.error(`  ❌ Failed to extract ${img.id}:`, imgError.message);
      }
    }

    console.log(`✅ Extracted ${extractedImages.length}/${imageMetadata.length} images from page ${pageNum}`);
    return extractedImages;

  } catch (error: any) {
    console.error(`❌ Error extracting images from page ${pageNum}:`, error.message);
    return [];
  }
}

import { openai } from './openai-vision';
import {
  withRetry,
  withCircuitBreaker,
  openaiVisionCircuitBreaker,
  llmLogger,
  LLM_CONFIG,
} from './llm';
import {
  extractTextWithMistralOCR,
  extractTextFromImageWithMistral,
  extractImagesFromMistralResult,
  MistralImageMetadata,
  MistralPageData,
} from './mistral-ocr';

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
 * Extract text from PDF using Mistral OCR (primary) or page-by-page GPT-4 Vision (fallback)
 *
 * Mistral OCR is:
 * - More reliable (no content refusals)
 * - Cheaper (~$1/1000 pages vs ~$15-20/1000 pages)
 * - Faster (processes entire PDF at once)
 * - Better at math/LaTeX
 *
 * @param buffer - PDF file buffer
 * @returns Extracted text from all pages
 */
export async function extractTextFromPdfWithOCR(buffer: Buffer): Promise<string> {
  console.log('🔬 Starting OCR extraction...');

  // Try Mistral OCR first (preferred)
  if (process.env.MISTRAL) {
    console.log('🔮 Using Mistral OCR (primary)...');
    const mistralResult = await extractTextWithMistralOCR(buffer, 'document.pdf');

    if (mistralResult.success && mistralResult.text.length > 0) {
      console.log(`✅ Mistral OCR extracted ${mistralResult.text.length} characters from ${mistralResult.pages} pages`);
      return mistralResult.text;
    }

    console.log('⚠️ Mistral OCR failed or returned empty, falling back to GPT-4 Vision...');
    if (mistralResult.error) {
      console.log(`⚠️ Mistral error: ${mistralResult.error}`);
    }
  } else {
    console.log('⚠️ MISTRAL API key not configured, using GPT-4 Vision fallback...');
  }

  // Fallback to page-by-page GPT-4 Vision OCR
  console.log('🔬 Starting page-by-page GPT-4 Vision OCR (fallback)...');

  try {
    // Convert Buffer to Uint8Array (pdfjs-dist requires Uint8Array, not Buffer)
    const uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // Load PDF document with CanvasFactory configured for OCR rendering
    const pdfDoc = await loadPdfDocument(uint8Array);

    const numPages = pdfDoc.numPages;
    console.log(`📄 PDF loaded: ${numPages} pages`);

    // Extract text from each page
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      console.log(`🔍 Processing page ${pageNum}/${numPages}...`);

      try {
        // Render page to image
        const imageBuffer = await renderPageToImage(pdfDoc, pageNum, 2.0);

        // Convert image buffer to base64 data URL
        const base64Image = imageBuffer.toString('base64');
        const imageDataUrl = `data:image/png;base64,${base64Image}`;

        // Extract text using specialized Math OCR (GPT-4 Vision)
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
 * Extracted image with metadata
 */
export interface ExtractedImage {
  pageNum: number;
  imageId: string;
  imageBuffer: Buffer;
  width: number;
  height: number;
}

/**
 * Extract images from PDF using Mistral OCR
 *
 * This function:
 * 1. Calls Mistral OCR with includeImageBase64: true
 * 2. Extracts images directly from the Mistral response (as base64)
 * 3. Converts base64 to Buffer for saving
 *
 * This is much faster than rendering PDF pages because Mistral does all the work!
 *
 * @param buffer - PDF file buffer
 * @param filename - Original PDF filename (for logging)
 * @param onlyPages - Optional: only extract from these page numbers (0-indexed)
 * @returns Array of extracted images with metadata
 */
export async function extractImagesFromPDF(
  buffer: Buffer,
  filename: string = 'document.pdf',
  onlyPages?: Set<number>
): Promise<ExtractedImage[]> {
  console.log(`🖼️ Starting image extraction from: ${filename}`);

  // Step 1: Use Mistral OCR to extract both text AND images
  const mistralResult = await extractTextWithMistralOCR(buffer, filename);

  if (!mistralResult.success) {
    console.log('⚠️ Mistral OCR failed, no images to extract');
    return [];
  }

  // Step 2: Extract images directly from Mistral result (much faster than PDF rendering!)
  const images = extractImagesFromMistralResult(mistralResult, onlyPages);

  if (images.length === 0) {
    console.log('✅ No images found in PDF');
    return [];
  }

  // Step 3: Convert base64 images to Buffer format
  const extractedImages: ExtractedImage[] = [];

  for (const img of images) {
    try {
      // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
      const base64Data = img.base64Data.includes(',')
        ? img.base64Data.split(',')[1]
        : img.base64Data;

      const imageBuffer = Buffer.from(base64Data, 'base64');

      extractedImages.push({
        pageNum: img.pageNum,
        imageId: img.imageId,
        imageBuffer,
        width: 0,  // Could calculate from image buffer if needed
        height: 0,
      });
    } catch (error: any) {
      console.error(`❌ Error converting image ${img.imageId}:`, error.message);
    }
  }

  console.log(`✅ Extracted ${extractedImages.length} images from PDF (via Mistral)`);
  return extractedImages;
}

/**
 * Extract images from an already-loaded PDF document (internal helper)
 * This avoids the "detached ArrayBuffer" issue when processing multiple pages
 */
async function extractImagesFromLoadedPDF(
  pdfDoc: any,
  pageNum: number,
  imageMetadata: MistralImageMetadata[]
): Promise<{ id: string; imageBuffer: Buffer }[]> {
  if (imageMetadata.length === 0) {
    return [];
  }

  // Render the full page at high resolution (scale=2.0)
  const scale = 2.0;
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const NodeCanvasFactory = await createNodeCanvasFactory();
  const canvasFactory = new NodeCanvasFactory();
  const canvasAndContext = canvasFactory.create(
    Math.floor(viewport.width),
    Math.floor(viewport.height)
  );

  await page.render({
    canvasContext: canvasAndContext.context,
    viewport,
    canvasFactory,
  }).promise;

  const fullCanvas = canvasAndContext.canvas;
  const canvasModule = await getCanvas();

  // Extract each image using its bounding box
  const extractedImages: { id: string; imageBuffer: Buffer }[] = [];

  for (const img of imageMetadata) {
    try {
      // Mistral coordinates are in PDF points (72 DPI), need to scale to canvas pixels
      const x = Math.floor(img.topLeftX * scale);
      const y = Math.floor(img.topLeftY * scale);
      const width = Math.floor((img.bottomRightX - img.topLeftX) * scale);
      const height = Math.floor((img.bottomRightY - img.topLeftY) * scale);

      // Create a new canvas for the cropped image
      const croppedCanvas = canvasModule.createCanvas(width, height);
      const croppedContext = croppedCanvas.getContext('2d');

      // Copy the image region from the full page
      croppedContext.drawImage(
        fullCanvas,
        x, y, width, height,  // Source rectangle
        0, 0, width, height   // Destination rectangle
      );

      const imageBuffer = croppedCanvas.toBuffer('image/png');
      extractedImages.push({ id: img.id, imageBuffer });

      console.log(`  ✅ Extracted ${img.id}: ${width}x${height}px, ${(imageBuffer.length / 1024).toFixed(1)}KB`);
    } catch (imgError: any) {
      console.error(`  ❌ Failed to extract ${img.id}:`, imgError.message);
    }
  }

  return extractedImages;
}

/**
 * Extract text from ONLY specific pages that have corrupted formulas
 * This is much faster than full-document OCR as it only processes affected pages
 *
 * Enhanced with optional image extraction for poor/graphics pages
 *
 * @param buffer - PDF file buffer
 * @param corruptedPages - Set of page numbers (1-indexed) with corrupted formulas
 * @param imageOptions - Optional image extraction configuration
 * @returns Map of pageNum -> OCR text for each processed page
 */
export async function extractTextFromSpecificPages(
  buffer: Buffer,
  corruptedPages: Set<number>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _imageOptions?: Record<string, unknown>
): Promise<Map<number, string>> {
  console.log(`🎯 Starting TARGETED OCR on ${corruptedPages.size} pages: [${Array.from(corruptedPages).join(', ')}]`);

  const results = new Map<number, string>();

  if (corruptedPages.size === 0) {
    return results;
  }

  try {
    // Convert Buffer to Uint8Array (pdfjs-dist requires Uint8Array, not Buffer)
    const uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // Load PDF document with CanvasFactory configured for OCR rendering
    const pdfDoc = await loadPdfDocument(uint8Array);

    const numPages = pdfDoc.numPages;
    console.log(`📄 PDF has ${numPages} pages, OCR-ing only ${corruptedPages.size} pages`);

    for (const pageNum of Array.from(corruptedPages)) {
      if (pageNum < 1 || pageNum > numPages) {
        console.log(`⚠️ Page ${pageNum} out of range, skipping`);
        continue;
      }

      console.log(`🔍 OCR page ${pageNum}...`);

      try {
        // Render page to image
        const imageBuffer = await renderPageToImage(pdfDoc, pageNum, 2.0);

        const base64Image = imageBuffer.toString('base64');
        const imageDataUrl = `data:image/png;base64,${base64Image}`;

        // Try Mistral OCR first for images, fallback to GPT-4 Vision
        let pageText = '';
        if (process.env.MISTRAL) {
          pageText = await extractTextFromImageWithMistral(imageDataUrl);
        }

        // Fallback to GPT-4 Vision if Mistral failed
        if (!pageText || pageText.trim().length === 0) {
          pageText = await extractTextWithMathOCR(imageDataUrl);
        }

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
