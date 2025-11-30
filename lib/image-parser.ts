/**
 * Image Parser for Nareo
 * Extracts text and concepts from uploaded images (screenshots, photos of notes, etc.)
 */

export async function parseImage(buffer: Buffer): Promise<string> {
  console.log('📸 Parsing image (buffer size:', buffer.length, 'bytes)');
  
  try {
    // Convert buffer to base64 for GPT-4 Vision
    const base64Image = buffer.toString('base64');
    const mimeType = detectImageType(buffer);
    
    console.log('✅ Image converted to base64, type:', mimeType);
    
    // Return the base64 data URL for GPT-4 Vision
    return `data:${mimeType};base64,${base64Image}`;
  } catch (error) {
    console.error('❌ Error parsing image:', error);
    throw new Error('Unable to process image file');
  }
}

function detectImageType(buffer: Buffer): string {
  // Check magic numbers to detect image type
  const header = buffer.toString('hex', 0, 4);
  
  if (header.startsWith('ffd8ff')) {
    return 'image/jpeg';
  } else if (header.startsWith('89504e47')) {
    return 'image/png';
  } else if (header.startsWith('47494638')) {
    return 'image/gif';
  } else if (header.startsWith('52494646')) {
    return 'image/webp';
  }
  
  // Default to jpeg
  return 'image/jpeg';
}

export function extractTitle(text: string): string {
  // Try to find a title in the first few lines
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    // If first line is short and looks like a title
    if (firstLine.length < 100 && firstLine.length > 5) {
      return firstLine;
    }
  }
  
  return 'Course Chapter';
}

export function cleanImageText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
