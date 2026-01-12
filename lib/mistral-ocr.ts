/**
 * Mistral OCR Service
 *
 * Uses Mistral's dedicated OCR API for reliable document text extraction.
 * Much more reliable than LLM-based OCR (no content refusals) and cheaper.
 *
 * Pricing: ~$1 per 1000 pages
 */

import { Mistral } from '@mistralai/mistralai';

// Lazy-initialize Mistral client (to ensure API key is loaded from env)
let mistral: Mistral | null = null;

function getMistralClient(): Mistral {
  if (!mistral) {
    mistral = new Mistral({
      apiKey: process.env.MISTRAL || '',
    });
  }
  return mistral;
}

/**
 * Image metadata detected by Mistral OCR
 * Note: imageBase64 is only populated if includeImageBase64: true is set in the request
 */
export interface MistralImageMetadata {
  id: string;
  topLeftX: number;
  topLeftY: number;
  bottomRightX: number;
  bottomRightY: number;
  imageBase64: string | null; // Base64 data URL (e.g., "data:image/jpeg;base64,...")
  imageAnnotation: any | null;
}

/**
 * Page data from Mistral OCR
 */
export interface MistralPageData {
  index: number;
  markdown: string;
  images?: MistralImageMetadata[];
  tables?: any[];
  hyperlinks?: any[];
  header?: string;
  footer?: string;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface MistralOCRResult {
  text: string;
  pages: number;
  success: boolean;
  error?: string;
  pagesData?: MistralPageData[]; // Raw page data including image locations
}

/**
 * Extract text from a PDF using Mistral OCR
 *
 * @param pdfBuffer - PDF file as Buffer
 * @param filename - Original filename (for logging)
 * @returns Extracted text from all pages
 */
export async function extractTextWithMistralOCR(
  pdfBuffer: Buffer,
  filename: string = 'document.pdf'
): Promise<MistralOCRResult> {
  console.log(`🔮 [Mistral OCR] Starting extraction for: ${filename}`);

  if (!process.env.MISTRAL) {
    console.error('❌ [Mistral OCR] MISTRAL API key not configured');
    return {
      text: '',
      pages: 0,
      success: false,
      error: 'MISTRAL API key not configured',
    };
  }

  try {
    // Convert buffer to base64
    const base64Pdf = pdfBuffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

    console.log(`📄 [Mistral OCR] PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

    // Call Mistral OCR API with image extraction enabled
    const client = getMistralClient();
    const response = await client.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        documentUrl: dataUrl,
      },
      includeImageBase64: true, // ← CRITICAL: Extract images as base64
    });

    // Extract text from all pages
    const pages = response.pages || [];
    const pageTexts: string[] = [];

    for (const page of pages) {
      if (page.markdown) {
        pageTexts.push(page.markdown);
      }
    }

    const fullText = pageTexts.join('\n\n---\n\n');

    console.log(`✅ [Mistral OCR] Extracted ${fullText.length} characters from ${pages.length} pages`);

    return {
      text: fullText,
      pages: pages.length,
      success: true,
      pagesData: pages as MistralPageData[], // Include raw page data with image locations
    };
  } catch (error: any) {
    console.error('❌ [Mistral OCR] Error:', error.message);

    // Log more details if available
    if (error.response) {
      console.error('❌ [Mistral OCR] Response status:', error.response.status);
      console.error('❌ [Mistral OCR] Response data:', error.response.data);
    }

    return {
      text: '',
      pages: 0,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Extract text from a single image using Mistral OCR
 *
 * @param imageDataUrl - Base64 encoded image data URL (data:image/png;base64,...)
 * @returns Extracted text
 */
/**
 * Extract images from Mistral OCR result
 * This uses the imageBase64 field directly from Mistral (much faster than rendering PDF)
 *
 * @param mistralResult - Result from extractTextWithMistralOCR
 * @param onlyPages - Optional: only extract from these page numbers (0-indexed)
 * @returns Array of { pageNum, imageId, base64Data }
 */
export function extractImagesFromMistralResult(
  mistralResult: MistralOCRResult,
  onlyPages?: Set<number>
): Array<{ pageNum: number; imageId: string; base64Data: string }> {
  if (!mistralResult.success || !mistralResult.pagesData) {
    return [];
  }

  const extractedImages: Array<{ pageNum: number; imageId: string; base64Data: string }> = [];

  for (const page of mistralResult.pagesData) {
    // Filter by onlyPages if specified
    if (onlyPages && !onlyPages.has(page.index)) {
      continue;
    }

    if (!page.images || page.images.length === 0) {
      continue;
    }

    for (const img of page.images) {
      if (img.imageBase64) {
        extractedImages.push({
          pageNum: page.index + 1, // Convert to 1-indexed
          imageId: img.id,
          base64Data: img.imageBase64,
        });
      }
    }
  }

  console.log(`✅ Extracted ${extractedImages.length} images from Mistral OCR result`);
  return extractedImages;
}

/**
 * Extract text from a single image using Mistral OCR
 *
 * @param imageDataUrl - Base64 encoded image data URL (data:image/png;base64,...)
 * @returns Extracted text
 */
export async function extractTextFromImageWithMistral(
  imageDataUrl: string
): Promise<string> {
  console.log('🔮 [Mistral OCR] Extracting text from image...');

  if (!process.env.MISTRAL) {
    console.error('❌ [Mistral OCR] MISTRAL API key not configured');
    return '';
  }

  try {
    // Mistral OCR accepts images too
    const client = getMistralClient();
    const response = await client.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        imageUrl: imageDataUrl,
      },
      includeImageBase64: true, // Extract embedded images
    });

    const pages = response.pages || [];
    if (pages.length > 0 && pages[0].markdown) {
      const text = pages[0].markdown;
      console.log(`✅ [Mistral OCR] Extracted ${text.length} characters from image`);
      return text;
    }

    return '';
  } catch (error: any) {
    console.error('❌ [Mistral OCR] Error extracting from image:', error.message);
    return '';
  }
}
