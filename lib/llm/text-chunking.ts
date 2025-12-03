/**
 * Intelligent Text Chunking
 *
 * Provides smart text segmentation for chapter extraction
 * based on content markers rather than arbitrary character counts.
 */

import { LLM_CONFIG } from './index';

export interface ChapterBoundary {
  index: number;
  title: string;
  startPosition: number;
  endPosition: number;
  text: string;
}

/**
 * Normalize text for matching (remove accents, lowercase, collapse whitespace)
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract significant words from text (remove stop words, short words)
 */
function extractSignificantWords(text: string): string[] {
  const stopWords = new Set([
    // English
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
    'this', 'that', 'these', 'those', 'it', 'its', 'as', 'if', 'when', 'than', 'so', 'what', 'which',
    // French
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'mais', 'dans', 'sur', 'pour',
    'par', 'avec', 'est', 'sont', 'etre', 'avoir', 'qui', 'que', 'ce', 'cette', 'ces',
    // German
    'der', 'die', 'das', 'und', 'oder', 'aber', 'in', 'auf', 'fur', 'mit', 'ist', 'sind', 'sein',
  ]);

  return normalizeForMatching(text)
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
}

/**
 * Calculate word overlap score between two texts
 */
function calculateWordOverlap(text1: string, text2: string): number {
  const words1 = new Set(extractSignificantWords(text1));
  const words2 = new Set(extractSignificantWords(text2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }

  // Jaccard-like score normalized by smaller set
  return overlap / Math.min(words1.size, words2.size);
}

/**
 * Find the position of a text marker in the source text using multiple strategies
 */
function findMarkerPosition(text: string, marker: string, searchStart: number = 0): number {
  const lowerText = text.toLowerCase();
  const lowerMarker = marker.toLowerCase().trim();
  const searchText = text.substring(searchStart);
  const searchTextLower = lowerText.substring(searchStart);

  // Strategy 1: Exact match
  let pos = searchTextLower.indexOf(lowerMarker);
  if (pos !== -1) return searchStart + pos;

  // Strategy 2: Normalized match (without accents)
  const normalizedText = normalizeForMatching(searchText);
  const normalizedMarker = normalizeForMatching(marker);
  pos = normalizedText.indexOf(normalizedMarker);
  if (pos !== -1) {
    // Find approximate position in original text
    const ratio = pos / normalizedText.length;
    return searchStart + Math.floor(ratio * searchText.length);
  }

  // Strategy 3: Match significant words in sequence
  const markerWords = extractSignificantWords(marker);
  if (markerWords.length >= 2) {
    // Try matching consecutive words with flexible spacing
    const pattern = markerWords.slice(0, 4).join('[^a-zA-Z0-9àâäéèêëïîôöùûüç]*');
    try {
      const regex = new RegExp(pattern, 'i');
      const match = regex.exec(searchText);
      if (match) {
        return searchStart + match.index;
      }
    } catch {
      // Invalid regex, skip
    }
  }

  // Strategy 4: Find best matching window using word overlap
  if (markerWords.length >= 2) {
    const windowSize = Math.min(500, marker.length * 3);
    const step = 100;
    let bestScore = 0;
    let bestPos = -1;

    for (let i = 0; i < searchText.length - windowSize; i += step) {
      const window = searchText.substring(i, i + windowSize);
      const score = calculateWordOverlap(marker, window);

      if (score > bestScore && score >= 0.5) { // At least 50% word overlap
        bestScore = score;
        bestPos = searchStart + i;
      }
    }

    if (bestPos !== -1) {
      return bestPos;
    }
  }

  // Strategy 5: Match any single significant word (last resort for short titles)
  if (markerWords.length >= 1) {
    const longestWord = markerWords.reduce((a, b) => a.length > b.length ? a : b);
    if (longestWord.length >= 5) {
      pos = searchTextLower.indexOf(longestWord);
      if (pos !== -1) {
        return searchStart + pos;
      }
    }
  }

  return -1;
}

/**
 * Find position using key concepts from chapter metadata
 */
function findPositionByKeyConcepts(
  text: string,
  keyConcepts: string[],
  searchStart: number = 0
): number {
  if (!keyConcepts || keyConcepts.length === 0) return -1;

  const searchText = text.substring(searchStart);
  let bestPos = -1;
  let bestScore = 0;

  // Try to find each key concept
  for (const concept of keyConcepts) {
    const pos = findMarkerPosition(text, concept, searchStart);
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      // Prefer earlier matches with higher word overlap
      const windowStart = Math.max(0, pos - searchStart - 200);
      const windowEnd = Math.min(searchText.length, pos - searchStart + 200);
      const window = searchText.substring(windowStart, windowEnd);
      const score = calculateWordOverlap(concept, window);

      if (score > bestScore) {
        bestScore = score;
        bestPos = pos;
      }
    }
  }

  return bestPos;
}

