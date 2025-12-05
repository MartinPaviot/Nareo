/**
 * Document Structure Detector
 *
 * Detects REAL chapters/sections from document text before generating quiz chapters.
 * This ensures quiz chapters match the actual document structure rather than being invented.
 */

import OpenAI from 'openai';
import { LLM_CONFIG } from './index';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DetectedSection {
  title: string;
  startMarker: string;  // First distinctive words of this section
  level: number;        // 1 = main chapter, 2 = sub-section
  hasFormulas: boolean;
  estimatedPosition: number; // Approximate character position in document
}

export interface DocumentStructure {
  title: string;
  documentType: 'slides' | 'textbook' | 'notes' | 'article' | 'unknown';
  sections: DetectedSection[];
  totalSections: number;
  confidence: number; // 0-1, how confident we are in the structure detection
}

/**
 * Regex patterns for detecting section headers in various formats
 */
const SECTION_PATTERNS = [
  // Numbered chapters: "Chapter 1", "Chapitre 2", "Kapitel 3"
  /(?:^|\n)((?:Chapter|Chapitre|Kapitel)\s+\d+[:\.\s]*[^\n]{0,60})/gim,

  // Numbered sections: "1. Title", "1.1 Title", "1.1.1 Title"
  /(?:^|\n)(\d+(?:\.\d+)*\.?\s+[A-ZÀ-Ÿ][^\n]{3,60})(?=\n)/gm,

  // Roman numerals: "I. Title", "II. Title"
  /(?:^|\n)((?:I{1,3}|IV|V|VI{1,3}|IX|X)\.?\s+[A-ZÀ-Ÿ][^\n]{3,50})(?=\n)/gm,

  // Part/Section markers: "Part 1:", "Section A:"
  /(?:^|\n)((?:Part|Section|Partie|Teil|Abschnitt)\s*[\dA-Z]+[:\.\s]+[^\n]{3,50})/gim,

  // Standalone titles (ALL CAPS, at least 5 chars, on its own line)
  /(?:^|\n)([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s&]{4,40})(?=\n)/gm,

  // Title case headers on own line (starts with capital, 3-50 chars)
  /(?:^|\n)([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ]+){1,6})(?=\n)/gm,
];

/**
 * Keywords that indicate formula-heavy sections
 */
const FORMULA_INDICATORS = [
  'formula', 'equation', 'calculate', 'computation', 'derivation',
  'formule', 'équation', 'calcul', 'dérivation',
  'formel', 'gleichung', 'berechnung',
  'wacc', 'capm', 'dcf', 'npv', 'irr', 'fcff', 'fcfe', 'beta', 'ebitda',
  'valuation', 'valorisation', 'bewertung',
];

/**
 * Extract potential section titles from text using regex patterns
 */
function extractPotentialSections(text: string): Array<{ title: string; position: number }> {
  const sections: Array<{ title: string; position: number }> = [];
  const seenPositions = new Set<number>();

  for (const pattern of SECTION_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const title = match[1].trim();
      const position = match.index;

      // Skip if too close to an existing section (within 100 chars)
      const isTooClose = Array.from(seenPositions).some(p => Math.abs(p - position) < 100);
      if (isTooClose) continue;

      // Skip if title is too short or looks like noise
      if (title.length < 4) continue;
      if (/^[\d\.\s]+$/.test(title)) continue; // Just numbers
      if (/^(the|a|an|le|la|les|der|die|das)\s/i.test(title)) continue; // Starts with article

      sections.push({ title, position });
      seenPositions.add(position);
    }
  }

  // Sort by position
  return sections.sort((a, b) => a.position - b.position);
}

/**
 * Check if a section likely contains formulas
 */
