/**
 * Document Structure Detector - Enhanced Version
 *
 * Detects REAL chapters/sections from document text using multi-strategy detection:
 * 1. Explicit markers (COURS, Chapter, Section, etc.) - highest priority
 * 2. Table of Contents matching - if TOC found, match entries to document
 * 3. Repetition detection - same title on multiple pages = chapter
 * 4. Score-based detection - fallback using multiple heuristics
 *
 * NO LLM dependency - pure algorithmic detection for speed and reliability.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface DetectedSection {
  title: string;
  titleNormalized: string;
  startPage: number;
  endPage: number;
  level: number;
  number: string | null;
  hasFormulas: boolean;
  confidence: number;
  detectionMethod: string;
  children: DetectedSection[];
}

export interface DocumentStructure {
  title: string;
  documentType: 'slides' | 'textbook' | 'notes' | 'article' | 'legal' | 'scientific' | 'technical' | 'unknown';
  structureType: 'hierarchical' | 'flat' | 'unstructured';
  sections: DetectedSection[];
  totalPages: number;
  confidence: number;
  language: 'fr' | 'en';
  warnings: string[];
}

interface LineInfo {
  text: string;
  page: number;
  lineIdx: number;
  score: number;
  reasons: string[];
  level: 1 | 2;
}

// =============================================================================
// PATTERNS
// =============================================================================

/**
 * Explicit chapter patterns - highest confidence
 */
const EXPLICIT_PATTERNS = {
  // French
  coursNumbered: /^COURS\s*\d+\.?$/i,
  coursTitled: /^COURS\s*\d+[\.:]\s+\S/i,
  chapitreNumbered: /^CHAPITRE\s*\d+\.?$/i,
  chapitreTitled: /^CHAPITRE\s*\d+[\.:]\s+\S/i,
  partieNumbered: /^PARTIE\s*\d+\.?$/i,
  partieTitled: /^PARTIE\s*\d+[\.:]\s+\S/i,
  sessionNumbered: /^SESSION\s*\d+\.?$/i,
  sessionTitled: /^SESSION\s*\d+[\.:]\s+\S/i,
  moduleNumbered: /^MODULE\s*\d+\.?$/i,
  moduleTitled: /^MODULE\s*\d+[\.:]\s+\S/i,
  themeNumbered: /^TH[ÈE]ME\s*\d+\.?$/i,
  themeTitled: /^TH[ÈE]ME\s*\d+[\.:]\s+\S/i,

  // English
  chapterNumbered: /^CHAPTER\s*\d+\.?$/i,
  chapterTitled: /^CHAPTER\s*\d+[\.:]\s+\S/i,
  partNumbered: /^PART\s*\d+\.?$/i,
  partTitled: /^PART\s*\d+[\.:]\s+\S/i,
  sectionNumbered: /^SECTION\s*\d+\.?$/i,
  sectionTitled: /^SECTION\s*\d+[\.:]\s+\S/i,
  unitNumbered: /^UNIT\s*\d+\.?$/i,
  unitTitled: /^UNIT\s*\d+[\.:]\s+\S/i,
  lessonNumbered: /^LESSON\s*\d+\.?$/i,
  lessonTitled: /^LESSON\s*\d+[\.:]\s+\S/i,
};

/**
 * Sub-section patterns
 */
const SUB_PATTERNS = {
  romanSection: /^([IVXLC]+)\.\s+[A-ZÀ-Ü]/,
  numberedDot: /^(\d{1,2})\.\s+[A-ZÀ-Ü]/,
  subNumbered: /^(\d+)\.(\d+)[\.\s]/,
  letterSection: /^[A-Z]\.\s+[A-ZÀ-Ü]/,
};

/**
 * Structural keywords that indicate a chapter
 */
const STRUCTURAL_KEYWORDS = [
  // FR
  'introduction', 'conclusion', 'sommaire', 'résumé', 'annexe', 'préface',
  'préambule', 'glossaire', 'bibliographie', 'objectifs', 'contexte',
  'méthodologie', 'résultats', 'analyse', 'synthèse',
  // EN
  'abstract', 'summary', 'appendix', 'preface', 'glossary', 'overview',
  'objectives', 'background', 'methodology', 'results', 'discussion',
  'references', 'acknowledgements', 'getting started', 'prerequisites',
];