/**
 * Find natural text boundaries (sentence endings, paragraph breaks)
 */
function findNaturalBoundary(text: string, position: number, direction: 'before' | 'after', maxDistance: number = 500): number {
  if (direction === 'before') {
    // Look backwards for sentence ending or paragraph
    const searchStart = Math.max(0, position - maxDistance);
    const searchText = text.substring(searchStart, position);

    // Look for paragraph break first
    const paragraphBreak = searchText.lastIndexOf('\n\n');
    if (paragraphBreak !== -1) {
      return searchStart + paragraphBreak + 2;
    }

    // Look for sentence ending
    const sentenceEndings = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
    let bestPos = -1;
    for (const ending of sentenceEndings) {
      const pos = searchText.lastIndexOf(ending);
      if (pos > bestPos) {
        bestPos = pos;
      }
    }
    if (bestPos !== -1) {
      return searchStart + bestPos + 2;
    }

    return position;
  } else {
    // Look forwards for sentence ending or paragraph
    const searchEnd = Math.min(text.length, position + maxDistance);
    const searchText = text.substring(position, searchEnd);

    // Look for paragraph break first
    const paragraphBreak = searchText.indexOf('\n\n');
    if (paragraphBreak !== -1) {
      return position + paragraphBreak;
    }

    // Look for sentence ending
    const sentenceEndings = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
    let bestPos = searchText.length;
    for (const ending of sentenceEndings) {
      const pos = searchText.indexOf(ending);
      if (pos !== -1 && pos < bestPos) {
        bestPos = pos + ending.length;
      }
    }
    return position + bestPos;
  }
}

/**
 * Detect section markers in text (numbered headings, chapter markers, etc.)
 */
function detectSectionMarkers(text: string): Array<{ position: number; title: string }> {
  const markers: Array<{ position: number; title: string }> = [];

  // Common section patterns
  const patterns = [
    // Numbered sections: "1. Title", "1.1 Title", "I. Title"
    /(?:^|\n)(\d+\.?\d*\.?\s+[A-ZÀ-Ÿ][^\n]{3,60})(?=\n)/gm,
    // Chapter/Section markers
    /(?:^|\n)((?:Chapter|Section|Part|Chapitre|Partie|Kapitel|Abschnitt)\s*\d*[:\.\s]+[^\n]{3,50})(?=\n)/gim,
    // Roman numerals
    /(?:^|\n)((?:I|II|III|IV|V|VI|VII|VIII|IX|X)+\.?\s+[A-ZÀ-Ÿ][^\n]{3,50})(?=\n)/gm,
    // ALL CAPS headers
    /(?:^|\n)([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s]{5,40})(?=\n)/gm,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const title = match[1].trim();
      const matchIndex = match.index;
      // Avoid duplicates
      if (!markers.some(m => Math.abs(m.position - matchIndex) < 50)) {
        markers.push({
          position: matchIndex,
          title,
        });
      }
    }
  }

  // Sort by position
  return markers.sort((a, b) => a.position - b.position);
}

/**
 * Extract chapter text based on title matching
 */
