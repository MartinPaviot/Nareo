/**
 * PDF OCR Server - Page-by-page OCR using pdfjs-dist + canvas + OpenAI Vision
 * 
 * This module handles PDF files that cannot be parsed with pdf2json
 * by rendering each page as an image and using OCR
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';
import { extractTextFromImage as visionOCR } from './openai-vision';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

/**
 * Extract text from PDF using page-by-page OCR
 * @param buffer - PDF file buffer
 * @returns Extracted text from all pages
 */
export async function extractTextFromPdfWithOCR(buffer: Buffer): Promise<string> {
  console.log('🔬 Starting page-by-page OCR extraction...');
  
  try {
    // Load PDF document
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      standardFontDataUrl: 'pdfjs-dist/standard_fonts/',
    });
    
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    
    console.log(`📄 PDF loaded: ${numPages} pages`);
    
    // Extract text from each page
    const pageTexts: string[] = [];
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      console.log(`🔍 Processing page ${pageNum}/${numPages}...`);
      
      try {
        const pageText = await extractTextFromPage(pdfDocument, pageNum);
        
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
 * Extract text from a single PDF page using OCR
 * @param pdfDocument - PDF document object
 * @param pageNum - Page number (1-indexed)
 * @returns Extracted text from the page
 */
async function extractTextFromPage(pdfDocument: any, pageNum: number): Promise<string> {
  // Get the page
  const page = await pdfDocument.getPage(pageNum);
  
  // Get viewport at scale 2.0 for better quality
  const viewport = page.getViewport({ scale: 2.0 });
  
  // Create canvas
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');
  
  // Render page to canvas
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };
  
  await page.render(renderContext).promise;
  
  // Convert canvas to PNG buffer
  const imageBuffer = canvas.toBuffer('image/png');
  
  // Convert to base64 data URL for OpenAI Vision
  const base64Image = imageBuffer.toString('base64');
  const imageDataUrl = `data:image/png;base64,${base64Image}`;
  
  // Extract text using OpenAI Vision OCR
  const text = await visionOCR(imageDataUrl);
  
  return text;
}