/**
 * Formula indicators
 */
const FORMULA_INDICATORS = [
  'formula', 'equation', 'calculate', 'computation', 'derivation', 'proof',
  'formule', 'équation', 'calcul', 'dérivation', 'démonstration',
  'wacc', 'capm', 'dcf', 'npv', 'irr', 'fcff', 'fcfe', 'beta', 'ebitda',
  'valuation', 'valorisation', 'multiple', 'ratio', 'theorem', 'lemma',
];

/**
 * Noise patterns to filter out
 */
const NOISE_PATTERNS = [
  /^(le|la|les|un|une|des|du|de|d'|l')\s/i,
  /^(et|ou|mais|donc|car|ni|or)\s/i,
  /^(qui|que|quoi|dont|où)\s/i,
  /^(the|a|an)\s/i,
  /^(and|or|but|so|if|when|where|which)\s/i,
  /,\s*$/,
  /^\d+\s*$/,
  /^[\d\.\s,]+$/,
  /^(merci|questions?|fin|the end|thank you)$/i,
  /^(copyright|©|\d{4}|all rights reserved)/i,
  /^(page|p\.|seite)\s*\d+$/i,
  /^(figure|fig\.|tableau|table|graph)\s*\d+/i,
];

// =============================================================================
// MAIN CLASS
// =============================================================================

export class DocumentStructureDetector {
  private pages: string[];
  private language: 'fr' | 'en';
  private allLines: LineInfo[] = [];
  private tocEntries: string[] = [];

  constructor(pages: string[]) {
    this.pages = pages.map(p => this.cleanPdfText(p));
    this.language = this.detectLanguage();
  }

  /**
   * Main detection pipeline
   */
  detect(): DocumentStructure {
    // Step 1: Extract and score all lines
    this.extractAndScoreLines();

    // Step 2: Find table of contents
    this.findTableOfContents();

    // Step 3: Identify chapter titles using multi-strategy approach
    const chapterLines = this.identifyChapters();

    // Step 4: Build sections with page ranges
    const sections = this.buildSections(chapterLines);

    // Step 5: Detect subsections
    this.detectSubsections(sections);

    // Step 6: Detect document type
    const docType = this.detectDocumentType(sections);

    // Calculate overall confidence
    const avgConfidence = sections.length > 0
      ? sections.reduce((sum, s) => sum + s.confidence, 0) / sections.length
      : 0.1;

    return {
      title: this.extractDocumentTitle(),
      documentType: docType,
      structureType: sections.length > 1 ? 'hierarchical' : 'unstructured',
      sections,
      totalPages: this.pages.length,
      confidence: avgConfidence,
      language: this.language,
      warnings: this.generateWarnings(sections),
    };
  }

  // ---------------------------------------------------------------------------
  // TEXT CLEANING
  // ---------------------------------------------------------------------------

  private cleanPdfText(text: string): string {
    // Unicode ligatures
    const replacements: Record<string, string> = {
      'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl',
      '\x00': '', '\ufeff': '',
    };

    for (const [old, newStr] of Object.entries(replacements)) {
      text = text.split(old).join(newStr);
    }

    // Broken "ti" ligature (when ) appears inside a word)
    text = text.replace(/(\w)\)(\w)/g, '$1ti$2');