export function extractChapterText(
  fullText: string,
  chapters: Array<{
    index: number;
    title: string;
    short_summary?: string;
    key_concepts?: string[];  // Added: use key_concepts for better matching
  }>,
  options: {
    minChunkSize?: number;
    maxChunkSize?: number;
    useMarkerDetection?: boolean;
  } = {}
): ChapterBoundary[] {
  const {
    minChunkSize = 500,
    maxChunkSize = LLM_CONFIG.truncation.chapterText,
    useMarkerDetection = true,
  } = options;

  const textLength = fullText.length;
  const boundaries: ChapterBoundary[] = [];

  // First, try to find chapter titles in the text using multiple strategies
  const foundPositions: Array<{ index: number; position: number; title: string; confidence: number }> = [];

  for (const chapter of chapters) {
    const searchStart = foundPositions.length > 0
      ? foundPositions[foundPositions.length - 1].position + 100
      : 0;

    let position = -1;
    let confidence = 0;

    // Strategy 1: Try exact title match
    position = findMarkerPosition(fullText, chapter.title, searchStart);
    if (position !== -1) {
      confidence = 1.0;
    }

    // Strategy 2: Try summary keywords
    if (position === -1 && chapter.short_summary) {
      position = findMarkerPosition(fullText, chapter.short_summary, searchStart);
      if (position !== -1) {
        confidence = 0.8;
      }
    }

    // Strategy 3: Try key_concepts (new)
    if (position === -1 && chapter.key_concepts && chapter.key_concepts.length > 0) {
      position = findPositionByKeyConcepts(fullText, chapter.key_concepts, searchStart);
      if (position !== -1) {
        confidence = 0.7;
      }
    }

    // Strategy 4: Try individual words from title (for reformulated titles)
    if (position === -1) {
      const titleWords = extractSignificantWords(chapter.title);
      if (titleWords.length >= 2) {
        // Search for any two consecutive significant words
        for (let i = 0; i < titleWords.length - 1 && position === -1; i++) {
          const searchPhrase = titleWords[i] + ' ' + titleWords[i + 1];
          const searchTextLower = fullText.substring(searchStart).toLowerCase();
          const phrasePos = searchTextLower.indexOf(searchPhrase.toLowerCase());
          if (phrasePos !== -1) {
            position = searchStart + phrasePos;
            confidence = 0.5;
          }
        }
      }
    }

    if (position !== -1) {
      foundPositions.push({
        index: chapter.index,
        position,
        title: chapter.title,
        confidence,
      });
    }
  }

  console.log(`[text-chunking] Found ${foundPositions.length}/${chapters.length} chapter positions (strategies: title/summary/concepts/words)`);

  // If we found at least half of the chapter positions, use them
  if (foundPositions.length >= chapters.length * 0.5) {
    console.log(`[text-chunking] Found ${foundPositions.length}/${chapters.length} chapter markers in text`);

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const found = foundPositions.find(f => f.index === chapter.index);

      let startPos: number;
      let endPos: number;

      if (found) {
        startPos = found.position;
        // End at next chapter or end of text
        const nextFound = foundPositions.find(f => f.index === chapter.index + 1);
        endPos = nextFound ? nextFound.position : textLength;
      } else {
        // Chapter not found - interpolate position
        const prevFound = foundPositions.filter(f => f.index < chapter.index).pop();
        const nextFound = foundPositions.find(f => f.index > chapter.index);

        if (prevFound && nextFound) {
          // Interpolate between found positions
          const totalChapters = nextFound.index - prevFound.index;
          const chapterOffset = chapter.index - prevFound.index;
          const segmentLength = nextFound.position - prevFound.position;
          startPos = prevFound.position + Math.floor(segmentLength * chapterOffset / totalChapters);
          endPos = prevFound.position + Math.floor(segmentLength * (chapterOffset + 1) / totalChapters);
        } else if (prevFound) {
          // After last found position
          startPos = prevFound.position + Math.floor((textLength - prevFound.position) * (chapter.index - prevFound.index) / (chapters.length - prevFound.index + 1));
          endPos = textLength;
        } else if (nextFound) {
          // Before first found position
          startPos = Math.floor(nextFound.position * (chapter.index - 1) / (nextFound.index - 1));
          endPos = nextFound.position;
        } else {
          // No positions found - fall back to equal division
          const chunkSize = Math.floor(textLength / chapters.length);
          startPos = i * chunkSize;
          endPos = (i + 1) * chunkSize;
        }
      }

      // Adjust to natural boundaries
      startPos = findNaturalBoundary(fullText, startPos, 'after', 200);
      endPos = findNaturalBoundary(fullText, endPos, 'before', 200);

      // Ensure minimum size
      if (endPos - startPos < minChunkSize) {
        endPos = Math.min(textLength, startPos + minChunkSize);
      }

      // Ensure maximum size
      if (endPos - startPos > maxChunkSize) {
        endPos = startPos + maxChunkSize;
        endPos = findNaturalBoundary(fullText, endPos, 'before', 100);
      }

      boundaries.push({
        index: chapter.index,
        title: chapter.title,
        startPosition: startPos,
        endPosition: endPos,
        text: fullText.substring(startPos, endPos).trim(),
      });
    }
  } else {
    // Fall back to intelligent equal division with marker detection
    console.log(`[text-chunking] Only found ${foundPositions.length}/${chapters.length} markers, using intelligent division`);

    const detectedMarkers = useMarkerDetection ? detectSectionMarkers(fullText) : [];

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];

      // Try to find a detected marker near the expected position
      const expectedStart = Math.floor(textLength * i / chapters.length);
      const nearbyMarker = detectedMarkers.find(
        m => Math.abs(m.position - expectedStart) < textLength / (chapters.length * 2)
      );

      let startPos = nearbyMarker ? nearbyMarker.position : expectedStart;
      let endPos = Math.floor(textLength * (i + 1) / chapters.length);

      // Check for marker at end position too
      const endMarker = detectedMarkers.find(
        m => Math.abs(m.position - endPos) < textLength / (chapters.length * 2) && m.position > startPos
      );
      if (endMarker) {
        endPos = endMarker.position;
      }

      // Adjust to natural boundaries
      startPos = findNaturalBoundary(fullText, startPos, 'after', 100);
      endPos = findNaturalBoundary(fullText, endPos, 'before', 100);

      // Ensure reasonable size
      if (endPos - startPos < minChunkSize) {
        endPos = Math.min(textLength, startPos + minChunkSize);
      }
      if (endPos - startPos > maxChunkSize) {
        endPos = startPos + maxChunkSize;
        endPos = findNaturalBoundary(fullText, endPos, 'before', 100);
      }

      boundaries.push({
        index: chapter.index,
        title: chapter.title,
        startPosition: startPos,
        endPosition: endPos,
        text: fullText.substring(startPos, endPos).trim(),
      });

      // Remove used marker from pool
      if (nearbyMarker) {
        const markerIndex = detectedMarkers.indexOf(nearbyMarker);
        if (markerIndex !== -1) {
          detectedMarkers.splice(markerIndex, 1);
        }
      }
    }
  }

  return boundaries;
}

