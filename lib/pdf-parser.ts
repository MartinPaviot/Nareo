/**
 * PDF Parser - Uses pdf2json library for REAL text extraction
 * 
 * Extracts actual text content from PDFs without hallucination
 * This ensures the learning content matches the actual PDF content
 */

import PDFParser from 'pdf2json';
import { 
  calculateReadabilityScore, 
  extractTextFromPdfWithVision, 
  validateExtractedText 
} from './openai-fallback';

/**
 * Check if text is truly unreadable and needs OCR fallback
 * Uses simplified logic with clear thresholds
 */
function isTextUnreadable(text: string): { unreadable: boolean; reason: string } {
  const length = text.length;
  
  // 1. Text too short
  if (length < 300) {
    return { unreadable: true, reason: `Text too short (${length} chars < 300)` };
  }
  
  // 2. Calculate basic ratios
  const readableChars = /[a-zA-ZÀ-ÿ0-9\s.,;:!?'"()\-]/;
  let readableCharCount = 0;
  for (const char of text) {
    if (readableChars.test(char)) {
      readableCharCount++;
    }
  }
  const readableCharsRatio = readableCharCount / length;
  
  // 3. Calculate word ratio
  const words = text.split(/\s+/).filter(w => w.length > 0);
  let readableWordCount = 0;
  for (const word of words) {
    if (/[a-zA-Z]/.test(word)) {
      readableWordCount++;
    }
  }
  const readableWordsRatio = words.length > 0 ? readableWordCount / words.length : 0;
  
  // 4. Apply simple thresholds
  if (readableCharsRatio < 0.7) {
    return { 
      unreadable: true, 
      reason: `Low readable chars ratio (${readableCharsRatio.toFixed(2)} < 0.7)` 
    };
  }
  
  if (readableWordsRatio < 0.5) {
    return { 
      unreadable: true, 
      reason: `Low readable words ratio (${readableWordsRatio.toFixed(2)} < 0.5)` 
    };
  }
  
  // Text is readable
  return { unreadable: false, reason: 'Text is readable' };
}

export async function parsePDF(buffer: Buffer): Promise<string> {
  console.log('📄 Parsing PDF document (buffer size:', buffer.length, 'bytes)');
  
  // Try pdf2json first
  try {
    const text = await parsePDFWithPdf2Json(buffer);
    const cleaned = cleanPDFText(text);
    
    // Check if text is unreadable using simplified logic
    const readabilityCheck = isTextUnreadable(cleaned);
    
    console.log('📊 Readability check:');
    console.log('   - Text length:', cleaned.length);
    console.log('   - Status:', readabilityCheck.unreadable ? '❌ UNREADABLE' : '✅ READABLE');
    console.log('   - Reason:', readabilityCheck.reason);
    
    if (!readabilityCheck.unreadable) {
      console.log('✅ pdf2json extraction successful: text is readable');
      console.log('📋 First 300 chars:', cleaned.substring(0, 300));
      return cleaned;
    }
    
    // Text is unreadable, use Vision fallback
    console.log('⚠️ pdf2json extracted unreadable text:', readabilityCheck.reason);
    console.log('📋 Sample of problematic text:', cleaned.substring(0, 200));
    console.log('🔄 Activating Vision OCR fallback...');
    
    const visionText = await extractTextFromPdfWithVision(buffer);
    const cleanedVisionText = cleanPDFText(visionText);
    
    // Validate Vision result
    const validation = validateExtractedText(cleanedVisionText, 300);
    
    if (validation.isValid) {
      console.log('✅ Vision OCR fallback successful:', validation.length, 'characters');
      return cleanedVisionText;
    }
    
    // Even Vision couldn't extract enough text
    throw new Error(`Insufficient text extracted from PDF after Vision OCR. ${validation.reason}`);
    
  } catch (error: any) {
    console.error('❌ PDF parsing failed:', error.message);
    
    // If pdf2json failed completely, try Vision as last resort
    if (error.message.includes('Failed to parse PDF')) {
      console.log('🔄 pdf2json failed completely, trying Vision OCR as last resort...');
      try {
        const visionText = await extractTextFromPdfWithVision(buffer);
        const cleanedVisionText = cleanPDFText(visionText);
        
        const validation = validateExtractedText(cleanedVisionText, 300);
        if (validation.isValid) {
          console.log('✅ Vision OCR fallback successful:', validation.length, 'characters');
          return cleanedVisionText;
        }
      } catch (visionError: any) {
        console.error('❌ Vision OCR fallback also failed:', visionError.message);
      }
    }
    
    throw error;
  }
}

/**
 * Parse PDF using pdf2json library
 * @param buffer - PDF file buffer
 * @returns Extracted text
 */
async function parsePDFWithPdf2Json(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      console.error('❌ Error parsing PDF with pdf2json:', errData.parserError);
      reject(new Error(`Failed to parse PDF: ${errData.parserError}`));
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        console.log('🔍 Extracting text from parsed PDF data...');
        
        // Extract text from all pages
        let extractedText = '';
        
        if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
          for (const page of pdfData.Pages) {
            if (page.Texts && Array.isArray(page.Texts)) {
              for (const textItem of page.Texts) {
                if (textItem.R && Array.isArray(textItem.R)) {
                  for (const run of textItem.R) {
                    if (run.T) {
                      // Decode URI component (pdf2json encodes text)
                      try {
                        const decodedText = decodeURIComponent(run.T);
                        extractedText += decodedText + ' ';
                      } catch (decodeError) {
                        // If decoding fails, use raw text
                        extractedText += run.T + ' ';
                      }
                    }
                  }
                }
              }
              extractedText += '\n'; // New line after each text block
            }
          }
        }
        
        extractedText = extractedText.trim();
        
        if (!extractedText || extractedText.length === 0) {
          reject(new Error('No text could be extracted from the PDF. The PDF might be image-based or encrypted.'));
          return;
        }
        
        console.log('✅ pdf2json extracted text');
        console.log('📝 Extracted text length:', extractedText.length, 'characters');
        console.log('📄 Number of pages:', pdfData.Pages?.length || 0);
        console.log('📋 First 300 characters:', extractedText.substring(0, 300));
        
        resolve(extractedText);
      } catch (error: any) {
        console.error('❌ Error processing PDF data:', error.message);
        reject(error);
      }
    });
    
    // Parse the buffer
    pdfParser.parseBuffer(buffer);
  });
}

