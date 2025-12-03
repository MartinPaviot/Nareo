/**
 * PDF Parser - Uses pdf2json library for REAL text extraction
 *
 * Extracts actual text content from PDFs without hallucination
 * This ensures the learning content matches the actual PDF content
 *
 * Enhanced with comprehensive corruption detection for:
 * - Ligature corruption (ti → ), fi → ?, etc.)
 * - Hangul/CJK characters in formulas (Korean chars replacing Greek letters)
 * - Math symbol corruption
 * - Font encoding issues
 */

import PDFParser from 'pdf2json';
import {
  calculateReadabilityScore,
  extractTextFromPdfWithVision,
  validateExtractedText
} from './openai-fallback';

/**
 * Common ligature corruption patterns found in PDFs
 * These occur when fonts encode ligatures (ti, fi, fl, ff) as single glyphs
 * that get decoded incorrectly
 */
const LIGATURE_CORRUPTION_PATTERNS: Array<{ pattern: RegExp; replacement: string; description: string }> = [
  // ti ligature corrupted to ) - very common in PowerPoint exports
  { pattern: /(\w)[\)\]](\w)/g, replacement: '$1ti$2', description: 'ti→) corruption' },
  // Specific known corrupted words
  { pattern: /Introduc\)on/gi, replacement: 'Introduction', description: 'Introduction' },
  { pattern: /Valua\)on/gi, replacement: 'Valuation', description: 'Valuation' },
  { pattern: /Crea\)on/gi, replacement: 'Creation', description: 'Creation' },
  { pattern: /Acquisi\)on/gi, replacement: 'Acquisition', description: 'Acquisition' },
  { pattern: /Diversifica\)on/gi, replacement: 'Diversification', description: 'Diversification' },
  { pattern: /Consolida\)on/gi, replacement: 'Consolidation', description: 'Consolidation' },
  { pattern: /Integra\)on/gi, replacement: 'Integration', description: 'Integration' },
  { pattern: /Deprecia\)on/gi, replacement: 'Depreciation', description: 'Depreciation' },
  { pattern: /amor\)za\)on/gi, replacement: 'amortization', description: 'amortization' },
  { pattern: /Amor\)za\)on/gi, replacement: 'Amortization', description: 'Amortization' },
  { pattern: /opera\)ng/gi, replacement: 'operating', description: 'operating' },
  { pattern: /Opera\)ng/gi, replacement: 'Operating', description: 'Operating' },
  { pattern: /es\)ma\)/gi, replacement: 'estimat', description: 'estimat' },
  { pattern: /Es\)ma\)/gi, replacement: 'Estimat', description: 'Estimat' },
  { pattern: /ra\)o/gi, replacement: 'ratio', description: 'ratio' },
  { pattern: /Ra\)o/gi, replacement: 'Ratio', description: 'Ratio' },
  { pattern: /ques\)on/gi, replacement: 'question', description: 'question' },
  { pattern: /Ques\)on/gi, replacement: 'Question', description: 'Question' },
  { pattern: /transac\)on/gi, replacement: 'transaction', description: 'transaction' },
  { pattern: /Transac\)on/gi, replacement: 'Transaction', description: 'Transaction' },
  { pattern: /compe\)\)ve/gi, replacement: 'competitive', description: 'competitive' },
  { pattern: /Compe\)\)ve/gi, replacement: 'Competitive', description: 'Competitive' },
  { pattern: /posi\)ve/gi, replacement: 'positive', description: 'positive' },
  { pattern: /nega\)ve/gi, replacement: 'negative', description: 'negative' },
  { pattern: /rela\)ve/gi, replacement: 'relative', description: 'relative' },
  { pattern: /alterna\)ve/gi, replacement: 'alternative', description: 'alternative' },
  { pattern: /incen\)ve/gi, replacement: 'incentive', description: 'incentive' },
  { pattern: /objec\)ve/gi, replacement: 'objective', description: 'objective' },
  { pattern: /effec\)ve/gi, replacement: 'effective', description: 'effective' },
  { pattern: /ac\)vi\)/gi, replacement: 'activit', description: 'activit' },
  { pattern: /quan\)t/gi, replacement: 'quantit', description: 'quantit' },
  { pattern: /iden\)f/gi, replacement: 'identif', description: 'identif' },
  { pattern: /prac\)c/gi, replacement: 'practic', description: 'practic' },
  { pattern: /sec\)on/gi, replacement: 'section', description: 'section' },
  { pattern: /func\)on/gi, replacement: 'function', description: 'function' },
  { pattern: /equa\)on/gi, replacement: 'equation', description: 'equation' },
  { pattern: /solu\)on/gi, replacement: 'solution', description: 'solution' },
  { pattern: /condi\)on/gi, replacement: 'condition', description: 'condition' },
  { pattern: /defini\)on/gi, replacement: 'definition', description: 'definition' },
  { pattern: /assump\)on/gi, replacement: 'assumption', description: 'assumption' },
  { pattern: /descrip\)on/gi, replacement: 'description', description: 'description' },
  { pattern: /op\)m/gi, replacement: 'optim', description: 'optim' },
  { pattern: /mul\)pl/gi, replacement: 'multipl', description: 'multipl' },
  { pattern: /par\)cip/gi, replacement: 'particip', description: 'particip' },
  { pattern: /compe\)t/gi, replacement: 'competit', description: 'competit' },
  { pattern: /ini\)a/gi, replacement: 'initia', description: 'initia' },
  { pattern: /poten\)al/gi, replacement: 'potential', description: 'potential' },
  { pattern: /substan\)al/gi, replacement: 'substantial', description: 'substantial' },
  { pattern: /essen\)al/gi, replacement: 'essential', description: 'essential' },
  // fi ligature corruption
  { pattern: /(\w)fi(\w)/g, replacement: '$1fi$2', description: 'fi ligature' },
  { pattern: /bene\?t/gi, replacement: 'benefit', description: 'benefit' },
  { pattern: /pro\?t/gi, replacement: 'profit', description: 'profit' },
  { pattern: /signi\?cant/gi, replacement: 'significant', description: 'significant' },
  { pattern: /speci\?c/gi, replacement: 'specific', description: 'specific' },
  { pattern: /\?nancial/gi, replacement: 'financial', description: 'financial' },
  { pattern: /\?rm/gi, replacement: 'firm', description: 'firm' },
  { pattern: /\?rst/gi, replacement: 'first', description: 'first' },
  // Number-in-word corruption (ti→5)
  { pattern: /Valua5on/gi, replacement: 'Valuation', description: 'Valua5on' },
  { pattern: /defini5on/gi, replacement: 'definition', description: 'defini5on' },
  { pattern: /acquisi5on/gi, replacement: 'acquisition', description: 'acquisi5on' },
  { pattern: /opera5ng/gi, replacement: 'operating', description: 'opera5ng' },
  { pattern: /es5mate/gi, replacement: 'estimate', description: 'es5mate' },
];