/**
 * Simple equal division fallback
 */
export function equalDivisionChunking(
  fullText: string,
  chapterCount: number,
  options: { minChunkSize?: number; maxChunkSize?: number } = {}
): string[] {
  const { minChunkSize = 500, maxChunkSize = LLM_CONFIG.truncation.chapterText } = options;
  const textLength = fullText.length;
  const baseChunkSize = Math.floor(textLength / chapterCount);
  const chunks: string[] = [];

  for (let i = 0; i < chapterCount; i++) {
    let startPos = i * baseChunkSize;
    let endPos = (i + 1) * baseChunkSize;

    // Last chunk gets remainder
    if (i === chapterCount - 1) {
      endPos = textLength;
    }

    // Adjust to natural boundaries
    if (i > 0) {
      startPos = findNaturalBoundary(fullText, startPos, 'after', 100);
    }
    if (i < chapterCount - 1) {
      endPos = findNaturalBoundary(fullText, endPos, 'before', 100);
    }

    // Enforce size limits
    const chunkLength = endPos - startPos;
    if (chunkLength > maxChunkSize) {
      endPos = startPos + maxChunkSize;
      endPos = findNaturalBoundary(fullText, endPos, 'before', 100);
    }

    chunks.push(fullText.substring(startPos, endPos).trim());
  }

  return chunks;
}