/**
 * Advanced normalization for PDF text
 * Handles spaced letters, control characters, and formatting issues
 */
export function cleanAndNormalizePdfText(text: string): string {
  console.log('🧹 Starting advanced PDF text normalization...');
  console.log('📏 Original length:', text.length);
  
  // Step 1: Remove control characters
  text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Step 2: Detect and merge spaced letters
  // Pattern: "C  O  U  R  S" → "COURS"
  // This handles uppercase letters separated by spaces
  text = text.replace(/([A-ZÀ-ÿ])(\s{1,3})(?=[A-ZÀ-ÿ](\s{1,3}|[A-ZÀ-ÿ]|$))/g, '$1');
  
  // Handle lowercase spaced letters: "i n f o" → "info"
  text = text.replace(/\b([a-zà-ÿ])(\s{1,2})(?=[a-zà-ÿ](\s{1,2}|$))/g, '$1');
  
  // Step 3: Compress multiple spaces to single space
  text = text.replace(/[ \t]+/g, ' ');
  
  // Step 4: Normalize line breaks (max 2 consecutive)
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Step 5: Clean up lines
  const lines = text.split('\n');
  const cleanedLines = lines
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  text = cleanedLines.join('\n');
  
  console.log('✅ Normalized length:', text.length);
  console.log('📋 First 300 chars after normalization:', text.substring(0, 300));
  
  return text.trim();
}

/**
 * Legacy clean function - kept for backward compatibility
 * Use cleanAndNormalizePdfText for better results
 */
export function cleanPDFText(text: string): string {
  return cleanAndNormalizePdfText(text);
}

export function extractTitle(text: string, filename: string = 'PDF Document'): string {
  // Try to extract title from first few lines
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  if (lines.length > 0) {
    // Look for a title-like line (not too short, not too long, has letters)
    for (const line of lines.slice(0, 5)) {
      if (line.length >= 10 && line.length <= 100 && /[a-zA-Z]/.test(line)) {
        // Avoid lines that look like headers/footers (page numbers, dates, etc.)
        if (!/^\d+$/.test(line) && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(line)) {
          return line;
        }
      }
    }
  }
  
  // Fallback to filename without extension
  return filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
}