/**
 * Hangul (Korean) character ranges that indicate font corruption
 * These appear when math fonts are incorrectly decoded
 */
const HANGUL_RANGES = [
  /[\uAC00-\uD7AF]/g,  // Hangul Syllables
  /[\u1100-\u11FF]/g,  // Hangul Jamo
  /[\u3130-\u318F]/g,  // Hangul Compatibility Jamo
  /[\uA960-\uA97F]/g,  // Hangul Jamo Extended-A
  /[\uD7B0-\uD7FF]/g,  // Hangul Jamo Extended-B
];

/**
 * CJK character ranges (Chinese/Japanese/Korean)
 */
const CJK_RANGES = [
  /[\u4E00-\u9FFF]/g,  // CJK Unified Ideographs
  /[\u3400-\u4DBF]/g,  // CJK Unified Ideographs Extension A
  /[\uF900-\uFAFF]/g,  // CJK Compatibility Ideographs
];

/**
 * Private Use Area characters - often indicate font corruption
 */
const PRIVATE_USE_RANGES = [
  /[\uE000-\uF8FF]/g,  // Private Use Area
  /[\uF0000-\uFFFFD]/g, // Supplementary Private Use Area-A
];

/**
 * Detect if text contains Hangul/CJK characters that shouldn't be there
 * These indicate severe font encoding corruption
 */