    return text;
  }

  // ---------------------------------------------------------------------------
  // LINE EXTRACTION AND SCORING
  // ---------------------------------------------------------------------------

  private extractAndScoreLines(): void {
    for (let pageIdx = 0; pageIdx < this.pages.length; pageIdx++) {
      const lines = this.pages[pageIdx].split('\n');

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const text = lines[lineIdx].trim();
        if (!text || text.length < 3) continue;

        const { score, reasons, level } = this.computeScore(text, lineIdx, lines.length, pageIdx);

        this.allLines.push({
          text,
          page: pageIdx + 1,
          lineIdx,
          score,
          reasons,
          level,
        });
      }
    }
  }

  private computeScore(
    text: string,
    lineIdx: number,
    totalLines: number,
    _pageIdx: number
  ): { score: number; reasons: string[]; level: 1 | 2 } {
    let score = 0;
    const reasons: string[] = [];
    let level: 1 | 2 = 1;

    // ----- FILTERING -----

    // Single word (except structural keywords)
    const words = text.split(/\s+/);
    if (words.length === 1 && text.length < 15) {
      if (!STRUCTURAL_KEYWORDS.includes(text.toLowerCase())) {
        return { score: 0, reasons: ['single_word'], level: 1 };
      }
    }

    // Starts with lowercase
    if (/^[a-zà-ü]/.test(text)) {
      return { score: 0, reasons: ['starts_lowercase'], level: 1 };
    }

    // Noise patterns
    for (const pattern of NOISE_PATTERNS) {
      if (pattern.test(text)) {
        return { score: 0, reasons: ['noise'], level: 1 };
      }
    }

    // ----- EXPLICIT PATTERNS (highest priority) -----
    for (const [name, pattern] of Object.entries(EXPLICIT_PATTERNS)) {
      if (pattern.test(text)) {
        score += 0.7;
        reasons.push(`explicit:${name}`);
        break;
      }
    }

    // ----- SUB PATTERNS -----
    for (const [name, pattern] of Object.entries(SUB_PATTERNS)) {
      if (pattern.test(text)) {
        score += 0.3;
        level = 2;
        reasons.push(`sub:${name}`);
        break;
      }
    }

    // ----- LENGTH -----
    if (text.length <= 40) {
      score += 0.25;
      reasons.push('short');
    } else if (text.length <= 80) {
      score += 0.1;
      reasons.push('medium');
    } else {
      score -= 0.3;
      reasons.push('long');
    }

    // ----- ALL CAPS -----
    const upperCount = (text.match(/[A-ZÀ-Ü]/g) || []).length;
    const letterCount = (text.match(/[a-zA-ZÀ-ü]/g) || []).length;

    if (letterCount > 0 && upperCount / letterCount > 0.8 && text.length > 3) {
      score += 0.35;
      reasons.push('all_caps');
    }

    // ----- TITLE CASE -----
    const titleCaseWords = words.filter(w =>
      w.length > 0 && w[0] === w[0].toUpperCase()
    ).length;
    if (words.length > 1 && titleCaseWords / words.length > 0.8) {
      score += 0.2;
      reasons.push('title_case');
    }

    // ----- POSITION ON PAGE -----
    if (totalLines > 0 && lineIdx / totalLines < 0.15) {
      score += 0.15;
      reasons.push('top_of_page');
    }

    // ----- STRUCTURAL KEYWORDS -----
    const textLower = text.toLowerCase();
    if (STRUCTURAL_KEYWORDS.some(kw => textLower.includes(kw))) {
      score += 0.15;
      reasons.push('structural_keyword');
    }

    // ----- CONTENT INDICATORS (penalty) -----
    if (/\b(is|are|was|were|est|sont|était|étaient)\b/i.test(text)) {
      score -= 0.2;
      reasons.push('content_verb');
    }

    // ----- NO FINAL PUNCTUATION -----
    if (/[.,:;!?]$/.test(text)) {
      score -= 0.15;
      reasons.push('final_punctuation');
    }

    // Normalize
    score = Math.max(0, Math.min(1, score));

    return { score, reasons, level };
  }

  // ---------------------------------------------------------------------------
  // TABLE OF CONTENTS DETECTION
  // ---------------------------------------------------------------------------

  private findTableOfContents(): void {
    const tocIndicators = [
      'sommaire', 'table des matières', 'contents',
      'table of contents', 'plan', 'index'
    ];

    // Extract document title from page 1 to exclude it from TOC
    const documentTitles = this.extractDocumentTitles();

    for (let pageIdx = 0; pageIdx < Math.min(5, this.pages.length); pageIdx++) {
      const pageText = this.pages[pageIdx];
      const lines = pageText.split('\n').map(l => l.trim()).filter(l => l);
      const pageLower = pageText.toLowerCase();

      // Check for explicit TOC indicators OR structural TOC pattern
      const hasExplicitIndicator = tocIndicators.some(ind => pageLower.includes(ind));
      const looksLikeToc = this.looksLikeToc(lines);

      if (hasExplicitIndicator || looksLikeToc) {
        for (const line of lines) {
          // Skip TOC indicators themselves
          if (tocIndicators.some(ind => line.toLowerCase().includes(ind))) continue;
          // Skip standalone page numbers
          if (/^\d{1,3}$/.test(line)) continue;
          // Skip the document title (usually first line of first page)
          if (pageIdx === 0 && lines.indexOf(line) === 0) continue;

          if (line.length <= 60 && line.length > 2) {
            const clean = line.replace(/[\.\s_]+\d{1,3}\s*$/, '').trim();
            if (clean && clean.length > 2) {
              // Skip if this matches the document title
              const isDocTitle = documentTitles.some(title =>
                this.textSimilarity(clean, title) > 0.8
              );
              if (!isDocTitle) {
                this.tocEntries.push(clean);
              }
            }
          }
        }
        if (this.tocEntries.length >= 2) break; // Need at least 2 entries for a valid TOC
      }
    }
  }

  /**
   * Extract potential document titles from page 1
   */
  private extractDocumentTitles(): string[] {
    const titles: string[] = [];

    if (this.pages.length === 0) return titles;

    const firstPageLines = this.pages[0].split('\n').map(l => l.trim()).filter(l => l);

    // First 3 lines of page 1 are potential titles
    for (const line of firstPageLines.slice(0, 3)) {
      if (line.length > 3 && line.length < 80) {
        // Clean numbering prefix like "1." or "2."
        const cleaned = line.replace(/^\d+\.\s*/, '').trim();
        titles.push(line);
        if (cleaned !== line) {
          titles.push(cleaned);
        }
      }
    }

    return titles;
  }

  private looksLikeToc(lines: string[]): boolean {
    if (lines.length < 3 || lines.length > 15) return false;

    let titleLike = 0;
    for (const line of lines) {
      if (line.length < 60 && line.length > 2 && !/^\d{1,3}$/.test(line)) {
        if (/[\.\s_]+\d{1,3}\s*$/.test(line)) {
          titleLike++;
        } else if (/^(\d+[\.\)]|[IVXLC]+[\.\)]|[A-Z][\.\)])/.test(line)) {
          titleLike++;
        } else if (
          line.length < 40 &&
          line[0] === line[0].toUpperCase() &&
          !/[.,:;!?]$/.test(line) &&
          line.split(/\s+/).length <= 6
        ) {
          titleLike++;
        }
      }
    }

    return lines.length > 0 && titleLike / lines.length > 0.5;
  }

  // ---------------------------------------------------------------------------
  // CHAPTER IDENTIFICATION (Multi-strategy)
  // ---------------------------------------------------------------------------

  private identifyChapters(): LineInfo[] {
    // Strategy 1: Explicit chapters (COURS, Chapter, etc.)
    const explicitChapters = this.allLines.filter(l =>
      l.reasons.some(r => r.startsWith('explicit:'))
    );

    if (explicitChapters.length >= 2) {
      // Strategy 1 matched
      return this.deduplicateByPage(explicitChapters);
    }

    // Strategy 2: TOC matching
    if (this.tocEntries.length > 0) {
      const matched = this.matchTocEntries();
      if (matched.length >= 2) {
        // Strategy 2 matched
        return matched;
      }
    }

    // Strategy 3: Repetition detection (slides)
    const repeated = this.detectByRepetition();
    if (repeated.length >= 3) {
      // Strategy 3 matched
      return this.deduplicateByPage(repeated);
    }

    // Strategy 4: Score-based detection
    const scored = this.detectByScore();
    // Strategy 4 fallback
    return scored;
  }

  private matchTocEntries(): LineInfo[] {
    const matched: LineInfo[] = [];
    let tocPage: number | null = null;

    // Find TOC page to exclude
    for (const line of this.allLines) {
      for (const entry of this.tocEntries.slice(0, 2)) {
        if (this.textSimilarity(entry, line.text) > 0.9) {
          tocPage = line.page;
          break;
        }
      }
      if (tocPage) break;
    }

    const usedPages = new Set<number>();
    if (tocPage) usedPages.add(tocPage);

    // First pass: find exact matches for each TOC entry
    const tocMatches: Array<{ entry: string; match: LineInfo | null; index: number }> = [];

    for (let i = 0; i < this.tocEntries.length; i++) {
      const tocEntry = this.tocEntries[i];
      let bestMatch: LineInfo | null = null;
      let bestScore = 0;

      for (const line of this.allLines) {
        if (usedPages.has(line.page)) continue;

        const similarity = this.textSimilarity(tocEntry, line.text);

        if (similarity > 0.7) {
          const pagePenalty = line.page / this.pages.length * 0.1;
          const combinedScore = similarity - pagePenalty;

          if (combinedScore > bestScore) {
            bestScore = combinedScore;
            bestMatch = line;
          }
        }
      }

      if (bestMatch) {
        usedPages.add(bestMatch.page);
      }

      tocMatches.push({ entry: tocEntry, match: bestMatch, index: i });
    }

    // Second pass: interpolate missing entries based on found matches
    const foundMatches = tocMatches.filter(m => m.match !== null);

    for (const tm of tocMatches) {
      if (tm.match) {
        // Direct match found
        tm.match.score = Math.max(tm.match.score, 0.7);
        matched.push(tm.match);
      } else {
        // No direct match - interpolate page based on neighbors
        const prevFound = foundMatches.filter(f => f.index < tm.index).pop();
        const nextFound = foundMatches.find(f => f.index > tm.index);

        let estimatedPage: number;

        if (prevFound?.match && nextFound?.match) {
          // Interpolate between prev and next
          const prevPage = prevFound.match.page;
          const nextPage = nextFound.match.page;
          const ratio = (tm.index - prevFound.index) / (nextFound.index - prevFound.index);
          estimatedPage = Math.round(prevPage + (nextPage - prevPage) * ratio);
        } else if (prevFound?.match) {
          // Extrapolate after prev
          const avgPagesPerChapter = Math.ceil(this.pages.length / this.tocEntries.length);
          estimatedPage = Math.min(this.pages.length, prevFound.match.page + avgPagesPerChapter);
        } else if (nextFound?.match) {
          // Extrapolate before next
          const avgPagesPerChapter = Math.ceil(this.pages.length / this.tocEntries.length);
          estimatedPage = Math.max(1, nextFound.match.page - avgPagesPerChapter);
        } else {
          // No neighbors found, skip
          continue;
        }

        // Avoid duplicate pages
        while (usedPages.has(estimatedPage) && estimatedPage < this.pages.length) {
          estimatedPage++;
        }

        if (!usedPages.has(estimatedPage)) {
          // Create a synthetic LineInfo for this interpolated chapter
          matched.push({
            text: tm.entry,
            page: estimatedPage,
            lineIdx: 0,
            score: 0.5, // Lower confidence for interpolated
            reasons: ['toc_interpolated'],
            level: 1,
          });
          usedPages.add(estimatedPage);
        }
      }
    }

    return matched.sort((a, b) => a.page - b.page);
  }

  private detectByRepetition(): LineInfo[] {
    const titleCounts = new Map<string, LineInfo[]>();

    for (const line of this.allLines) {
      if (line.score < 0.3) continue;
      const norm = this.normalizeTitle(line.text);
      if (!norm || norm.length < 3) continue;

      if (!titleCounts.has(norm)) {
        titleCounts.set(norm, []);
      }
      titleCounts.get(norm)!.push(line);
    }

    const repeated: LineInfo[] = [];
    for (const [_, occurrences] of titleCounts) {
      if (occurrences.length >= 2) {
        const first = occurrences[0];
        first.score = Math.min(1, first.score + 0.2);
        repeated.push(first);
      }
    }

    return repeated;
  }

  private detectByScore(): LineInfo[] {
    // Best title per page (top 5 lines only)
    const pageMap = new Map<number, LineInfo>();

    for (const line of this.allLines) {
      if (line.score < 0.5 || line.lineIdx > 5) continue;

      const existing = pageMap.get(line.page);
      if (!existing || line.score > existing.score) {
        pageMap.set(line.page, line);
      }
    }

    return this.deduplicateByPage(
      Array.from(pageMap.values())
        .filter(l => l.score >= 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)
    );
  }

  private deduplicateByPage(lines: LineInfo[]): LineInfo[] {
    const selected: LineInfo[] = [];
    const usedNormalized = new Set<string>();

    for (const line of lines) {
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
  // SECTION BUILDING
  // ---------------------------------------------------------------------------

  private buildSections(chapterLines: LineInfo[]): DetectedSection[] {
    const sections: DetectedSection[] = [];
    const sorted = [...chapterLines].sort((a, b) => a.page - b.page);

    for (let i = 0; i < sorted.length; i++) {
      const line = sorted[i];
      const nextLine = sorted[i + 1];

      const endPage = nextLine ? nextLine.page - 1 : this.pages.length;

      // Extract number from title
      const numberMatch = line.text.match(/^(?:COURS|CHAPITRE|CHAPTER|PARTIE|PART|SESSION|MODULE|UNIT|LESSON)\s*(\d+)/i);
      const romanMatch = line.text.match(/^([IVXLC]+)\./);
      const number = numberMatch?.[1] || romanMatch?.[1] || null;

      // Check for formulas in section content
      const sectionText = this.pages
        .slice(line.page - 1, Math.min(line.page + 2, this.pages.length))
        .join(' ');
      const hasFormulas = this.sectionHasFormulas(sectionText);

      sections.push({
        title: line.text,
        titleNormalized: this.normalizeTitle(line.text),
        startPage: line.page,
        endPage: Math.max(endPage, line.page),
        level: line.level,
        number,
        hasFormulas,
        confidence: line.score,
        detectionMethod: line.reasons.join(', '),
        children: [],
      });
    }

    return sections;
  }

  private detectSubsections(sections: DetectedSection[]): void {
    for (const section of sections) {
      const subCandidates = this.allLines.filter(l =>
        l.page >= section.startPage &&
        l.page <= section.endPage &&
        l.level === 2 &&
        l.score >= 0.35 &&
        l.text !== section.title &&
        l.text.length >= 5 &&
        !/^[\d\.\s,]+$/.test(l.text)
      );

      for (let i = 0; i < subCandidates.length; i++) {
        const line = subCandidates[i];
        const nextLine = subCandidates[i + 1];

        const endPage = nextLine ? nextLine.page - 1 : section.endPage;

        section.children.push({
          title: line.text,
          titleNormalized: this.normalizeTitle(line.text),
          startPage: line.page,
          endPage: Math.max(endPage, line.page),
          level: 2,
          number: null,
          hasFormulas: false,
          confidence: line.score,
          detectionMethod: line.reasons.join(', '),
          children: [],
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  private detectLanguage(): 'fr' | 'en' {
    const sample = this.pages.slice(0, 3).join(' ').toLowerCase();

    const frIndicators = ['le ', 'la ', 'les ', 'de ', 'est ', 'sont ', 'dans '];
    const enIndicators = ['the ', 'is ', 'are ', 'of ', 'and ', 'in ', 'to '];

    const frCount = frIndicators.reduce((sum, w) => sum + (sample.split(w).length - 1), 0);
    const enCount = enIndicators.reduce((sum, w) => sum + (sample.split(w).length - 1), 0);

    return frCount > enCount ? 'fr' : 'en';
  }

  private normalizeTitle(text: string): string {
    return text
      .toLowerCase()
      .replace(/^(cours|chapitre|chapter|partie|part|section|session|module|unit|lesson)\s*\d+[\.:]*\s*/i, '')
      .replace(/^[IVXLC]+\.\s*/i, '')
      .replace(/^\d+[\.\)]\s*/, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private textSimilarity(text1: string, text2: string): number {
    const norm1 = this.normalizeTitle(text1);
    const norm2 = this.normalizeTitle(text2);

    if (norm1 === norm2) return 1.0;

    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const shorter = Math.min(norm1.length, norm2.length);
      const longer = Math.max(norm1.length, norm2.length);
      return longer > 0 ? shorter / longer : 0;
    }

    const words1 = new Set(norm1.split(' '));
    const words2 = new Set(norm2.split(' '));

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;

    return union > 0 ? intersection / union : 0;
  }

  private sectionHasFormulas(text: string): boolean {
    const lower = text.toLowerCase();

    for (const indicator of FORMULA_INDICATORS) {
      if (lower.includes(indicator)) return true;
    }

    // Math symbols
    if (/[Σ∑∫∂√±×÷≤≥≠≈∞∝∆∇]/.test(text)) return true;
    if (/[=+\-*/]\s*[a-zA-Z]+\s*[=+\-*/]/.test(text)) return true;

    return false;
  }

  private detectDocumentType(sections: DetectedSection[]): DocumentStructure['documentType'] {
    const allText = this.pages.join(' ').toLowerCase();
    const avgPagesPerSection = sections.length > 0
      ? this.pages.length / sections.length
      : this.pages.length;

    // Scientific
    const scientificKeywords = ['abstract', 'introduction', 'methodology', 'results', 'discussion', 'conclusion', 'references'];
    if (scientificKeywords.filter(k => allText.includes(k)).length >= 4) return 'scientific';

    // Legal
    if (/§\s*\d+|article\s+\d+/i.test(allText)) return 'legal';

    // Slides (short sections)
    if (avgPagesPerSection < 3) return 'slides';

    // Technical
    const technicalKeywords = ['installation', 'configuration', 'api', 'setup', 'prerequisites'];
    if (technicalKeywords.filter(k => allText.includes(k)).length >= 2) return 'technical';

    // Textbook
    if (sections.some(s => s.detectionMethod.includes('explicit:'))) return 'textbook';
    if (this.pages.length > 50) return 'textbook';

    // Notes
    if (this.pages.length > 10) return 'notes';

    return 'unknown';
  }

  private extractDocumentTitle(): string {
    // First non-empty line of first page that looks like a title
    const firstPageLines = this.pages[0]?.split('\n').map(l => l.trim()).filter(l => l) || [];

    for (const line of firstPageLines.slice(0, 5)) {
      if (line.length > 5 && line.length < 100) {
        // Skip if it's a date, page number, etc.
        if (/^\d+$/.test(line)) continue;
        if (/^(page|copyright|©)/i.test(line)) continue;
        return line;
      }
    }

    return 'Document';
  }

  private generateWarnings(sections: DetectedSection[]): string[] {
    const warnings: string[] = [];

    if (sections.length === 0) {
      warnings.push('No clear section structure detected');
    }

    if (sections.length === 1 && this.pages.length > 20) {
      warnings.push('Only one section detected for a long document - structure may be ambiguous');
    }

    const lowConfidence = sections.filter(s => s.confidence < 0.5);
    if (lowConfidence.length > sections.length / 2) {
      warnings.push('Many sections have low detection confidence');
    }

    return warnings;
  }
}

// =============================================================================
// EXPORTED FUNCTIONS
// =============================================================================

/**
 * Detect document structure from pages
 */
export function detectDocumentStructure(pages: string[]): DocumentStructure {
  const detector = new DocumentStructureDetector(pages);
  return detector.detect();
}

/**
 * Capitalize first letter of a title
 */
function capitalizeTitle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  // Find first letter and capitalize it
  const match = trimmed.match(/^([^a-zA-ZÀ-ÿ]*)([a-zA-ZÀ-ÿ])(.*)/);
  if (match) {
    return match[1] + match[2].toUpperCase() + match[3];
  }
  return trimmed;
}

/**
 * Convert structure to simplified chapter format for quiz pipeline
 */
export function structureToChapters(
  structure: DocumentStructure,
  pages: string[]
): Array<{
  index: number;
  title: string;
  short_summary: string;
  difficulty: number;
  startPage: number;
  endPage: number;
  hasFormulas: boolean;
}> {
  const mainSections = structure.sections.filter(s => s.level === 1);

  return mainSections.map((section, i) => {
    // Extract first 200 chars of section for summary
    const sectionPages = pages.slice(section.startPage - 1, section.endPage);
    const sectionText = sectionPages.join(' ').substring(0, 500);
    const summary = sectionText.substring(0, 200).trim() + '...';

    // Estimate difficulty
    let difficulty = 1;
    if (section.hasFormulas) difficulty++;
    if (i > mainSections.length / 2) difficulty++;
    difficulty = Math.min(3, difficulty);

    // Get title and ensure it starts with uppercase
    const rawTitle = section.titleNormalized || section.title;
    const title = capitalizeTitle(rawTitle);

    return {
      index: i + 1,
      title,
      short_summary: summary,
      difficulty,
      startPage: section.startPage,
      endPage: section.endPage,
      hasFormulas: section.hasFormulas,
    };
  });
}

/**
 * Quick detection without full analysis (for preview)
 */
export function detectStructureQuick(pages: string[]): {
  estimatedChapters: number;
  documentType: string;
  hasStructure: boolean;
} {
  const detector = new DocumentStructureDetector(pages);
  const structure = detector.detect();

  return {
    estimatedChapters: structure.sections.length,
    documentType: structure.documentType,
    hasStructure: structure.sections.length > 1,
  };
}
