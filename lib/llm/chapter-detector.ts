/**
 * CHAPTER DETECTOR - Generic Chapter Detection for Any Course Document
 * =====================================================================
 * Converted from Python to TypeScript for Nareo Project
 * Version: 1.0
 *
 * Detection method:
 * 1. Score each line based on its probability of being a title
 * 2. Detect repetition patterns (slide headers)
 * 3. Identify table of contents if present
 * 4. Build hierarchical document structure
 */

// =============================================================================
// DATA STRUCTURES
// =============================================================================

export enum ChapterLevel {
  MAIN = 1,    // Main chapter (COURS 1, Chapter 1, I.)
  SUB = 2,     // Sub-chapter (1.1, A., I.1)
  SUBSUB = 3,  // Sub-sub-chapter
}

export interface Chapter {
  title: string;
  pageStart: number;
  pageEnd: number | null;
  level: ChapterLevel;
  confidence: number;
  children: Chapter[];
}

interface LineInfo {
  text: string;
  page: number;
  lineIdx: number;
  score: number;
  reasons: string[];
  level: ChapterLevel;
}

// =============================================================================
// TITLE PATTERNS - Configurable for different document types
// =============================================================================

const TITLE_PATTERNS: Record<string, RegExp> = {
  // === HIGH PRIORITY: Explicit chapter patterns ===
  explicit_chapter: /^(COURS|CHAPITRE|CHAPTER|PARTIE|PART|SESSION|MODULE)\s*\d+\.?$/i,
  explicit_chapter_titled: /^(COURS|CHAPITRE|CHAPTER|PARTIE|PART|SESSION|MODULE)\s*\d+[.:]?\s+\S/i,
  explicit_chapter_lower: /^(Cours|Chapitre|Chapter|Partie|Part|Session|Module)\s*\d+\.?$/,

  // === Roman numeral sections ===
  roman_section: /^([IVXLC]+)\.\s+[A-ZÀ-Ü]/,

  // === Standard numbering ===
  numbered_dot: /^(\d{1,2})\.\s+[A-ZÀ-Ü]/,
  numbered_paren: /^(\d{1,2})\)\s+[A-ZÀ-Ü]/,
  numbered_dash: /^(\d{1,2})\s*[-–—]\s*[A-ZÀ-Ü]/,
  letter: /^([A-Z])[.)]\s+[A-ZÀ-Ü]/,

  // === Structure keywords ===
  section_keyword: /^(Section|Introduction|Conclusion|Summary|R[eé]sum[eé]|Annexe|Appendix)\b/i,

  // === Sub-levels ===
  sub_numbered: /^(\d+)\.(\d+)[.\s]/,
  sub_letter: /^([a-z])[.)]\s+[A-Z]/,
};

// Structural keywords (boost score)
const STRUCTURAL_KEYWORDS: Record<string, string[]> = {
  fr: [
    'introduction', 'conclusion', 'sommaire', 'résumé', 'objectif',
    'définition', 'méthode', 'analyse', 'résultat', 'discussion',
    'bibliographie', 'référence', 'annexe', 'exercice', 'exemple',
  ],
  en: [
    'introduction', 'conclusion', 'summary', 'abstract', 'objective',
    'definition', 'method', 'methodology', 'analysis', 'results',
    'discussion', 'references', 'appendix', 'exercise', 'example',
  ],
};

// Noise patterns to reject
const NOISE_PATTERNS: RegExp[] = [
  /^(le|la|les|un|une|des|du|de|d'|l')\s/i,  // Starts with article
  /^(et|ou|mais|donc|car|ni|or)\s/i,          // Starts with conjunction
  /^(qui|que|quoi|dont|où)\s/i,               // Starts with relative pronoun
  /,\s*$/,                                     // Ends with comma
  /^\d+\s*$/,                                  // Just a number
];