function detectHangulCJKCorruption(text: string): {
  detected: boolean;
  hangulCount: number;
  cjkCount: number;
  privateUseCount: number;
  examples: string[]
} {
  let hangulCount = 0;
  let cjkCount = 0;
  let privateUseCount = 0;
  const examples: string[] = [];

  // Count Hangul characters
  for (const range of HANGUL_RANGES) {
    const matches = text.match(range) || [];
    hangulCount += matches.length;
    if (matches.length > 0 && examples.length < 5) {
      examples.push(`Hangul: ${matches.slice(0, 3).join(', ')}`);
    }
  }

  // Count CJK characters
  for (const range of CJK_RANGES) {
    const matches = text.match(range) || [];
    cjkCount += matches.length;
    if (matches.length > 0 && examples.length < 5) {
      examples.push(`CJK: ${matches.slice(0, 3).join(', ')}`);
    }
  }

  // Count Private Use Area characters
  for (const range of PRIVATE_USE_RANGES) {
    const matches = text.match(range) || [];
    privateUseCount += matches.length;
  }

  // For academic/financial documents in Latin script, ANY Hangul/CJK is corruption
  // For PUA characters: use ratio-based detection (>30% of text) instead of absolute count
  // PUA chars are common in academic PDFs for math symbols, arrows, special fonts
  const textLength = text.length;
  const puaRatio = textLength > 0 ? privateUseCount / textLength : 0;
  const puaCorrupted = puaRatio > 0.3; // Only flag if >30% of text is PUA

  const detected = hangulCount > 0 || cjkCount > 0 || puaCorrupted;

  return { detected, hangulCount, cjkCount, privateUseCount, examples };
}

/**
 * Detect ligature corruption patterns
 * Returns corruption instances and severity
 */
function detectLigatureCorruption(text: string): {
  detected: boolean;
  score: number;
  instances: string[];
  fixableCount: number;
} {
  const instances: string[] = [];
  let score = 0;
  let fixableCount = 0;

  // Check for ) appearing inside words (ti→) corruption)
  const parenthesisInWord = text.match(/\w\)\w/g) || [];
  if (parenthesisInWord.length > 0) {
    score += parenthesisInWord.length * 10;
    fixableCount += parenthesisInWord.length;
    instances.push(`Parenthesis-in-word: ${parenthesisInWord.length} (e.g., ${parenthesisInWord.slice(0, 3).join(', ')})`);
  }

  // Check for known corrupted patterns
  for (const { pattern, description } of LIGATURE_CORRUPTION_PATTERNS) {
    const matches = text.match(pattern) || [];
    if (matches.length > 0) {
      score += matches.length * 5;
      fixableCount += matches.length;
      if (instances.length < 10) {
        instances.push(`${description}: ${matches.length}`);
      }
    }
  }

  // Check for ? appearing in word context (fi→? corruption)
  const questionInWord = text.match(/\w\?\w/g) || [];
  if (questionInWord.length > 2) {
    score += questionInWord.length * 8;
    fixableCount += questionInWord.length;
    instances.push(`Question-in-word: ${questionInWord.length}`);
  }

  const detected = score >= 15 || fixableCount >= 3;

  return { detected, score, instances, fixableCount };
}

/**
 * Comprehensive corruption detection combining all methods
 */