function sectionHasFormulas(text: string): boolean {
  const lowerText = text.toLowerCase();

  // Check for formula indicators
  for (const indicator of FORMULA_INDICATORS) {
    if (lowerText.includes(indicator)) return true;
  }

  // Check for mathematical symbols
  const mathSymbols = /[Σ∑∫∂√±×÷≤≥≠≈∞∝∆∇]|[=+\-*/]\s*[a-zA-Z]+\s*[=+\-*/]|\^\d|_\{/;
  if (mathSymbols.test(text)) return true;

  return false;
}

/**
 * Use LLM to validate and refine detected structure
 * This is more expensive but ensures accuracy
 */
async function refineStructureWithLLM(
  text: string,
  candidateSections: Array<{ title: string; position: number }>,
  language: 'EN' | 'FR' | 'DE'
): Promise<DocumentStructure> {
  const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';

  // Prepare sample text with candidate sections highlighted
  const sampleText = text.substring(0, 15000);
  const candidatesJson = JSON.stringify(candidateSections.slice(0, 20), null, 2);

  const prompt = `Analyze this document and identify its REAL chapter/section structure.

CANDIDATE SECTIONS DETECTED (may include false positives):
${candidatesJson}

DOCUMENT TEXT (first 15000 chars):
${sampleText}

Your task:
1. Identify the ACTUAL main sections/chapters of this document
2. Filter out false positives (headers, footers, repeated navigation text, etc.)
3. Determine the document type (slides, textbook, notes, article)
4. Assess your confidence in the structure detection (0-1)

Return ONLY valid JSON with this structure:
{
  "title": "Document main title",
  "documentType": "slides|textbook|notes|article|unknown",
  "sections": [
    {
      "title": "Section title exactly as it appears",
      "startMarker": "First 10-20 distinctive words of this section",
      "level": 1,
      "hasFormulas": true/false
    }
  ],
  "confidence": 0.85
}

RULES:
- Only include sections that are REAL chapters/parts of the document
- Do NOT include: headers, footers, navigation elements, repeated text
- The startMarker must be actual text from the document (for boundary detection)
- level 1 = main chapter, level 2 = subsection
- Respond in ${languageName}`;

  try {
    const response = await openai.chat.completions.create({
      model: LLM_CONFIG.models.structuring,
      messages: [
        {
          role: 'system',
          content: `You are an expert document structure analyzer. Return valid JSON only. Respond in ${languageName}.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 3000,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    const parsed = JSON.parse(content) as DocumentStructure;
    parsed.totalSections = parsed.sections.length;

    // Add estimated positions based on startMarker matching
    for (const section of parsed.sections) {
      const markerLower = section.startMarker.toLowerCase().substring(0, 50);
      const position = text.toLowerCase().indexOf(markerLower);
      section.estimatedPosition = position !== -1 ? position : 0;
    }

    // Sort by position
    parsed.sections.sort((a, b) => a.estimatedPosition - b.estimatedPosition);

    return parsed;
  } catch (error) {
    console.error('[document-structure] LLM refinement failed:', error);

    // Fallback to regex-based structure
    return {
      title: 'Document',
      documentType: 'unknown',
      sections: candidateSections.slice(0, 10).map((s, i) => ({
        title: s.title,
        startMarker: text.substring(s.position, s.position + 100).trim(),
        level: 1,
        hasFormulas: sectionHasFormulas(text.substring(s.position, s.position + 2000)),
        estimatedPosition: s.position,
      })),
      totalSections: Math.min(candidateSections.length, 10),
      confidence: 0.3,
    };
  }
}

/**
 * Quick regex-only detection (no LLM, faster but less accurate)
 */
export function detectStructureQuick(text: string): DocumentStructure {
  const candidates = extractPotentialSections(text);

  // Filter to main sections only (skip if too many candidates)
  const mainSections = candidates.length > 15
    ? candidates.filter((_, i) => i % Math.ceil(candidates.length / 10) === 0)
    : candidates;

  return {
    title: mainSections[0]?.title || 'Document',
    documentType: 'unknown',
    sections: mainSections.slice(0, 10).map(s => ({
      title: s.title,
      startMarker: text.substring(s.position, s.position + 100).trim(),
      level: 1,
      hasFormulas: sectionHasFormulas(text.substring(s.position, Math.min(text.length, s.position + 3000))),
      estimatedPosition: s.position,
    })),
    totalSections: mainSections.length,
    confidence: 0.4,
  };
}

/**
 * Main function: Detect document structure
 *
 * @param text - Full document text
 * @param language - Content language
 * @param useLLM - Whether to use LLM for refinement (more accurate but slower/costlier)
 */
export async function detectDocumentStructure(
  text: string,
  language: 'EN' | 'FR' | 'DE' = 'EN',
  useLLM: boolean = true
): Promise<DocumentStructure> {
  console.log(`[document-structure] Detecting structure (useLLM: ${useLLM})...`);

  // Step 1: Extract candidates using regex
  const candidates = extractPotentialSections(text);
  console.log(`[document-structure] Found ${candidates.length} candidate sections`);

  if (candidates.length === 0) {
    console.log('[document-structure] No sections detected, returning single-chapter structure');
    return {
      title: 'Document',
      documentType: 'unknown',
      sections: [{
        title: 'Content',
        startMarker: text.substring(0, 100).trim(),
        level: 1,
        hasFormulas: sectionHasFormulas(text),
        estimatedPosition: 0,
      }],
      totalSections: 1,
      confidence: 0.1,
    };
  }

  // Step 2: Refine with LLM if requested
  if (useLLM) {
    const refined = await refineStructureWithLLM(text, candidates, language);
    console.log(`[document-structure] LLM refined to ${refined.sections.length} sections (confidence: ${refined.confidence})`);
    return refined;
  }

  // Step 3: Quick regex-only fallback
  const quick = detectStructureQuick(text);
  console.log(`[document-structure] Quick detection: ${quick.sections.length} sections`);
  return quick;
}

/**
 * Convert detected structure to chapter format for the pipeline
 */
export function structureToChapters(
  structure: DocumentStructure,
  text: string
): Array<{
  index: number;
  title: string;
  short_summary: string;
  difficulty: number;
  startPosition: number;
  endPosition: number;
  hasFormulas: boolean;
}> {
  const chapters: Array<{
    index: number;
    title: string;
    short_summary: string;
    difficulty: number;
    startPosition: number;
    endPosition: number;
    hasFormulas: boolean;
  }> = [];

  // Only use level 1 sections as chapters
  const mainSections = structure.sections.filter(s => s.level === 1);

  for (let i = 0; i < mainSections.length; i++) {
    const section = mainSections[i];
    const nextSection = mainSections[i + 1];

    const startPosition = section.estimatedPosition;
    const endPosition = nextSection?.estimatedPosition || text.length;

    // Extract section text for summary
    const sectionText = text.substring(startPosition, Math.min(startPosition + 500, endPosition));

    // Estimate difficulty based on position and formula presence
    let difficulty = 1;
    if (section.hasFormulas) difficulty++;
    if (i > mainSections.length / 2) difficulty++;
    difficulty = Math.min(3, difficulty);

    chapters.push({
      index: i + 1,
      title: section.title,
      short_summary: sectionText.substring(0, 200).trim() + '...',
      difficulty,
      startPosition,
      endPosition,
      hasFormulas: section.hasFormulas,
    });
  }

  return chapters;
}
