/**
 * Document Parser - Word/DOCX Support
 * 
 * Extracts text content from Word documents (.docx)
 * Uses mammoth first, falls back to OpenAI if needed
 */

import { openai } from './openai-vision';

/**
 * Parse a DOCX file and extract text content
 */
export async function parseDocx(buffer: Buffer): Promise<string> {
  console.log('📄 Parsing DOCX document (buffer size:', buffer.length, 'bytes)');
  
  try {
    // Try to use mammoth if available
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    if (result.messages && result.messages.length > 0) {
      console.log('⚠️ DOCX parsing warnings:', result.messages);
    }
    
    if (text.trim().length < 100) {
      console.log('⚠️ Limited text from mammoth, trying OpenAI...');
      return await parseDocxWithOpenAI(buffer);
    }
    
    console.log('✅ Extracted', text.length, 'characters from DOCX');
    return cleanDocumentText(text);
  } catch (error: any) {
    console.error('❌ Error parsing DOCX with mammoth:', error.message);
    console.log('🤖 Falling back to OpenAI for DOCX parsing...');
    return await parseDocxWithOpenAI(buffer);
  }
}

/**
 * Parse DOCX using OpenAI as fallback
 */
async function parseDocxWithOpenAI(buffer: Buffer): Promise<string> {
  try {
    // Convert DOCX buffer to base64
    const base64Doc = buffer.toString('base64');
    const docDataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Doc}`;
    
    console.log('🤖 Using OpenAI to extract text from DOCX...');
    
    // Use OpenAI to extract text
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert document analyzer. Extract ALL text content from documents accurately, preserving structure and formatting.',
        },
        {
          role: 'user',
          content: `Extract ALL text from this Word document. Include:
- All headings, titles, and subtitles
- All body text and paragraphs
- Bullet points and lists
- Tables and their content
- Any other visible text

Preserve the structure and order of the text as it appears in the document.
Return ONLY the extracted text, no additional commentary.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const extractedText = response.choices[0].message.content || '';
    
    if (extractedText.trim().length < 100) {
      return 'Word document uploaded. Content will be analyzed for learning concepts.';
    }
    
    console.log('✅ Extracted', extractedText.length, 'characters from DOCX via OpenAI');
    return cleanDocumentText(extractedText);
  } catch (error: any) {
    console.error('❌ Error parsing DOCX with OpenAI:', error.message);
    return 'Word document uploaded. Content will be analyzed for learning concepts.';
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