function hasCorruptedText(text: string): {
  detected: boolean;
  evidence: string[];
  score: number;
  corruptionTypes: string[];
  shouldUseOCR: boolean;
  canBeFixed: boolean;
} {
  const evidence: string[] = [];
  const corruptionTypes: string[] = [];
  const textLength = text.length;
  let corruptionScore = 0;

  // Skip detection for short texts
  if (textLength < 300) {
    return {
      detected: false,
      evidence: [],
      score: 0,
      corruptionTypes: [],
      shouldUseOCR: false,
      canBeFixed: false
    };
  }

  const normalize = (count: number) => (count / textLength) * 1000;

  // === CHECK 1: Hangul/CJK Corruption (CRITICAL - always requires OCR) ===
  const hangulCheck = detectHangulCJKCorruption(text);
  if (hangulCheck.detected) {
    corruptionScore += 100; // Automatic trigger
    corruptionTypes.push('hangul_cjk');
    evidence.push(`Hangul/CJK corruption: ${hangulCheck.hangulCount} Hangul, ${hangulCheck.cjkCount} CJK, ${hangulCheck.privateUseCount} PUA chars`);
    if (hangulCheck.examples.length > 0) {
      evidence.push(`Examples: ${hangulCheck.examples.join('; ')}`);
    }
  }

  // === CHECK 2: Ligature Corruption (can sometimes be fixed) ===
  const ligatureCheck = detectLigatureCorruption(text);
  if (ligatureCheck.detected) {
    corruptionScore += ligatureCheck.score;
    corruptionTypes.push('ligature');
    evidence.push(...ligatureCheck.instances.slice(0, 5));
  }

  // === CHECK 3: Math Symbol Corruption ===
  const mathSymbolChars = text.match(/[úûùêëé](?![a-zA-Z])/g) || [];
  // Filter out French accents in valid words
  const mathSymbolDensity = normalize(mathSymbolChars.length);
  if (mathSymbolDensity > 3) {
    corruptionScore += Math.min(40, mathSymbolDensity * 3);
    corruptionTypes.push('math_symbols');
    evidence.push(`Math symbol corruption: ${mathSymbolChars.length} suspicious chars (density: ${mathSymbolDensity.toFixed(1)}/1000)`);
  }

  // === CHECK 4: Greek Letter Corruption in Formula Context ===
  const greekInFormula = text.match(/[åæø]\s*[=+\-*/×÷]\s*\d|[=+\-*/×÷]\s*[åæø]/gi) || [];
  if (greekInFormula.length >= 2) {
    corruptionScore += Math.min(30, greekInFormula.length * 8);
    corruptionTypes.push('greek_letters');
    evidence.push(`Greek letter corruption: ${greekInFormula.length} instances in formulas`);
  }

  // === CHECK 5: Number-in-Word Corruption (ti→5, fi→1, etc.) ===
  // More specific pattern to avoid false positives
  const numberInWord = text.match(/[a-z][0-9][a-z]{2,}/gi) || [];
  if (numberInWord.length >= 2) {
    corruptionScore += numberInWord.length * 12;
    corruptionTypes.push('number_in_word');
    evidence.push(`Number-in-word corruption: ${numberInWord.slice(0, 5).join(', ')}`);
  }

  // === CHECK 6: Formula Garbage (complex Unicode sequences) ===
  // Pattern for corrupted formulas like "úûùêëé" sequences
  const formulaGarbage = text.match(/[úûùêëéàâäôöïîüç]{3,}/g) || [];
  if (formulaGarbage.length >= 1) {
    corruptionScore += formulaGarbage.length * 20;
    corruptionTypes.push('formula_garbage');
    evidence.push(`Formula garbage sequences: ${formulaGarbage.length} (e.g., ${formulaGarbage[0]})`);
  }

  // === CHECK 7: Financial Document with Issues ===
  const financialKeywords = /WACC|CAPM|DCF|NPV|IRR|EBIT|FCFF|FCFE|beta|alpha|equity|valuation|M&A|merger/gi;
  const financialMatches = text.match(financialKeywords) || [];
  const isFinancialDoc = financialMatches.length >= 3;

  if (isFinancialDoc && corruptionScore >= 20) {
    corruptionScore += 20;
    evidence.push(`Financial document with extraction issues (${financialMatches.length} finance terms)`);
  }

  // Determine outcomes
  const detected = corruptionScore >= 25;

  // Should use OCR if: Hangul/CJK detected OR high corruption score
  const shouldUseOCR = hangulCheck.detected || corruptionScore >= 80;

  // Can be fixed with text replacement if: only ligature corruption, moderate score
  const canBeFixed = !hangulCheck.detected &&
                     ligatureCheck.detected &&
                     corruptionScore < 80 &&
                     ligatureCheck.fixableCount >= 3;

  if (detected) {
    console.log(`🔍 Text corruption detected (score: ${corruptionScore})`);
    console.log(`   Types: ${corruptionTypes.join(', ')}`);
    console.log(`   Should use OCR: ${shouldUseOCR}`);
    console.log(`   Can be text-fixed: ${canBeFixed}`);
    evidence.forEach(e => console.log(`   - ${e}`));
  }

  return {
    detected,
    evidence,
    score: corruptionScore,
    corruptionTypes,
    shouldUseOCR,
    canBeFixed
  };
}

