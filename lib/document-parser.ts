/**
 * Document Parser - Word/DOCX Support
 * 
 * Extracts text content from Word documents (.docx)
 * Uses mammoth first, falls back to OpenAI if needed
 */

import { extractTextWithOpenAIFromDocx, validateExtractedText } from './openai-fallback';

/**
 * Parse a DOCX file and extract text content
 */
export async function parseDocx(buffer: Buffer): Promise<string> {
  console.log('📄 Parsing DOCX document (buffer size:', buffer.length, 'bytes)');
  
  // Try mammoth first
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    if (result.messages && result.messages.length > 0) {
      console.log('⚠️ DOCX parsing warnings:', result.messages);
    }
    
    const cleaned = cleanDocumentText(text);
    
    // Check if text is sufficient (minimum 300 characters)
    if (cleaned.length >= 300) {
      console.log('✅ mammoth extraction successful:', cleaned.length, 'characters');
      return cleaned;
    }
    
    // Text is insufficient, try OpenAI fallback
    console.log('⚠️ mammoth extracted insufficient text:', cleaned.length, 'characters (minimum: 300)');
    console.log('🔄 Attempting OpenAI fallback...');
    
    const openaiText = await extractTextWithOpenAIFromDocx(buffer);
    const cleanedOpenaiText = cleanDocumentText(openaiText);
    
    if (cleanedOpenaiText.length >= 300) {
      console.log('✅ OpenAI fallback successful:', cleanedOpenaiText.length, 'characters');
      return cleanedOpenaiText;
    }
    
    // Even OpenAI couldn't extract enough text
    throw new Error(`Insufficient text extracted from DOCX: ${cleanedOpenaiText.length} characters (minimum: 300)`);
    
  } catch (error: any) {
    console.error('❌ DOCX parsing failed:', error.message);
    
    // If mammoth failed completely, try OpenAI as last resort
    if (error.message.includes('mammoth') || error.message.includes('Cannot find module')) {
      console.log('🔄 mammoth failed, trying OpenAI as last resort...');
      try {
        const openaiText = await extractTextWithOpenAIFromDocx(buffer);
        const cleanedOpenaiText = cleanDocumentText(openaiText);
        
        if (cleanedOpenaiText.length >= 300) {
          console.log('✅ OpenAI fallback successful:', cleanedOpenaiText.length, 'characters');
          return cleanedOpenaiText;
        }
      } catch (openaiError: any) {
        console.error('❌ OpenAI fallback also failed:', openaiError.message);
      }
    }
    
    throw error;
  }
}

/**
 * Clean and normalize extracted document text
 */
export function cleanDocumentText(text: string): string {
  // Remove excessive whitespace
  let cleaned = text.replace(/\s+/g, ' ');
  
  // Normalize line breaks
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Remove special characters that might cause issues
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Extract title from document text
 * Tries to find the first heading or uses filename as fallback
 */
export function extractDocumentTitle(text: string, filename: string): string {
  // Try to extract title from first few lines
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    // If first line looks like a title (not too long, reasonable length)
    if (firstLine.length >= 5 && firstLine.length <= 100) {
      return firstLine;
    }
  }
  
  // Fallback to filename without extension
  return filename
    .replace(/\.docx?$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Split document text into logical sections
 * Useful for creating multiple chapters from a single document
 */
export function splitIntoSections(text: string, maxSections: number = 3): string[] {
  // Try to split by common heading patterns
  const headingPatterns = [
    /\n\s*Chapter \d+[:\s]/gi,
    /\n\s*Section \d+[:\s]/gi,
    /\n\s*Part \d+[:\s]/gi,
    /\n\s*\d+\.\s+[A-Z]/g,
  ];
  
  let sections: string[] = [];
  
  // Try each pattern
  for (const pattern of headingPatterns) {
    const matches = text.split(pattern);
    if (matches.length > 1 && matches.length <= maxSections * 2) {
      sections = matches.filter(s => s.trim().length > 100);
      if (sections.length >= 2) {
        break;
      }
    }
  }
  
  // If no clear sections found, split by length
  if (sections.length < 2) {
    const chunkSize = Math.ceil(text.length / maxSections);
    sections = [];
    
    for (let i = 0; i < maxSections; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.substring(start, end);
      
      if (chunk.trim().length > 100) {
        sections.push(chunk.trim());
      }
    }
  }
  
  // Ensure we have exactly maxSections
  if (sections.length > maxSections) {
    sections = sections.slice(0, maxSections);
  } else if (sections.length < maxSections && sections.length > 0) {
    // If we have fewer sections, split the longest one
    while (sections.length < maxSections) {
      const longestIdx = sections.reduce((maxIdx, section, idx, arr) => 
        section.length > arr[maxIdx].length ? idx : maxIdx, 0
      );
      
      const longest = sections[longestIdx];
      const midPoint = Math.floor(longest.length / 2);
      
      // Find a good break point near the middle (paragraph break)
      let breakPoint = longest.indexOf('\n\n', midPoint);
      if (breakPoint === -1 || breakPoint > longest.length * 0.75) {
        breakPoint = longest.indexOf('. ', midPoint);
        if (breakPoint !== -1) breakPoint += 1;
      }
      
      if (breakPoint === -1 || breakPoint < midPoint * 0.5) {
        breakPoint = midPoint;
      }
      
      const part1 = longest.substring(0, breakPoint).trim();
      const part2 = longest.substring(breakPoint).trim();
      
      sections.splice(longestIdx, 1, part1, part2);
    }
  }
  
  return sections.filter(s => s.length > 50);
}
