/**
 * PDF Parser - Uses pdf2json library for REAL text extraction
 * 
 * Extracts actual text content from PDFs without hallucination
 * This ensures the learning content matches the actual PDF content
 */

import PDFParser from 'pdf2json';
import { promisify } from 'util';

export async function parsePDF(buffer: Buffer): Promise<string> {
  console.log('📄 Parsing PDF document (buffer size:', buffer.length, 'bytes)');
  
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      console.error('❌ Error parsing PDF:', errData.parserError);
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
                      const decodedText = decodeURIComponent(run.T);
                      extractedText += decodedText + ' ';
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
        
        console.log('✅ Successfully extracted text from PDF');
        console.log('📝 Extracted text length:', extractedText.length, 'characters');
        console.log('📄 Number of pages:', pdfData.Pages?.length || 0);
        console.log('📋 First 300 characters:', extractedText.substring(0, 300));
        
        resolve(cleanPDFText(extractedText));
      } catch (error: any) {
        console.error('❌ Error processing PDF data:', error.message);
        reject(error);
      }
    });
    
    // Parse the buffer
    pdfParser.parseBuffer(buffer);
  });
}

export function cleanPDFText(text: string): string {
  // Remove excessive whitespace while preserving structure
  let cleaned = text.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs to single space
  
  // Normalize line breaks (max 2 consecutive)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Remove lines that are just whitespace
  const lines = cleaned.split('\n');
  cleaned = lines
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
  
  return cleaned.trim();
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