/**
 * Attempt to fix ligature corruption in text
 * Returns the fixed text and statistics
 */
function fixLigatureCorruption(text: string): {
  text: string;
  fixCount: number;
  fixes: string[]
} {
  let fixedText = text;
  let fixCount = 0;
  const fixes: string[] = [];

  for (const { pattern, replacement, description } of LIGATURE_CORRUPTION_PATTERNS) {
    const beforeLength = fixedText.length;
    const matches = fixedText.match(pattern) || [];
    if (matches.length > 0) {
      fixedText = fixedText.replace(pattern, replacement);
      if (fixedText.length !== beforeLength || matches.length > 0) {
        fixCount += matches.length;
        fixes.push(`${description}: ${matches.length} fixed`);
      }
    }
  }

  // Generic ) inside word fix for remaining cases
  // Pattern: word)word → wordtiword (most common corruption)
  const remainingParenInWord = fixedText.match(/([a-z])\)([a-z])/gi) || [];
  if (remainingParenInWord.length > 0) {
    fixedText = fixedText.replace(/([a-z])\)([a-z])/gi, '$1ti$2');
    fixCount += remainingParenInWord.length;
    fixes.push(`Generic ti→) fix: ${remainingParenInWord.length}`);
  }

  return { text: fixedText, fixCount, fixes };
}

/**
 * Detect corrupted mathematical formulas from PDF extraction
 * These patterns indicate pdf2json failed to properly decode math fonts
 *
 * Strategy: Use a scoring system instead of strict pattern counts
 * Different corruption types contribute points, trigger at threshold
 *
 * @deprecated Use hasCorruptedText instead for more comprehensive detection
 */
function hasCorruptedMathFormulas(text: string): { detected: boolean; evidence: string[]; score: number } {
  // Delegate to new comprehensive checker
  const result = hasCorruptedText(text);
  return {
    detected: result.detected,
    evidence: result.evidence,
    score: result.score
  };
}

/**
 * Check if text is truly unreadable and needs OCR fallback
 * Uses comprehensive corruption detection
 *
 * Returns detailed information about:
 * - Whether text is unreadable
 * - The reason for being unreadable
 * - Whether OCR is needed vs text fix is sufficient
 * - Whether the text can be fixed with replacements
 */
