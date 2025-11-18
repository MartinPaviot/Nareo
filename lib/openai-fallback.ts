/**
 * OpenAI Fallback Utilities
 * 
 * Provides fallback text extraction using OpenAI GPT-4o Vision
 * when traditional parsers fail or extract corrupted/insufficient text
 */

import { openai } from './openai-vision';
import { extractTextFromImage } from './openai-vision';

/**
 * Calculate readability score for extracted text
 * Returns a score between 0 and 1 indicating text quality
 * 
 * @param text - Text to analyze
 * @returns Object with score and metrics
 */
export function calculateReadabilityScore(text: string): {
  score: number;
  readableCharsRatio: number;
  readableWordsRatio: number;
  specialCharsRatio: number;
  averageWordLength: number;
  length: number;
} {
  if (!text || text.length === 0) {
    return { 
      score: 0, 
      readableCharsRatio: 0, 
      readableWordsRatio: 0, 
      specialCharsRatio: 0,
      averageWordLength: 0,
      length: 0 
    };
  }

  // Define readable character set
  const readableChars = /[a-zA-ZÀ-ÿ0-9\s.,;:!?'"()\-]/;
  
  // Count readable characters
  let readableCharCount = 0;
  for (const char of text) {
    if (readableChars.test(char)) {
      readableCharCount++;
    }
  }
  
  const readableCharsRatio = readableCharCount / text.length;
  
  // Count special/unusual characters that indicate corruption
  const specialChars = text.match(/[éèêëîïôöûüçàâæœÉÈÊËÎÏÔÖÛÜÇÀÂÆŒ]/g) || [];
  const specialCharsRatio = specialChars.length / text.length;
  
  // Analyze words
  const words = text.split(/\s+/).filter(w => w.length > 0);
  let readableWordCount = 0;
  
  for (const word of words) {
    // A word is readable if it contains at least one BASIC Latin letter (not just accented)
    if (/[a-zA-Z]/.test(word)) {
      readableWordCount++;
    }
  }
  
  const readableWordsRatio = words.length > 0 ? readableWordCount / words.length : 0;
  
  // Calculate average word length (corrupted text often has very short "words")
  const totalWordLength = words.reduce((sum, word) => sum + word.length, 0);
  const averageWordLength = words.length > 0 ? totalWordLength / words.length : 0;
  
  // Detect patterns of corruption:
  // 1. Excessive special characters (> 10% of text) - more strict
  // 2. Very short average word length (< 4 characters) - more strict
  // 3. Low ratio of words with basic Latin letters (< 85%) - more strict
  const hasExcessiveSpecialChars = specialCharsRatio > 0.10;
  const hasShortWords = averageWordLength < 4;
  const hasLowLatinRatio = readableWordsRatio < 0.85;
  
  // Combined score: weighted average
  // 60% weight on character ratio, 40% on word ratio
  let score = (readableCharsRatio * 0.6) + (readableWordsRatio * 0.4);
  
  // Apply penalties for corruption indicators
  if (hasExcessiveSpecialChars) {
    score *= 0.5; // Reduce by 50%
  }
  
  if (hasShortWords) {
    score *= 0.6; // Reduce by 40%
  }
  
  if (hasLowLatinRatio) {
    score *= 0.7; // Reduce by 30%
  }
  
  return {
    score,
    readableCharsRatio,
    readableWordsRatio,
    specialCharsRatio,
    averageWordLength,
    length: text.length,
  };
}

/**
 * Extract text from PDF using OpenAI Vision (page by page OCR)
 * This is used when pdf2json produces corrupted or unreadable text
 * 
 * Uses pdfjs-dist + canvas to render pages as images, then OCR with Vision
 * 
 * @param buffer - PDF file buffer
 * @returns Extracted text content
 */
export async function extractTextFromPdfWithVision(buffer: Buffer): Promise<string> {
  console.log('🔍 Using OpenAI Vision OCR for PDF text extraction...');
  
  try {
    // Use the new robust OCR system with pdfjs-dist + canvas
    const { extractTextFromPdfWithOCR } = await import('./pdf-ocr-server');
    const text = await extractTextFromPdfWithOCR(buffer);
    return text;
  } catch (error: any) {
    console.error('❌ Vision OCR fallback failed:', error.message);
    throw new Error(`Vision OCR failed: ${error.message}`);
  }
}

/**
 * Extract text from DOCX using OpenAI when mammoth fails
 * @param buffer - DOCX file buffer
 * @returns Extracted text content
 */
export async function extractTextWithOpenAIFromDocx(buffer: Buffer): Promise<string> {
  try {
    console.log('🤖 Using OpenAI fallback for DOCX extraction...');
    
    // Convert DOCX buffer to base64
    const base64Doc = buffer.toString('base64');
    
    // Call OpenAI with clear instructions
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Tu reçois un document Word encodé en base64. Tu dois retourner uniquement le texte lisible avec des retours à la ligne raisonnables. Ne fournis aucun commentaire, seulement le texte extrait.',
        },
        {
          role: 'user',
          content: `Voici un document Word en base64. Extrais tout le texte lisible :

${base64Doc.substring(0, 50000)}

Retourne UNIQUEMENT le texte extrait, sans commentaire.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    });

    const extractedText = response.choices[0].message.content || '';
    
    console.log('✅ OpenAI extracted', extractedText.length, 'characters from DOCX');
    console.log('📋 First 200 characters:', extractedText.substring(0, 200));
    
    return extractedText.trim();
  } catch (error: any) {
    console.error('❌ Error extracting DOCX text with OpenAI:', error.message);
    throw new Error(`OpenAI DOCX extraction failed: ${error.message}`);
  }
}

/**
 * Validate extracted text quality
 * @param text - Extracted text to validate
 * @param minLength - Minimum acceptable length (default: 300)
 * @returns Object with isValid flag and reason if invalid
 */
export function validateExtractedText(
  text: string,
  minLength: number = 300
): { isValid: boolean; reason?: string; length: number } {
  const trimmedText = text.trim();
  const length = trimmedText.length;
  
  // Check minimum length
  if (length < minLength) {
    return {
      isValid: false,
      reason: `Text too short (${length} characters). Minimum required: ${minLength} characters.`,
      length,
    };
  }
  
  // Check if text contains actual sentences (not just fragments)
  const sentences = trimmedText.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length < 3) {
    return {
      isValid: false,
      reason: 'Text appears to be too fragmented. Need at least 3 complete sentences.',
      length,
    };
  }
  
  // Check if text has reasonable word count
  const words = trimmedText.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 50) {
    return {
      isValid: false,
      reason: `Text has too few words (${words.length}). Minimum required: 50 words.`,
      length,
    };
  }
  
  return {
    isValid: true,
    length,
  };
}

/**
 * Truncate text intelligently at sentence boundaries
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 20000)
 * @returns Truncated text
 */
export function truncateTextIntelligently(text: string, maxLength: number = 20000): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  console.log(`📏 Truncating text from ${text.length} to ~${maxLength} characters...`);
  
  // Find a sentence boundary near maxLength
  const searchStart = Math.max(0, maxLength - 200);
  const searchEnd = Math.min(text.length, maxLength + 200);
  const searchText = text.substring(searchStart, searchEnd);
  
  // Look for sentence endings
  const sentenceEndings = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
  let bestBreakPoint = -1;
  
  for (const ending of sentenceEndings) {
    const index = searchText.lastIndexOf(ending);
    if (index !== -1) {
      bestBreakPoint = searchStart + index + ending.length;
      break;
    }
  }
  
  // If no sentence boundary found, just cut at maxLength
  if (bestBreakPoint === -1) {
    bestBreakPoint = maxLength;
  }
  
  const truncated = text.substring(0, bestBreakPoint).trim();
  console.log(`✅ Truncated to ${truncated.length} characters at sentence boundary`);
  
  return truncated;
}