// Content indicators (negative score)
const CONTENT_INDICATORS: RegExp[] = [
  /\b(est|sont|était|étaient|sera|seront)\b/i,  // French "to be" verbs
  /\b(is|are|was|were|will be)\b/i,             // English "to be" verbs
  /\b(le|la|les|un|une|des)\s+\w+\s+(est|sont|a|ont)\b/i,  // French phrases
  /\b(the|a|an)\s+\w+\s+(is|are|has|have)\b/i,  // English phrases
];

// =============================================================================
// CORE DETECTION ENGINE
// =============================================================================

export class ChapterDetector {
  protected pages: string[];
  protected language: string;
  protected allLines: LineInfo[] = [];
  protected tocEntries: string[] = [];
  protected chapters: Chapter[] = [];

  constructor(pages: string[], language: string = 'auto') {
    this.pages = pages;
    this.language = language === 'auto' ? this.detectLanguage() : language;
  }

  /**
   * Main detection pipeline
   */
  detect(): Chapter[] {
    // 1. Extract and score all lines
    this.extractAndScoreLines();

    // 2. Find table of contents
    this.findTableOfContents();

    // 3. Identify chapter titles
    const chapterTitles = this.identifyChapterTitles();

    // 4. Build chapters with page ranges
    this.chapters = this.buildChapters(chapterTitles);

    // 5. Detect sub-chapters
    this.detectSubchapters();

    return this.chapters;
  }

  // ---------------------------------------------------------------------------
  // STEP 1: Extract and score lines
  // ---------------------------------------------------------------------------

