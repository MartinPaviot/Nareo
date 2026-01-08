/**
 * Mistral OCR Service
 *
 * Uses Mistral's dedicated OCR API for reliable document text extraction.
 * Much more reliable than LLM-based OCR (no content refusals) and cheaper.
 *
 * Pricing: ~$1 per 1000 pages
 */

import { Mistral } from '@mistralai/mistralai';

// Initialize Mistral client
const mistral = new Mistral({
  apiKey: process.env.MISTRAL || '',
});

export interface MistralOCRResult {
  text: string;
  pages: number;
  success: boolean;
  error?: string;
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

    // Call Mistral OCR API
    const response = await mistral.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        documentUrl: dataUrl,
      },
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
    const response = await mistral.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        imageUrl: imageDataUrl,
      },
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