function isTextUnreadable(text: string): {
  unreadable: boolean;
  reason: string;
  shouldUseOCR: boolean;
  canBeFixed: boolean;
  corruptionTypes: string[];
} {
  const length = text.length;

  // 1. Text too short
  if (length < 300) {
    return {
      unreadable: true,
      reason: `Text too short (${length} chars < 300)`,
      shouldUseOCR: true,
      canBeFixed: false,
      corruptionTypes: ['insufficient_text']
    };
  }

  // 2. Check for all types of corruption
  const corruptionCheck = hasCorruptedText(text);
  if (corruptionCheck.detected) {
    return {
      unreadable: true,
      reason: `Text corruption detected (score: ${corruptionCheck.score}): ${corruptionCheck.evidence.slice(0, 3).join('; ')}`,
      shouldUseOCR: corruptionCheck.shouldUseOCR,
      canBeFixed: corruptionCheck.canBeFixed,
      corruptionTypes: corruptionCheck.corruptionTypes
    };
  }

  // 3. Calculate basic ratios for general readability
  const readableChars = /[a-zA-ZÀ-ÿ0-9\s.,;:!?'"()\-§•●◦–—]/;
  let readableCharCount = 0;
  for (const char of text) {
    if (readableChars.test(char)) {
      readableCharCount++;
    }
  }
  const readableCharsRatio = readableCharCount / length;

  // 4. Calculate word ratio
  const words = text.split(/\s+/).filter(w => w.length > 0);
  let readableWordCount = 0;
  for (const word of words) {
    if (/[a-zA-Z]/.test(word)) {
      readableWordCount++;
    }
  }
  const readableWordsRatio = words.length > 0 ? readableWordCount / words.length : 0;

  // 5. Apply thresholds
  if (readableCharsRatio < 0.65) {
    return {
      unreadable: true,
      reason: `Low readable chars ratio (${readableCharsRatio.toFixed(2)} < 0.65)`,
      shouldUseOCR: true,
      canBeFixed: false,
      corruptionTypes: ['low_readability']
    };
  }

  if (readableWordsRatio < 0.45) {
    return {
      unreadable: true,
      reason: `Low readable words ratio (${readableWordsRatio.toFixed(2)} < 0.45)`,
      shouldUseOCR: true,
      canBeFixed: false,
      corruptionTypes: ['low_readability']
    };
  }

  // Text is readable
  return {
    unreadable: false,
    reason: 'Text is readable',
    shouldUseOCR: false,
    canBeFixed: false,
    corruptionTypes: []
  };
}

export async function parsePDF(buffer: Buffer): Promise<string> {
  console.log('📄 Parsing PDF document (buffer size:', buffer.length, 'bytes)');

  // Try pdf2json first
  try {
    const text = await parsePDFWithPdf2Json(buffer);
    const cleaned = cleanPDFText(text);

    // Comprehensive readability and corruption check
    const readabilityCheck = isTextUnreadable(cleaned);

    console.log('📊 PDF Extraction Analysis:');
    console.log('   - Text length:', cleaned.length, 'characters');
    console.log('   - Status:', readabilityCheck.unreadable ? '❌ CORRUPTED' : '✅ READABLE');
    console.log('   - Reason:', readabilityCheck.reason);
    if (readabilityCheck.corruptionTypes.length > 0) {
      console.log('   - Corruption types:', readabilityCheck.corruptionTypes.join(', '));
      console.log('   - Should use OCR:', readabilityCheck.shouldUseOCR ? 'YES' : 'NO');
      console.log('   - Can be text-fixed:', readabilityCheck.canBeFixed ? 'YES' : 'NO');
    }

    // Text is readable - return as-is
    if (!readabilityCheck.unreadable) {
      console.log('✅ pdf2json extraction successful: text is readable');
      console.log('📋 First 300 chars:', cleaned.substring(0, 300));
      return cleaned;
    }

    // === CORRUPTION DETECTED ===
    console.log('⚠️ Text corruption detected');
    console.log('📋 Sample of problematic text:', cleaned.substring(0, 300));

    // Strategy 1: Try to fix ligature corruption if possible
    if (readabilityCheck.canBeFixed && !readabilityCheck.shouldUseOCR) {
      console.log('🔧 Attempting text-based corruption fix...');

      const fixResult = fixLigatureCorruption(cleaned);
      console.log(`   - Fixed ${fixResult.fixCount} corruption instances`);
      if (fixResult.fixes.length > 0) {
        console.log(`   - Fixes applied: ${fixResult.fixes.slice(0, 5).join('; ')}`);
      }

      // Re-check after fix
      const recheck = isTextUnreadable(fixResult.text);
      if (!recheck.unreadable) {
        console.log('✅ Text-based fix successful!');
        console.log('📋 First 300 chars after fix:', fixResult.text.substring(0, 300));
        return fixResult.text;
      }

      console.log('⚠️ Text-based fix was not sufficient, falling back to OCR');
    }

    // Strategy 2: Use Vision OCR for severe corruption or when fix failed
    console.log('🔄 Activating Vision OCR fallback...');

    const visionText = await extractTextFromPdfWithVision(buffer);
    const cleanedVisionText = cleanPDFText(visionText);

    // Validate Vision result
    const validation = validateExtractedText(cleanedVisionText, 300);

    if (validation.isValid) {
      console.log('✅ Vision OCR fallback successful:', validation.length, 'characters');
      console.log('📋 First 300 chars from OCR:', cleanedVisionText.substring(0, 300));
      return cleanedVisionText;
    }

    // Strategy 3: If OCR also failed but we have fixable text, use the fixed version
    if (readabilityCheck.canBeFixed) {
      console.log('⚠️ OCR validation failed, using text-fixed version as fallback');
      const fixResult = fixLigatureCorruption(cleaned);
      return fixResult.text;
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
 * Handles spaced letters, control characters, formatting issues,
 * and applies ligature corruption fixes
 */
export function cleanAndNormalizePdfText(text: string): string {
  console.log('🧹 Starting advanced PDF text normalization...');
  console.log('📏 Original length:', text.length);

  // Step 1: Remove control characters
  text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Step 2: Apply ligature corruption fixes EARLY
  // This is critical for PowerPoint/PDF exports with corrupted ligatures
  const ligatureFixResult = fixLigatureCorruption(text);
  if (ligatureFixResult.fixCount > 0) {
    console.log(`🔧 Fixed ${ligatureFixResult.fixCount} ligature corruptions during normalization`);
    text = ligatureFixResult.text;
  }

  // Step 3: Clean up corrupted formula fragments
  // Remove garbage Unicode sequences that often appear in place of formulas
  // Pattern: sequences of accented chars that don't form valid words
  text = text.replace(/[úûùêëéàâäôöïîüç]{4,}/g, '[formula]');

  // Step 4: Detect and merge spaced letters
  // Pattern: "C  O  U  R  S" → "COURS"
  text = text.replace(/([A-ZÀ-ÿ])(\s{1,3})(?=[A-ZÀ-ÿ](\s{1,3}|[A-ZÀ-ÿ]|$))/g, '$1');

  // Handle lowercase spaced letters: "i n f o" → "info"
  text = text.replace(/\b([a-zà-ÿ])(\s{1,2})(?=[a-zà-ÿ](\s{1,2}|$))/g, '$1');

  // Step 5: Compress multiple spaces to single space
  text = text.replace(/[ \t]+/g, ' ');

  // Step 6: Normalize line breaks (max 2 consecutive)
  text = text.replace(/\n{3,}/g, '\n\n');

  // Step 7: Clean common PDF artifacts
  // Remove page numbers that appear on their own line
  text = text.replace(/^\d{1,3}\s*$/gm, '');
  // Remove standalone single characters (often artifacts)
  text = text.replace(/^[§•●◦]\s*$/gm, '');

  // Step 8: Clean up lines
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