  protected extractAndScoreLines(): void {
    for (let pageIdx = 0; pageIdx < this.pages.length; pageIdx++) {
      let pageText = this.cleanPdfText(this.pages[pageIdx]);
      const lines = pageText.split('\n');

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const clean = lines[lineIdx].trim();
        if (!clean || clean.length < 2) continue;

        const { score, reasons, level } = this.computeTitleScore(
          clean,
          lineIdx,
          lines.length,
          pageIdx
        );

        this.allLines.push({
          text: clean,
          page: pageIdx + 1,
          lineIdx,
          score,
          reasons,
          level,
        });
      }
    }
  }

  protected cleanPdfText(text: string): string {
    // Unicode ligatures
    const replacements: Record<string, string> = {
      'ﬁ': 'fi',
      'ﬂ': 'fl',
      'ﬀ': 'ff',
      'ﬃ': 'ffi',
      'ﬄ': 'ffl',
      '\x00': '',
      '\ufeff': '',
    };

    for (const [old, newChar] of Object.entries(replacements)) {
      text = text.split(old).join(newChar);
    }

    // Broken "ti" ligature (when ) appears in a word)
    text = text.replace(/(\w)\)(\w)/g, '$1ti$2');

    return text;
  }

  protected computeTitleScore(
    text: string,
    linePos: number,
    totalLines: number,
    pageIdx: number
  ): { score: number; reasons: string[]; level: ChapterLevel } {
    let score = 0.0;
    const reasons: string[] = [];
    let level = ChapterLevel.MAIN;

    // ----- PRELIMINARY FILTERING -----
    // Reject isolated words that are clearly not titles
    if (text.split(/\s+/).length === 1 && text.length < 15) {
      const structuralWords = ['introduction', 'conclusion', 'sommaire', 'résumé', 'annexe'];
      if (!structuralWords.includes(text.toLowerCase())) {
        return { score: 0.0, reasons: ['mot_isolé'], level };
      }
    }

    // Reject lines starting with lowercase (sentence fragment)
    if (text[0] === text[0].toLowerCase() && text[0] !== text[0].toUpperCase()) {
      return { score: 0.0, reasons: ['commence_minuscule'], level };
    }

    // Reject noise patterns
    for (const pattern of NOISE_PATTERNS) {
      if (pattern.test(text)) {
        return { score: 0.0, reasons: ['bruit'], level };
      }
    }

    // ----- LENGTH -----
    const length = text.length;
    if (length < 3) {
      return { score: 0.0, reasons: ['trop_court'], level };
    } else if (length <= 40) {
      score += 0.25;
      reasons.push('court');
    } else if (length <= 80) {
      score += 0.1;
    } else {
      score -= 0.3;
      reasons.push('long');
    }

    // ----- NUMBERING PATTERNS (HIGH PRIORITY) -----
    for (const [patternName, pattern] of Object.entries(TITLE_PATTERNS)) {
      if (pattern.test(text)) {
        if (patternName.includes('explicit')) {
          // Explicit patterns = very high confidence
          score += 0.7;
          reasons.push(`EXPLICIT:${patternName}`);
          break;
        } else if (patternName.includes('sub')) {
          score += 0.35;
          level = ChapterLevel.SUB;
          reasons.push(`pattern:${patternName}`);
          break;
        } else if (patternName.includes('roman')) {
          // Roman numerals = often sub-chapter
          score += 0.4;
          level = ChapterLevel.SUB;
          reasons.push(`pattern:${patternName}`);
          break;
        } else {
          score += 0.45;
          reasons.push(`pattern:${patternName}`);
          break;
        }
      }
    }

    // ----- UPPERCASE FORMATTING -----
    if (text === text.toUpperCase() && text.length > 3 && /[A-ZÀ-Ü]/.test(text)) {
      score += 0.35;
      reasons.push('MAJUSCULES');
    }

    // ----- TITLE CASE -----
    const words = text.split(/\s+/);
    if (words.length >= 1 && words.length <= 8) {
      const skipWords = new Set([
        'le', 'la', 'les', 'de', 'du', 'des', 'et', 'ou', 'à', 'en',
        'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'for',
      ]);
      const significantWords = words.filter(w => !skipWords.has(w.toLowerCase()));

      if (significantWords.length > 0) {
        const capsCount = significantWords.filter(
          w => w.length > 0 && w[0] === w[0].toUpperCase()
        ).length;
        const ratio = capsCount / significantWords.length;
        if (ratio >= 0.8) {
          score += 0.2;
          reasons.push('TitleCase');
        }
      }
    }

    // ----- PAGE POSITION -----
    if (totalLines > 0) {
      const relativePos = linePos / totalLines;
      if (relativePos < 0.15) {  // Top 15%
        score += 0.15;
        reasons.push('haut_page');
      }
    }

    // ----- STRUCTURAL KEYWORDS -----
    const textLower = text.toLowerCase();
    const keywords = STRUCTURAL_KEYWORDS[this.language] || STRUCTURAL_KEYWORDS.fr;
    if (keywords.some(kw => textLower.includes(kw))) {
      score += 0.15;
      reasons.push('mot_clé');
    }

    // ----- CONTENT INDICATORS (negative) -----
    for (const indicator of CONTENT_INDICATORS) {
      if (indicator.test(textLower)) {
        score -= 0.2;
        reasons.push('contenu_probable');
        break;
      }
    }

    // ----- END PUNCTUATION -----
    const lastChar = text[text.length - 1];
    if ('.,:;!?'.includes(lastChar) && !/.*\d\.$/.test(text)) {
      score -= 0.1;
    } else if (!'.,:;!?'.includes(lastChar)) {
      score += 0.05;
      reasons.push('pas_ponct_fin');
    }

    // ----- PAGE NUMBER ONLY -----
    if (/^\d{1,3}$/.test(text)) {
      return { score: 0.0, reasons: ['numéro_page'], level };
    }

    // Normalize
    score = Math.max(0.0, Math.min(1.0, score));

    return { score, reasons, level };
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Find table of contents
  // ---------------------------------------------------------------------------

  protected findTableOfContents(): void {
    const tocIndicators = [
      'sommaire', 'table des matières', 'contents',
      'table of contents', 'plan', 'index',
    ];

    // Search in first 5 pages
    for (let pageIdx = 0; pageIdx < Math.min(5, this.pages.length); pageIdx++) {
      const pageText = this.pages[pageIdx];
      const lines = pageText.split('\n').map(l => l.trim()).filter(l => l);
      const pageLower = pageText.toLowerCase();

      const isTocPage = tocIndicators.some(ind => pageLower.includes(ind));

      // FIX: Also detect implicit TOC (list of short titles without explicit keyword)
      // This is needed for slide presentations like PE.pdf that have a TOC page
      // without explicit "sommaire" or "contents" keywords
      if (isTocPage || this.looksLikeToc(lines)) {
        for (const line of lines) {
          // Skip TOC indicators themselves
          if (tocIndicators.some(ind => line.toLowerCase().includes(ind))) {
            continue;
          }
          // Skip page numbers alone
          if (/^\d{1,3}$/.test(line)) {
            continue;
          }
          // Skip lines too long
          if (line.length <= 60 && line.length > 2) {
            // Clean page numbers at end
            const clean = line.replace(/[.\s_]+\d{1,3}\s*$/, '').trim();
            if (clean && clean.length > 2) {
              this.tocEntries.push(clean);
            }
          }
        }

        if (this.tocEntries.length > 0) {
          break;
        }
      }
    }
  }

  protected looksLikeToc(lines: string[]): boolean {
    if (lines.length < 3 || lines.length > 15) {
      return false;
    }

    // Count lines that look like titles
    let titleLike = 0;
    for (const line of lines) {
      const clean = line.trim();
      if (clean.length < 60 && clean.length > 2 && !/^\d{1,3}$/.test(clean)) {
        // Has page number at end?
        if (/[.\s_]+\d{1,3}\s*$/.test(clean)) {
          titleLike++;
        }
        // Or starts with numbering?
        else if (/^(\d+[.)｜]|[IVXLC]+[.)｜]|[A-Z][.)])/.test(clean)) {
          titleLike++;
        }
        // Or is just a short title (TitleCase) without ending punctuation?
        else if (
          clean.length < 40 &&
          clean[0] === clean[0].toUpperCase() &&
          !'.,:;!?'.includes(clean[clean.length - 1]) &&
          clean.split(/\s+/).length <= 6
        ) {
          titleLike++;
        }
      }
    }

    // If more than 50% of lines look like TOC entries
    const ratio = lines.length > 0 ? titleLike / lines.length : 0;
    return ratio > 0.5;
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Identify chapter titles
  // ---------------------------------------------------------------------------

  protected identifyChapterTitles(): LineInfo[] {
    // PRIORITY 1: Explicit chapters (COURS X, Chapter X, etc.)
    const explicitChapters = this.allLines.filter(
      l => l.reasons.some(r => r.includes('EXPLICIT'))
    );

    if (explicitChapters.length >= 2) {
      // Deduplicate and sort by page
      const seenPages = new Set<number>();
      const unique: LineInfo[] = [];
      for (const line of explicitChapters.sort((a, b) => a.page - b.page)) {
        if (!seenPages.has(line.page)) {
          seenPages.add(line.page);
          unique.push(line);
        }
      }
      return unique;
    }

    // PRIORITY 2: Use TOC if available
    if (this.tocEntries.length > 0) {
      return this.matchTocEntries();
    }

    // PRIORITY 3: Detection by repetition + score
    return this.detectByRepetitionAndScore();
  }

  protected matchTocEntries(): LineInfo[] {
    const matched: LineInfo[] = [];
    let tocPage: number | null = null;

    // Find TOC page (to ignore it in matching)
    for (const line of this.allLines) {
      for (const entry of this.tocEntries.slice(0, 2)) {
        if (this.textSimilarity(entry, line.text) > 0.9) {
          tocPage = line.page;
          break;
        }
      }
      if (tocPage !== null) break;
    }

    const usedPages = new Set<number>(tocPage !== null ? [tocPage] : []);

    for (const tocEntry of this.tocEntries) {
      let bestMatch: LineInfo | null = null;
      let bestScore = 0;

      for (const line of this.allLines) {
        if (usedPages.has(line.page)) continue;

        const similarity = this.textSimilarity(tocEntry, line.text);

        if (similarity > 0.8) {
          // Favor earlier occurrences
          const pagePenalty = line.page / this.pages.length * 0.1;
          const combinedScore = similarity - pagePenalty;

          if (combinedScore > bestScore) {
            bestScore = combinedScore;
            bestMatch = line;
          }
        }
      }

      if (bestMatch) {
        bestMatch.score = Math.max(bestMatch.score, 0.7);
        matched.push(bestMatch);
        usedPages.add(bestMatch.page);
      }
    }

    return matched.sort((a, b) => a.page - b.page);
  }

  protected detectByRepetitionAndScore(): LineInfo[] {
    // === STRATEGY 1: Repeated titles across pages (slides with fixed header) ===
    const textOccurrences: Map<string, LineInfo[]> = new Map();
    for (const line of this.allLines) {
      if (line.score >= 0.4) {
        const key = this.normalizeTitle(line.text);
        if (key && key.length > 3) {
          if (!textOccurrences.has(key)) {
            textOccurrences.set(key, []);
          }
          textOccurrences.get(key)!.push(line);
        }
      }
    }

    const repeatedTitles: LineInfo[] = [];
    for (const [, occurrences] of textOccurrences) {
      const pages = new Set(occurrences.map(o => o.page));
      if (pages.size >= 2) {
        const first = occurrences.reduce((min, o) => o.page < min.page ? o : min);
        first.score = Math.min(1.0, first.score + 0.2);
        repeatedTitles.push(first);
      }
    }

    if (repeatedTitles.length >= 3) {
      return repeatedTitles.sort((a, b) => a.page - b.page);
    }

    // === STRATEGY 2: Slides - one title per page at top ===
    const pageBestTitles: Map<number, LineInfo> = new Map();
    for (const line of this.allLines) {
      if (line.score >= 0.7 && line.lineIdx < 5) {
        const existing = pageBestTitles.get(line.page);
        if (!existing || line.score > existing.score) {
          pageBestTitles.set(line.page, line);
        }
      }
    }

    if (pageBestTitles.size >= 3) {
      const candidates = Array.from(pageBestTitles.values());
      const unique: LineInfo[] = [];
      const seenNormalized = new Set<string>();

      for (const line of candidates.sort((a, b) => a.page - b.page)) {
        const norm = this.normalizeTitle(line.text);
        let isDuplicate = false;
        for (const seen of seenNormalized) {
          if (this.textSimilarity(norm, seen) > 0.7) {
            isDuplicate = true;
            break;
          }
        }

        if (!isDuplicate && norm.length > 3) {
          unique.push(line);
          seenNormalized.add(norm);
        }
      }

      if (unique.length >= 3) {
        return unique;
      }
    }

    // === STRATEGY 3: Best unique scores (fallback) ===
    const candidates = this.allLines.filter(l => l.score >= 0.5);
    candidates.sort((a, b) => b.score - a.score || a.page - b.page);

    const selected: LineInfo[] = [];
    const usedNormalized = new Set<string>();

    for (const line of candidates) {
      const normalized = this.normalizeTitle(line.text);
      if (normalized && !usedNormalized.has(normalized) && normalized.length > 3) {
        selected.push(line);
        usedNormalized.add(normalized);
        if (selected.length >= 15) break;
      }
    }

    return selected.sort((a, b) => a.page - b.page);
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Build chapters
  // ---------------------------------------------------------------------------

  protected buildChapters(titleLines: LineInfo[]): Chapter[] {
    const chapters: Chapter[] = [];

    for (let i = 0; i < titleLines.length; i++) {
      const line = titleLines[i];
      let pageEnd: number;

      if (i < titleLines.length - 1) {
        pageEnd = titleLines[i + 1].page - 1;
      } else {
        pageEnd = this.pages.length;
      }

      // Ensure pageEnd >= pageStart
      pageEnd = Math.max(pageEnd, line.page);

      chapters.push({
        title: this.capitalizeTitle(line.text),
        pageStart: line.page,
        pageEnd,
        level: line.level,
        confidence: line.score,
        children: [],
      });
    }

    return chapters;
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Detect sub-chapters
  // ---------------------------------------------------------------------------

  protected detectSubchapters(): void {
    for (const chapter of this.chapters) {
      const subCandidates: LineInfo[] = [];

      for (const l of this.allLines) {
        if (!(chapter.pageStart <= l.page && l.page <= (chapter.pageEnd || this.pages.length))) {
          continue;
        }
        if (l.level !== ChapterLevel.SUB || l.score < 0.35) {
          continue;
        }
        if (l.text === chapter.title) {
          continue;
        }
        // Reject lines that are just numbers
        if (/^[\d.\s,]+$/.test(l.text)) {
          continue;
        }
        // Reject lines too short
        if (l.text.length < 5) {
          continue;
        }
        subCandidates.push(l);
      }

      // Build sub-chapters
      for (let i = 0; i < subCandidates.length; i++) {
        const line = subCandidates[i];
        let pageEnd: number;

        if (i < subCandidates.length - 1) {
          pageEnd = subCandidates[i + 1].page - 1;
        } else {
          pageEnd = chapter.pageEnd || this.pages.length;
        }

        pageEnd = Math.max(pageEnd, line.page);

        chapter.children.push({
          title: this.capitalizeTitle(line.text),
          pageStart: line.page,
          pageEnd,
          level: ChapterLevel.SUB,
          confidence: line.score,
          children: [],
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  protected detectLanguage(): string {
    const sample = this.pages.slice(0, 3).join(' ').toLowerCase();

    const frIndicators = ['le ', 'la ', 'les ', 'de ', 'est ', 'sont ', 'dans '];
    const enIndicators = ['the ', 'is ', 'are ', 'of ', 'and ', 'in ', 'to '];

    const frCount = frIndicators.reduce((sum, w) => sum + (sample.split(w).length - 1), 0);
    const enCount = enIndicators.reduce((sum, w) => sum + (sample.split(w).length - 1), 0);

    return frCount > enCount ? 'fr' : 'en';
  }

  protected normalizeTitle(text: string): string {
    let normalized = text.toLowerCase();
    normalized = normalized.replace(/[^\w\s]/g, '');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized;
  }

  protected capitalizeTitle(text: string): string {
    // Ensure title starts with uppercase letter
    const trimmed = text.trim();
    if (!trimmed) return trimmed;

    // Find first letter and capitalize it
    const match = trimmed.match(/^([^a-zA-ZÀ-ÿ]*)([a-zA-ZÀ-ÿ])(.*)/);
    if (match) {
      return match[1] + match[2].toUpperCase() + match[3];
    }
    return trimmed;
  }

  protected textSimilarity(text1: string, text2: string): number {
    const norm1 = this.normalizeTitle(text1);
    const norm2 = this.normalizeTitle(text2);

    if (norm1 === norm2) return 1.0;

    // One contains the other?
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const shorter = Math.min(norm1.length, norm2.length);
      const longer = Math.max(norm1.length, norm2.length);
      return longer > 0 ? shorter / longer : 0;
    }

    // Jaccard on words
    const words1 = new Set(norm1.split(/\s+/));
    const words2 = new Set(norm2.split(/\s+/));

    if (words1.size === 0 || words2.size === 0) return 0.0;

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  // ---------------------------------------------------------------------------
  // OUTPUT
  // ---------------------------------------------------------------------------

  toDict(): Array<Record<string, any>> {
    return this.chapters.map(c => this.chapterToDict(c));
  }

  private chapterToDict(chapter: Chapter): Record<string, any> {
    return {
      title: chapter.title,
      page_start: chapter.pageStart,
      page_end: chapter.pageEnd,
      level: ChapterLevel[chapter.level],
      confidence: Math.round(chapter.confidence * 100) / 100,
      children: chapter.children.map(c => this.chapterToDict(c)),
    };
  }

  toMarkdown(): string {
    const lines = ['# Structure du document\n'];

    for (const chapter of this.chapters) {
      lines.push(`## ${chapter.title}`);
      lines.push(`*Pages ${chapter.pageStart}-${chapter.pageEnd} (confiance: ${Math.round(chapter.confidence * 100)}%)*\n`);

      for (const sub of chapter.children) {
        lines.push(`### ${sub.title}`);
        lines.push(`*Pages ${sub.pageStart}-${sub.pageEnd}*\n`);
      }
    }

    return lines.join('\n');
  }

  printStructure(): void {
    console.log('\n' + '='.repeat(70));
    console.log('STRUCTURE DÉTECTÉE');
    console.log('='.repeat(70));

    for (let i = 0; i < this.chapters.length; i++) {
      const chapter = this.chapters[i];
      console.log(`\n${i + 1}. ${chapter.title}`);
      console.log(`   Pages: ${chapter.pageStart} - ${chapter.pageEnd}`);
      console.log(`   Confiance: ${Math.round(chapter.confidence * 100)}%`);

      for (let j = 0; j < chapter.children.length; j++) {
        const sub = chapter.children[j];
        console.log(`   ${i + 1}.${j + 1} ${sub.title} (p.${sub.pageStart}-${sub.pageEnd})`);
      }
    }
  }
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Detect chapters from a document
 *
 * @param pages - List of text for each page (index 0 = page 1)
 * @param language - 'fr', 'en', or 'auto' for automatic detection
 * @returns List of detected chapters
 */
export function detectChapters(pages: string[], language: string = 'auto'): Chapter[] {
  const detector = new ChapterDetector(pages, language);
  return detector.detect();
}

/**
 * Convert chapters to the format expected by the pipeline
 */
export function chaptersToStructure(
  chapters: Chapter[],
  pages: string[]
): Array<{
  index: number;
  title: string;
  short_summary: string;
  difficulty: number;
  startPosition: number;
  endPosition: number;
  hasFormulas: boolean;
}> {
  const result: Array<{
    index: number;
    title: string;
    short_summary: string;
    difficulty: number;
    startPosition: number;
    endPosition: number;
    hasFormulas: boolean;
  }> = [];

  // Build full text for position calculation
  const fullText = pages.join('\n\n');
  const pagePositions: number[] = [];
  let currentPos = 0;
  for (const page of pages) {
    pagePositions.push(currentPos);
    currentPos += page.length + 2; // +2 for '\n\n'
  }

  // Only use main level chapters
  const mainChapters = chapters.filter(ch => ch.level === ChapterLevel.MAIN);

  for (let i = 0; i < mainChapters.length; i++) {
    const chapter = mainChapters[i];
    const nextChapter = mainChapters[i + 1];

    const startPosition = pagePositions[chapter.pageStart - 1] || 0;
    const endPosition = nextChapter
      ? pagePositions[nextChapter.pageStart - 1] || fullText.length
      : fullText.length;

    // Extract section text for summary
    const sectionText = fullText.substring(startPosition, Math.min(startPosition + 500, endPosition));

    // Estimate difficulty
    let difficulty = 1;
    const sectionLower = sectionText.toLowerCase();
    const formulaIndicators = ['formule', 'formula', 'équation', 'equation', 'calcul', 'wacc', 'capm', 'dcf'];
    if (formulaIndicators.some(ind => sectionLower.includes(ind))) difficulty++;
    if (i > mainChapters.length / 2) difficulty++;
    difficulty = Math.min(3, difficulty);

    result.push({
      index: i + 1,
      title: chapter.title.replace(/^[\d.]+\s*/, ''), // Remove leading numbers
      short_summary: sectionText.substring(0, 200).trim() + '...',
      difficulty,
      startPosition,
      endPosition,
      hasFormulas: formulaIndicators.some(ind => sectionLower.includes(ind)),
    });
  }

  return result;
}
