// Thorough, general-purpose PDF comparison and quality checks for study sheets
// Usage:
//   node scripts/fiche-compare-thorough.mjs
// Produces:
//   - public/fichetest/comparaison_IntroEco_02_27_thorough.md
//   - public/fichetest/comparaison_IntroEco_02_26_thorough.md
//   - public/fichetest/comparaison_IntroEco_02_25_thorough.md
//   - public/fichetest/comparaison_IntroEco_02_all.md (aggregated)
// Notes:
// - Generalist scoring (works across disciplines), focusing on essential 20% improvements

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PDFParser = require('pdf2json');

// -------------------------------
// Defaults (can be adapted to other courses)
// -------------------------------
const COURSE_PDF = 'public/Test/IntroEco-02.pdf';
const FICHES = [
  { label: '(27)', path: 'public/fichetest/IntroEco_02_pdf_Study_Sheet (27).pdf' },
  { label: '(26)', path: 'public/fichetest/IntroEco_02_pdf_Study_Sheet (26).pdf' },
  { label: '(25)', path: 'public/fichetest/IntroEco_02_pdf_Study_Sheet (25).pdf' },
];

// -------------------------------
// Utilities
// -------------------------------
function ensureDirSync(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function safeDecodeURIComponent(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeSpaces(text) {
  return text.replace(/[ \t]+/g, ' ').replace(/\s+-\s+/g, '-');
}

function cleanTextBasic(text) {
  if (!text) return '';
  let t = text;

  // Remove control chars
  t = t.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Normalize spaces and hyphens
  t = normalizeSpaces(t);

  // Normalize line breaks (max 2)
  t = t.replace(/\n{3,}/g, '\n\n');

  // Trim, remove empty lines
  t = t
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join('\n');

  return t;
}

// -------------------------------
// PDF extraction with per-page texts
// -------------------------------
async function extractPdfTextWithPages(filePath) {
  const buffer = await fsp.readFile(filePath);
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData) => {
      reject(new Error(`Failed to parse PDF (${filePath}): ${errData?.parserError || 'unknown error'}`));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        const allLines = [];
        const pages = [];

        if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
          for (let pageIdx = 0; pageIdx < pdfData.Pages.length; pageIdx++) {
            const page = pdfData.Pages[pageIdx];
            const items = [];

            if (Array.isArray(page.Texts)) {
              for (const textItem of page.Texts) {
                if (textItem.R && Array.isArray(textItem.R)) {
                  for (const run of textItem.R) {
                    if (!run.T) continue;
                    const decoded = safeDecodeURIComponent(run.T);
                    items.push({
                      x: textItem.x || 0,
                      y: textItem.y || 0,
                      text: decoded
                    });
                  }
                }
              }
            }

            if (items.length === 0) {
              pages.push('');
              allLines.push('', ''); // page separator
              continue;
            }

            // sort by Y then X
            items.sort((a, b) => {
              const yDiff = a.y - b.y;
              if (Math.abs(yDiff) > 0.3) return yDiff;
              return a.x - b.x;
            });

            // group items into rows, then join text per row
            let currentRow = [];
            let currentY = null;
            const pageLines = [];

            for (const it of items) {
              if (currentY === null || Math.abs(it.y - currentY) > 0.5) {
                if (currentRow.length > 0) {
                  pageLines.push(currentRow.map(r => r.text).join(' ').trim());
                }
                currentRow = [it];
                currentY = it.y;
              } else {
                currentRow.push(it);
              }
            }
            if (currentRow.length > 0) {
              pageLines.push(currentRow.map(r => r.text).join(' ').trim());
            }

            const pageText = cleanTextBasic(pageLines.join('\n'));
            pages.push(pageText);
            allLines.push(...pageText.split('\n'), ''); // separator
          }
        }

        const text = cleanTextBasic(allLines.join('\n'));
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        resolve({ text, lines, pages });
      } catch (e) {
        reject(e);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

// -------------------------------
// Tokenization & stopwords (FR/EN/DE minimal)
// -------------------------------
const STOP_FR = new Set([
  'le','la','les','un','une','des','du','de','d','au','aux','et','ou','où','mais','donc','or','ni','car',
  'dans','par','pour','avec','sans','sous','sur','entre','chez','vers','chez','selon','comme',
  'est','sont','été','etre','être','sera','seront','fut','fût','fut','fait','faites','a','ont','avait','avaient',
  'ce','cet','cette','ces','ça','cela','c','il','elle','ils','elles','on','nous','vous','je','tu','y','en',
  'deux','trois','quatre','cinq','six','sept','huit','neuf','dix'
]);
const STOP_EN = new Set([
  'the','a','an','and','or','but','so','nor','for','of','in','on','at','to','from','by','with','as',
  'is','are','was','were','be','been','being','this','that','these','those',
  'it','its','he','she','they','we','you','i','me','him','her','them','us',
  'do','does','did','done','have','has','had','will','would','can','could','may','might','should'
]);
const STOP_DE = new Set([
  'der','die','das','ein','eine','und','oder','aber','denn','sondern','doch',
  'zu','von','mit','auf','für','im','in','am','an','aus','bei','nach','über','unter','zwischen','ohne',
  'ist','sind','war','waren','sein','hat','haben','wird','würde',
  'dies','das','diese','jene','es','er','sie','wir','ihr','ich'
]);

function isStopword(token) {
  const t = token.toLowerCase();
  return STOP_FR.has(t) || STOP_EN.has(t) || STOP_DE.has(t);
}

function tokenizeWords(text) {
  if (!text) return [];
  // Split on non-word characters, filter out short tokens and stopwords
  return text
    .toLowerCase()
    .split(/[^a-zàâäéèêëïîôùûüœæç0-9]+/i)
    .filter(t => t.length >= 3 && !isStopword(t));
}

function countWords(text) {
  return tokenizeWords(text).length;
}

function avgSentenceLength(text) {
  if (!text) return 0;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length === 0) return 0;
  const totalWords = sentences.reduce((sum, s) => sum + countWords(s), 0);
  return totalWords / sentences.length;
}

function extractSectionAfter(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const startIdx = match.index + match[0].length;
      // Extract until next ## heading or end
      const rest = text.slice(startIdx);
      const nextHeading = rest.search(/\n##?\s+[A-Z]/);
      return nextHeading > 0 ? rest.slice(0, nextHeading) : rest.slice(0, 1000);
    }
  }
  return '';
}

// -------------------------------
// Levenshtein distance for similarity
// -------------------------------
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

function stringSimilarity(a, b) {
  const d = levenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length, 1);
}

function jaccard(set1, set2) {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// -------------------------------
// Zone 1: Robust PDF Extraction
// -------------------------------
async function analyzeZone1Extraction(pages, text) {
  const poorPages = [];
  let totalChars = 0;
  let readableChars = 0;

  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i];
    const charCount = pageText.length;
    const wordCount = countWords(pageText);
    totalChars += charCount;

    if (charCount < 60 || wordCount < 5) {
      poorPages.push(i + 1);
    } else {
      readableChars += charCount;
    }
  }

  const extractionQuality = totalChars > 0
    ? Math.round((readableChars / totalChars) * 100)
    : 0;

  return {
    extractionQuality,
    pageCount: pages.length,
    poorPages,
    ocrUsageRatio: pages.length > 0 ? poorPages.length / pages.length : 0,
    totalChars,
    readableChars
  };
}

// -------------------------------
// Zone 2: Real Image Verification (Simplified - text-based detection)
// -------------------------------
function analyzeZone2Images(text, lines) {
  // Detect markdown images
  const markdownImages = (text.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;

  // Detect image mentions
  const imageMentions = (text.match(/\b(figure|graphique|schéma|tableau|diagramme|illustration|image|graph|chart|diagram)\b/gi) || []).length;

  // Detect example patterns
  const examplePatterns = /\b(exemple|example|par exemple|e\.g\.|ex\.|cas pratique)\b/gi;
  const exampleMatches = text.match(examplePatterns) || [];
  const exampleCount = exampleMatches.length;

  // Check proximity: look for image mentions within 3 lines of examples
  let imageNearExampleCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (examplePatterns.test(lines[i])) {
      // Check surrounding lines for image/graph mentions
      const surroundingText = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join(' ');
      if (/\b(figure|graphique|schéma|tableau|diagramme|graph|chart)\b/i.test(surroundingText)) {
        imageNearExampleCount++;
      }
    }
  }

  const totalImages = markdownImages + Math.floor(imageMentions / 2); // Rough estimate
  const educationalRatio = totalImages > 0 ? 0.7 : 0; // Assume most are educational

  const proximityBonus = imageNearExampleCount >= 2 ? 15 : (imageNearExampleCount >= 1 ? 8 : 0);
  const densityBonus = totalImages >= 3 ? 15 : (totalImages >= 1 ? 8 : 0);

  const score = clamp(Math.round(educationalRatio * 70 + proximityBonus + densityBonus), 0, 100);

  return {
    score,
    markdownImages,
    imageMentions,
    exampleCount,
    imageNearExampleCount,
    totalImages
  };
}

// -------------------------------
// Zone 3: Fine Structural Evaluation
// -------------------------------
function analyzeZone3Structure(lines, text) {
  const headingLevels = { level1: 0, level2: 0, level3: 0, deeper: 0 };
  const headingLines = [];

  for (const line of lines) {
    // Markdown headings
    if (/^#{1}\s+\S/.test(line)) {
      headingLevels.level1++;
      headingLines.push(line);
    } else if (/^#{2}\s+\S/.test(line)) {
      headingLevels.level2++;
      headingLines.push(line);
    } else if (/^#{3}\s+\S/.test(line)) {
      headingLevels.level3++;
      headingLines.push(line);
    } else if (/^#{4,}\s+\S/.test(line)) {
      headingLevels.deeper++;
      headingLines.push(line);
    }
    // Numbered headings (1., I., A))
    else if (/^[1-9]\.\s+[A-Z]/.test(line) || /^[IVX]+\.\s+[A-Z]/.test(line)) {
      headingLevels.level2++;
      headingLines.push(line);
    }
    // Uppercase lines (likely headings)
    else if (line.length > 5 && line.length < 80) {
      const upperRatio = (line.match(/[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŒÆ]/g) || []).length / line.length;
      if (upperRatio > 0.6) {
        headingLevels.level1++;
        headingLines.push(line);
      }
    }
  }

  const mainSections = headingLevels.level1 + headingLevels.level2;
  const maxNestingDepth = headingLevels.deeper > 0 ? 4 :
                          headingLevels.level3 > 0 ? 3 :
                          headingLevels.level2 > 0 ? 2 : 1;

  // Section length analysis
  const sectionLengths = [];
  let currentSectionStart = 0;
  for (let i = 1; i < lines.length; i++) {
    if (headingLines.includes(lines[i])) {
      sectionLengths.push(i - currentSectionStart);
      currentSectionStart = i;
    }
  }
  if (currentSectionStart < lines.length) {
    sectionLengths.push(lines.length - currentSectionStart);
  }

  const avgSectionLength = sectionLengths.length > 0
    ? sectionLengths.reduce((a, b) => a + b, 0) / sectionLengths.length
    : lines.length;
  const variance = sectionLengths.length > 0
    ? sectionLengths.reduce((sum, l) => sum + Math.pow(l - avgSectionLength, 2), 0) / sectionLengths.length
    : 0;

  // Title/paragraph balance
  const balance = lines.length > 0 ? headingLines.length / lines.length : 0;
  const idealBalance = 0.15;
  const balanceScore = clamp(100 - Math.abs(balance - idealBalance) * 400, 0, 100);

  // Scoring
  const sectionCountScore = (mainSections >= 5 && mainSections <= 7) ? 100 :
                            clamp(100 - Math.abs(mainSections - 6) * 12, 40, 100);
  const nestingScore = maxNestingDepth <= 3 ? 100 : clamp(100 - (maxNestingDepth - 3) * 25, 40, 100);
  const lengthVarianceScore = clamp(100 - (variance / Math.max(avgSectionLength, 1)) * 30, 40, 100);

  const score = Math.round(0.35 * sectionCountScore + 0.30 * nestingScore + 0.20 * lengthVarianceScore + 0.15 * balanceScore);

  const issues = [];
  if (mainSections < 5) issues.push(`Trop peu de sections principales (${mainSections}, idéal: 5-7)`);
  if (mainSections > 7) issues.push(`Trop de sections principales (${mainSections}, idéal: 5-7)`);
  if (maxNestingDepth > 3) issues.push(`Profondeur excessive (${maxNestingDepth} niveaux, max recommandé: 3)`);
  if (balance < 0.05) issues.push('Manque de structure hiérarchique (peu de titres)');
  if (balance > 0.30) issues.push('Trop fragmenté (trop de titres par rapport au contenu)');

  return {
    score,
    headingLevels,
    mainSections,
    maxNestingDepth,
    sectionLengths: {
      min: Math.min(...sectionLengths, 0),
      max: Math.max(...sectionLengths, 0),
      avg: Math.round(avgSectionLength),
      variance: Math.round(variance)
    },
    titleParagraphBalance: Math.round(balance * 100) / 100,
    issues
  };
}

// -------------------------------
// Zone 4: Robust Duplicate Detection
// -------------------------------
function analyzeZone4Duplicates(lines, text) {
  const exactDuplicates = [];
  const semanticDuplicates = [];

  // Pattern to identify graphic/visual related content (should NOT be penalized as duplicates)
  // Includes variations with/without accents and common educational terms
  const graphicPatterns = /\b(graphique|figure|sch[eé]ma|tableau|diagramme|illustration|image|graph|chart|diagram|courbe|curve|plot|visual|p[eé]dagogique|pedagogique|graphics?|visuel)\b/i;

  // Pattern to identify structural/repeated elements that are normal in study sheets
  // These elements are expected to repeat (e.g., "Questions réflexives" appears in each section)
  const structuralPatterns = /\b(question|r[eé]flexion|reflexion|reflexive|exemple|example|formule|formula|d[eé]finition|definition|revue|review|rappel|reminder|connexion|connection|exercice|exercise|donn[eé]es|etapes?|resolution|calcul|analyse|impact|determiner|identifier|tracer|discutez)\b/i;

  // Compact text for comparison
  function compact(str) {
    return stripDiacritics(str.toLowerCase())
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 200);
  }

  // Check if a line is related to graphics/visuals (should be excluded from duplicate detection)
  function isGraphicRelated(line) {
    return graphicPatterns.test(line);
  }

  // Check if a line is a structural element (less penalty for duplicates)
  function isStructuralElement(line) {
    return structuralPatterns.test(line);
  }

  // Extract headings/sections for duplicate check, EXCLUDING graphic-related AND structural lines
  const sections = [];
  for (const line of lines) {
    // Skip lines that are about graphics/visuals - these are expected to repeat
    if (isGraphicRelated(line)) {
      continue;
    }

    // Skip structural elements entirely - they are meant to repeat (e.g., "Questions réflexives:")
    if (isStructuralElement(line)) {
      continue;
    }

    if (/^#{1,3}\s+/.test(line) || line.length > 20 && line.length < 100) {
      const cleaned = line.replace(/^#+\s*/, '').trim();
      if (cleaned.length > 10) {
        sections.push({
          original: line,
          compact: compact(cleaned),
          words: new Set(tokenizeWords(cleaned)),
          isStructural: false // Now always false since we skip structural above
        });
      }
    }
  }

  // Find duplicates (but not graphic-related ones)
  const seen = new Map();
  for (const section of sections) {
    if (seen.has(section.compact)) {
      // Only count as duplicate if NOT a structural element
      if (!section.isStructural) {
        exactDuplicates.push({ text: section.original, count: 2 });
      }
    } else {
      seen.set(section.compact, section.original);
    }
  }

  // Find near-duplicates via Jaccard (excluding graphic-related content)
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      // Skip if both are structural elements (expected to be similar)
      if (sections[i].isStructural && sections[j].isStructural) {
        continue;
      }

      const jaccardSim = jaccard(sections[i].words, sections[j].words);
      const strSim = stringSimilarity(sections[i].compact, sections[j].compact);

      if (jaccardSim >= 0.70 && strSim >= 0.60 && strSim < 1.0) {
        semanticDuplicates.push({
          pair: [sections[i].original, sections[j].original],
          similarity: Math.round(Math.max(jaccardSim, strSim) * 100) / 100
        });
      }
    }
  }

  // Detect repeated n-grams (3-grams), excluding graphic-related terms
  const words = tokenizeWords(text);
  const trigrams = new Map();
  const graphicWords = new Set(['graphique', 'figure', 'schema', 'tableau', 'diagramme', 'courbe', 'curve', 'graph', 'chart', 'image', 'illustration', 'pedagogique', 'pédagogique']);

  for (let i = 0; i < words.length - 2; i++) {
    // Skip trigrams containing graphic-related words
    if (graphicWords.has(words[i]) || graphicWords.has(words[i + 1]) || graphicWords.has(words[i + 2])) {
      continue;
    }
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    trigrams.set(trigram, (trigrams.get(trigram) || 0) + 1);
  }
  const repeatedTrigrams = [...trigrams.entries()]
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([gram, count]) => ({ gram, count }));

  const duplicateRatio = (exactDuplicates.length + semanticDuplicates.length) / Math.max(sections.length, 1);
  const score = clamp(Math.round(100 - exactDuplicates.length * 8 - semanticDuplicates.length * 4 - repeatedTrigrams.length * 2), 0, 100);

  return {
    score,
    exactDuplicates,
    semanticDuplicates: semanticDuplicates.slice(0, 10),
    repeatedTrigrams,
    duplicateRatio: Math.round(duplicateRatio * 100) / 100
  };
}

// -------------------------------
// Zone 5: "Fiche Excellente" Rubric (7 Principles)
// -------------------------------
function analyzeZone5Rubric(ficheText, ficheLines, courseText, structureResult) {
  const principles = {};

  // Principle 1: Selectivity (Pareto 20/80)
  const ficheWords = countWords(ficheText);
  const courseWords = countWords(courseText);
  const compressionRatio = courseWords > 0 ? ficheWords / courseWords : 0;
  const idealMin = 0.15, idealMax = 0.30;
  let selectivityScore = 80;
  if (compressionRatio >= idealMin && compressionRatio <= idealMax) {
    selectivityScore = 100;
  } else if (compressionRatio < idealMin) {
    selectivityScore = Math.round(70 * (compressionRatio / idealMin));
  } else {
    selectivityScore = Math.round(100 - (compressionRatio - idealMax) * 150);
  }
  selectivityScore = clamp(selectivityScore, 20, 100);

  const definitionPatterns = /\b(définition|definition|signifie|désigne|est défini|se définit)\b/gi;
  const definitionCount = (ficheText.match(definitionPatterns) || []).length;
  const definitionBonus = clamp(definitionCount * 3, 0, 10);

  principles.selectivity = {
    score: clamp(selectivityScore + definitionBonus, 0, 100),
    compressionRatio: Math.round(compressionRatio * 100) / 100,
    ficheWords,
    courseWords,
    definitionCount
  };

  // Principle 2: Structure (from Zone 3)
  const levelScore = structureResult.maxNestingDepth <= 3 ? 100 : 60;
  const sectionScore = (structureResult.mainSections >= 5 && structureResult.mainSections <= 7) ? 100 : 70;
  principles.structure = {
    score: Math.round(0.5 * levelScore + 0.5 * sectionScore),
    mainSections: structureResult.mainSections,
    maxNestingDepth: structureResult.maxNestingDepth
  };

  // Principle 3: Activation (Most important!)
  const questionMarks = (ficheText.match(/\?/g) || []).length;
  const questionWords = (ficheText.match(/\b(pourquoi|comment|qu'est-ce|quel|quelle|why|how|what|which)\b/gi) || []).length;
  const blanks = (ficheText.match(/\[_+\]|___+|\[\.\.\.\]/g) || []).length;
  const reflectivePatterns = /\b(pourquoi|comment expliquer|quelle relation|why does|how can)\b.*\?/gi;
  const reflectiveCount = (ficheText.match(reflectivePatterns) || []).length;

  const activeElements = questionMarks + blanks;
  let activationScore = clamp(activeElements * 12, 0, 70);
  activationScore += clamp(reflectiveCount * 10, 0, 20);
  activationScore += clamp(questionWords * 2, 0, 10);

  principles.activation = {
    score: clamp(activationScore, 0, 100),
    questionCount: questionMarks,
    blanksCount: blanks,
    reflectiveCount,
    totalActiveElements: activeElements
  };

  // Principle 4: Connection
  const connectionPatterns = [
    />\s*(CONNEXION|CONNECTION|LIEN|RAPPEL)\s*:/gi,
    />\s*[ÀA] RETENIR\s*:/gi,
    />\s*TO REMEMBER\s*:/gi,
    /\*\*Analogie\*\*/gi,
    />\s*💡/g,
    />\s*📌/g
  ];
  let connectionCount = 0;
  for (const pattern of connectionPatterns) {
    connectionCount += (ficheText.match(pattern) || []).length;
  }

  let connectionScore;
  if (connectionCount >= 2 && connectionCount <= 4) connectionScore = 100;
  else if (connectionCount === 1) connectionScore = 65;
  else if (connectionCount > 4) connectionScore = 85;
  else connectionScore = 25;

  principles.connection = {
    score: connectionScore,
    connectionCount
  };

  // Principle 5: Visualization
  const tableLines = ficheLines.filter(l => /^\s*\|.*\|/.test(l)).length;
  const hasTable = tableLines >= 3;

  const formulaPatterns = [
    /\$\$[\s\S]+?\$\$/g,
    /\$[^$]+\$/g,
    /[A-Z][a-z]*\s*=\s*[A-Za-z0-9\s+\-*/()]+/g,
    /\b(formule|formula)\b.*:/gi
  ];
  let formulaCount = 0;
  for (const pattern of formulaPatterns) {
    formulaCount += (ficheText.match(pattern) || []).length;
  }
  formulaCount = Math.min(formulaCount, 20); // Cap to avoid over-counting

  const formulaWithContext = /\*\*[Ff]ormul[ae][^*]*\*\*[\s\S]{10,150}(où|where|avec|with)/gi;
  const contextualFormulas = (ficheText.match(formulaWithContext) || []).length;

  const tableScore = hasTable ? 40 : 0;
  const formulaScore = clamp(formulaCount * 8, 0, 35);
  const contextScore = clamp(contextualFormulas * 12, 0, 25);

  principles.visualization = {
    score: clamp(tableScore + formulaScore + contextScore, 0, 100),
    tableLines,
    hasTable,
    formulaCount,
    contextualFormulas
  };

  // Principle 6: Personalization (Feynman Technique)
  const ficheSentenceLen = avgSentenceLength(ficheText);
  const courseSentenceLen = avgSentenceLength(courseText);
  const simplificationRatio = courseSentenceLen > 0 ? courseSentenceLen / Math.max(ficheSentenceLen, 1) : 1;

  // Copy-paste detection (simple: find long common substrings)
  const courseChunks = courseText.match(/.{50,100}/g) || [];
  let copyPasteCount = 0;
  for (const chunk of courseChunks.slice(0, 50)) { // Sample first 50
    if (ficheText.includes(chunk.trim())) copyPasteCount++;
  }
  const copyPasteRatio = courseChunks.length > 0 ? copyPasteCount / Math.min(courseChunks.length, 50) : 0;

  const analogyPatterns = /\b(comme|tel que|équivalent|ressemble|similaire|like|as if|imagine|pense à)\b/gi;
  const analogyCount = (ficheText.match(analogyPatterns) || []).length;

  let personalizationScore = 50;
  if (simplificationRatio > 1.1) personalizationScore += 20;
  if (copyPasteRatio < 0.15) personalizationScore += 20;
  else if (copyPasteRatio > 0.40) personalizationScore -= 20;
  personalizationScore += clamp(analogyCount * 4, 0, 10);

  principles.personalization = {
    score: clamp(personalizationScore, 0, 100),
    simplificationRatio: Math.round(simplificationRatio * 100) / 100,
    copyPasteRatio: Math.round(copyPasteRatio * 100) / 100,
    analogyCount
  };

  // Principle 7: Actionability
  const summaryPatterns = [
    /##?\s*(Synth[eè]se|Summary|Points\s+Cl[eé]s|Key\s+Points|R[eé]capitulatif|Essential)/i,
    /\*\*(Synth[eè]se|Points\s+Cl[eé]s)\*\*/i
  ];
  const hasSummary = summaryPatterns.some(p => p.test(ficheText));

  const summarySection = extractSectionAfter(ficheText, summaryPatterns);
  const bulletPoints = (summarySection.match(/^[-•*]\s+/gm) || []).length +
                       (summarySection.match(/^\d+\.\s+/gm) || []).length;
  const goodPointCount = bulletPoints >= 3 && bulletPoints <= 7;

  const summaryWords = countWords(summarySection);
  const reviewMinutes = summaryWords / 200;
  const goodReviewTime = reviewMinutes >= 1 && reviewMinutes <= 5;

  let actionabilityScore = 0;
  if (hasSummary) actionabilityScore += 45;
  if (goodPointCount) actionabilityScore += 30;
  else if (bulletPoints > 0) actionabilityScore += 15;
  if (goodReviewTime) actionabilityScore += 25;

  principles.actionability = {
    score: clamp(actionabilityScore, 0, 100),
    hasSummary,
    bulletPoints,
    reviewMinutes: Math.round(reviewMinutes * 10) / 10
  };

  // Additional checks
  const additionalChecks = {
    hasInitialSummary: /^#[^#].*\n[\s\S]{0,500}(résumé|summary|overview|introduction)/i.test(ficheText),
    hasKeyDefinitions: definitionCount >= 3,
    hasEssentialPoints: bulletPoints >= 3,
    hasFormulas: formulaCount >= 1,
    hasCommonErrors: /\b(erreur|error|attention|piège|trap|mistake|éviter|avoid)\b/i.test(ficheText),
    hasSelfAssessment: /\b(auto-évaluation|self-assessment|quiz|test|exercice|exercise)\b/i.test(ficheText),
    hasExamples: (ficheText.match(/\b(exemple|example|ex\.|e\.g\.)\b/gi) || []).length >= 2,
    hasPedagogicalVisuals: hasTable || formulaCount >= 2
  };

  // Overall score with weights
  const weights = {
    selectivity: 0.15,
    structure: 0.15,
    activation: 0.20,
    connection: 0.10,
    visualization: 0.15,
    personalization: 0.10,
    actionability: 0.15
  };

  const overallScore = Math.round(
    weights.selectivity * principles.selectivity.score +
    weights.structure * principles.structure.score +
    weights.activation * principles.activation.score +
    weights.connection * principles.connection.score +
    weights.visualization * principles.visualization.score +
    weights.personalization * principles.personalization.score +
    weights.actionability * principles.actionability.score
  );

  return {
    overallScore,
    principles,
    additionalChecks
  };
}

// -------------------------------
// Compute final overall score
// -------------------------------
function computeOverallScore(zone1, zone2, zone3, zone4, zone5) {
  const weights = {
    extraction: 0.05,
    images: 0.15,
    structure: 0.15,
    duplicates: 0.10,
    rubric: 0.55
  };

  return Math.round(
    weights.extraction * zone1.extractionQuality +
    weights.images * zone2.score +
    weights.structure * zone3.score +
    weights.duplicates * zone4.score +
    weights.rubric * zone5.overallScore
  );
}

function getGrade(score) {
  if (score >= 90) return 'A - Excellent';
  if (score >= 80) return 'B - Bon';
  if (score >= 70) return 'C - Satisfaisant';
  if (score >= 60) return 'D - À améliorer';
  return 'F - Insuffisant';
}

function generateRecommendations(zone2, zone3, zone4, zone5) {
  const recommendations = [];

  if (zone5.principles.activation.score < 70) {
    const needed = 5 - zone5.principles.activation.totalActiveElements;
    if (needed > 0) {
      recommendations.push(`Ajouter ${needed}+ questions actives (pourquoi?, comment?, blancs à remplir) pour atteindre le minimum de 5`);
    }
  }

  if (zone5.principles.connection.connectionCount < 2) {
    recommendations.push('Ajouter 2-3 boîtes "> CONNEXION:" pour créer des liens entre concepts');
  }

  if (!zone5.principles.actionability.hasSummary) {
    recommendations.push('Ajouter une section "## Synthèse des Points Clés" en fin de fiche');
  } else if (zone5.principles.actionability.bulletPoints < 3) {
    recommendations.push('Compléter la synthèse avec 3-5 points essentiels');
  }

  if (!zone5.additionalChecks.hasCommonErrors) {
    recommendations.push('Ajouter une section "Erreurs courantes à éviter"');
  }

  if (!zone5.additionalChecks.hasSelfAssessment) {
    recommendations.push('Ajouter une section "Auto-évaluation" avec exercices');
  }

  if (zone5.principles.personalization.copyPasteRatio > 0.25) {
    recommendations.push('Reformuler davantage le contenu avec vos propres mots (technique Feynman)');
  }

  if (zone3.mainSections > 7) {
    recommendations.push(`Réduire le nombre de sections principales de ${zone3.mainSections} à 5-7`);
  }

  if (zone4.exactDuplicates.length > 0) {
    recommendations.push(`Supprimer ${zone4.exactDuplicates.length} doublon(s) exact(s) détecté(s)`);
  }

  if (zone2.imageNearExampleCount === 0 && zone2.exampleCount > 0) {
    recommendations.push('Associer des visuels aux exemples mentionnés');
  }

  if (!zone5.principles.visualization.hasTable) {
    recommendations.push('Ajouter au moins 1 tableau comparatif pour les concepts opposés');
  }

  return recommendations.slice(0, 8);
}

// -------------------------------
// Report Generators
// -------------------------------
function generateMarkdownReport(meta, zone1, zone2, zone3, zone4, zone5, overall, grade, recommendations) {
  const checkMark = (val) => val ? '✅' : '❌';

  let report = `# Analyse Approfondie: ${path.basename(meta.ficheFile)}

**Date**: ${meta.generatedAt}
**Cours source**: ${meta.courseFile}
**Fiche analysée**: ${meta.ficheFile}

---

## Synthèse Globale

| Métrique | Score | Grade |
|----------|-------|-------|
| **Score Global** | **${overall}/100** | **${grade}** |

### Scores par Zone

| Zone | Score | Détails |
|------|-------|---------|
| 1. Extraction PDF | ${zone1.extractionQuality}/100 | ${zone1.pageCount} pages, ${zone1.poorPages.length} pauvres |
| 2. Images & Visuels | ${zone2.score}/100 | ${zone2.totalImages} images, ${zone2.imageNearExampleCount} près exemples |
| 3. Structure | ${zone3.score}/100 | ${zone3.mainSections} sections, profondeur ${zone3.maxNestingDepth} |
| 4. Doublons | ${zone4.score}/100 | ${zone4.exactDuplicates.length} exacts, ${zone4.semanticDuplicates.length} sémantiques |
| 5. Rubrique 7 Principes | ${zone5.overallScore}/100 | Voir détails ci-dessous |

---

## Zone 1: Extraction PDF

- **Qualité d'extraction**: ${zone1.extractionQuality}/100
- **Pages traitées**: ${zone1.pageCount}
- **Pages pauvres (< 60 chars)**: ${zone1.poorPages.length > 0 ? zone1.poorPages.join(', ') : 'Aucune'}
- **Caractères lisibles**: ${zone1.readableChars}/${zone1.totalChars}

---

## Zone 2: Vérification des Images

- **Score**: ${zone2.score}/100
- **Images Markdown détectées**: ${zone2.markdownImages}
- **Mentions de visuels**: ${zone2.imageMentions}
- **Exemples mentionnés**: ${zone2.exampleCount}
- **Proximité exemple-image**: ${zone2.imageNearExampleCount} correspondances

---

## Zone 3: Structure

- **Score**: ${zone3.score}/100
- **Sections principales**: ${zone3.mainSections} (idéal: 5-7)
- **Profondeur max**: ${zone3.maxNestingDepth} niveaux (idéal: ≤3)
- **Équilibre titre/paragraphe**: ${pct(zone3.titleParagraphBalance)}
- **Longueur sections**: min ${zone3.sectionLengths.min}, max ${zone3.sectionLengths.max}, moy ${zone3.sectionLengths.avg}

### Problèmes Détectés

${zone3.issues.length > 0 ? zone3.issues.map(i => `- ${i}`).join('\n') : '✅ Aucun problème structurel détecté'}

---

## Zone 4: Détection des Doublons

- **Score**: ${zone4.score}/100
- **Doublons exacts**: ${zone4.exactDuplicates.length}
- **Doublons sémantiques**: ${zone4.semanticDuplicates.length}
- **Ratio de duplication**: ${pct(zone4.duplicateRatio)}

${zone4.exactDuplicates.length > 0 ? `### Doublons Exacts\n${zone4.exactDuplicates.map(d => `- "${d.text.slice(0, 60)}..." (×${d.count})`).join('\n')}` : ''}

${zone4.semanticDuplicates.length > 0 ? `### Doublons Sémantiques\n${zone4.semanticDuplicates.map(d => `- "${d.pair[0].slice(0, 40)}..." ↔ "${d.pair[1].slice(0, 40)}..." (${pct(d.similarity)})`).join('\n')}` : ''}

${zone4.repeatedTrigrams.length > 0 ? `### Trigrammes Répétés\n${zone4.repeatedTrigrams.slice(0, 5).map(t => `- "${t.gram}" (×${t.count})`).join('\n')}` : ''}

---

## Zone 5: Rubrique "Fiche Excellente" (7 Principes)

| Principe | Score | Détails |
|----------|-------|---------|
| 1. Sélectivité | ${zone5.principles.selectivity.score}/100 | Ratio compression: ${pct(zone5.principles.selectivity.compressionRatio)}, ${zone5.principles.selectivity.definitionCount} définitions |
| 2. Structure | ${zone5.principles.structure.score}/100 | ${zone5.principles.structure.mainSections} sections, ${zone5.principles.structure.maxNestingDepth} niveaux |
| 3. Activation | ${zone5.principles.activation.score}/100 | ${zone5.principles.activation.questionCount} questions, ${zone5.principles.activation.blanksCount} blancs, ${zone5.principles.activation.reflectiveCount} réflexives |
| 4. Connexion | ${zone5.principles.connection.score}/100 | ${zone5.principles.connection.connectionCount} boîtes connexion |
| 5. Visualisation | ${zone5.principles.visualization.score}/100 | ${zone5.principles.visualization.tableLines} lignes tableau, ${zone5.principles.visualization.formulaCount} formules |
| 6. Personnalisation | ${zone5.principles.personalization.score}/100 | Copy-paste: ${pct(zone5.principles.personalization.copyPasteRatio)}, ${zone5.principles.personalization.analogyCount} analogies |
| 7. Actionnabilité | ${zone5.principles.actionability.score}/100 | Synthèse: ${checkMark(zone5.principles.actionability.hasSummary)}, ${zone5.principles.actionability.bulletPoints} points |

### Vérifications Additionnelles

| Critère | Présent |
|---------|---------|
| Résumé initial | ${checkMark(zone5.additionalChecks.hasInitialSummary)} |
| Définitions clés (≥3) | ${checkMark(zone5.additionalChecks.hasKeyDefinitions)} |
| Points essentiels (≥3) | ${checkMark(zone5.additionalChecks.hasEssentialPoints)} |
| Formules | ${checkMark(zone5.additionalChecks.hasFormulas)} |
| Erreurs courantes | ${checkMark(zone5.additionalChecks.hasCommonErrors)} |
| Auto-évaluation | ${checkMark(zone5.additionalChecks.hasSelfAssessment)} |
| Exemples (≥2) | ${checkMark(zone5.additionalChecks.hasExamples)} |
| Visuels pédagogiques | ${checkMark(zone5.additionalChecks.hasPedagogicalVisuals)} |

---

## Recommandations

${recommendations.length > 0 ? recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n') : '✅ Excellente fiche, pas de recommandations majeures!'}

---

*Généré par fiche-compare-thorough.mjs v1.0.0*
`;

  return report;
}

function generateJsonReport(meta, zone1, zone2, zone3, zone4, zone5, overall, grade, recommendations) {
  return {
    meta,
    zones: {
      zone1_extraction: zone1,
      zone2_images: zone2,
      zone3_structure: zone3,
      zone4_duplicates: zone4,
      zone5_rubric: zone5
    },
    overallScore: overall,
    grade,
    recommendations
  };
}

function generateComparativeReport(results, coursePath) {
  const sorted = [...results].sort((a, b) => b.overallScore - a.overallScore);

  let report = `# Analyse Comparative: ${path.basename(coursePath)}

**Date**: ${new Date().toISOString()}
**Fiches comparées**: ${results.length}

---

## Classement Global

| Rang | Fiche | Score | Grade |
|------|-------|-------|-------|
${sorted.map((r, i) => `| ${i + 1} | ${r.label} | ${r.overallScore}/100 | ${r.grade} |`).join('\n')}

---

## Meilleure Fiche par Principe

| Principe | Meilleure Fiche | Score |
|----------|-----------------|-------|
| Sélectivité | ${getBestFor(results, 'selectivity')} |
| Structure | ${getBestFor(results, 'structure')} |
| Activation | ${getBestFor(results, 'activation')} |
| Connexion | ${getBestFor(results, 'connection')} |
| Visualisation | ${getBestFor(results, 'visualization')} |
| Personnalisation | ${getBestFor(results, 'personalization')} |
| Actionnabilité | ${getBestFor(results, 'actionability')} |

---

## Détails par Fiche

${results.map(r => `### ${r.label}

**Score global**: ${r.overallScore}/100 (${r.grade})

**Forces**:
${getStrengths(r.zone5.principles).map(s => `- ${s}`).join('\n') || '- Aucune force notable'}

**Faiblesses**:
${getWeaknesses(r.zone5.principles).map(w => `- ${w}`).join('\n') || '- Aucune faiblesse majeure'}

**Top 3 recommandations**:
${r.recommendations.slice(0, 3).map((rec, i) => `${i + 1}. ${rec}`).join('\n') || '- Aucune recommandation'}

`).join('\n')}

---

## Recommandations Globales

${getGlobalRecommendations(results).map((r, i) => `${i + 1}. ${r}`).join('\n')}

---

*Généré par fiche-compare-thorough.mjs v1.0.0*
`;

  return report;
}

function getBestFor(results, principle) {
  const best = results.reduce((acc, r) => {
    const score = r.zone5.principles[principle].score;
    return score > acc.score ? { label: r.label, score } : acc;
  }, { label: '', score: 0 });
  return `${best.label} | ${best.score}/100`;
}

function getStrengths(principles) {
  const strengths = [];
  const names = {
    selectivity: 'Sélectivité',
    structure: 'Structure',
    activation: 'Activation',
    connection: 'Connexion',
    visualization: 'Visualisation',
    personalization: 'Personnalisation',
    actionability: 'Actionnabilité'
  };
  for (const [key, val] of Object.entries(principles)) {
    if (val.score >= 80) strengths.push(`${names[key]} (${val.score}/100)`);
  }
  return strengths;
}

function getWeaknesses(principles) {
  const weaknesses = [];
  const names = {
    selectivity: 'Sélectivité',
    structure: 'Structure',
    activation: 'Activation',
    connection: 'Connexion',
    visualization: 'Visualisation',
    personalization: 'Personnalisation',
    actionability: 'Actionnabilité'
  };
  for (const [key, val] of Object.entries(principles)) {
    if (val.score < 60) weaknesses.push(`${names[key]} (${val.score}/100)`);
  }
  return weaknesses;
}

function getGlobalRecommendations(results) {
  const allRecs = results.flatMap(r => r.recommendations);
  const recCounts = new Map();
  for (const rec of allRecs) {
    const key = rec.slice(0, 50);
    recCounts.set(key, (recCounts.get(key) || 0) + 1);
  }
  const common = [...recCounts.entries()]
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rec]) => allRecs.find(r => r.startsWith(rec)));

  if (common.length < 3) {
    return [...new Set(allRecs)].slice(0, 5);
  }
  return common;
}

// -------------------------------
// Main execution
// -------------------------------
async function analyzeFiche(coursePath, fichePath, ficheLabel) {
  console.log(`\n📊 Analyse de ${ficheLabel}...`);

  // Extract texts
  const [courseData, ficheData] = await Promise.all([
    extractPdfTextWithPages(coursePath),
    extractPdfTextWithPages(fichePath)
  ]);

  // Zone 1: Extraction
  const zone1 = await analyzeZone1Extraction(ficheData.pages, ficheData.text);
  console.log(`  Zone 1 (Extraction): ${zone1.extractionQuality}/100`);

  // Zone 2: Images
  const zone2 = analyzeZone2Images(ficheData.text, ficheData.lines);
  console.log(`  Zone 2 (Images): ${zone2.score}/100`);

  // Zone 3: Structure
  const zone3 = analyzeZone3Structure(ficheData.lines, ficheData.text);
  console.log(`  Zone 3 (Structure): ${zone3.score}/100`);

  // Zone 4: Duplicates
  const zone4 = analyzeZone4Duplicates(ficheData.lines, ficheData.text);
  console.log(`  Zone 4 (Doublons): ${zone4.score}/100`);

  // Zone 5: 7 Principles
  const zone5 = analyzeZone5Rubric(ficheData.text, ficheData.lines, courseData.text, zone3);
  console.log(`  Zone 5 (7 Principes): ${zone5.overallScore}/100`);

  // Overall
  const overall = computeOverallScore(zone1, zone2, zone3, zone4, zone5);
  const grade = getGrade(overall);
  console.log(`  📈 Score global: ${overall}/100 (${grade})`);

  // Recommendations
  const recommendations = generateRecommendations(zone2, zone3, zone4, zone5);

  return {
    label: ficheLabel,
    fichePath,
    zone1,
    zone2,
    zone3,
    zone4,
    zone5,
    overallScore: overall,
    grade,
    recommendations
  };
}

async function main() {
  console.log('🔍 Thorough Testing - Analyse des fiches de révision\n');
  console.log(`Cours: ${COURSE_PDF}`);
  console.log(`Fiches: ${FICHES.map(f => f.label).join(', ')}\n`);

  const results = [];
  const generatedAt = new Date().toISOString();

  for (const fiche of FICHES) {
    try {
      const result = await analyzeFiche(COURSE_PDF, fiche.path, fiche.label);

      // Generate individual report
      const meta = {
        generatedAt,
        scriptVersion: '1.0.0',
        courseFile: COURSE_PDF,
        ficheFile: fiche.path
      };

      const mdReport = generateMarkdownReport(
        meta, result.zone1, result.zone2, result.zone3, result.zone4, result.zone5,
        result.overallScore, result.grade, result.recommendations
      );

      const jsonReport = generateJsonReport(
        meta, result.zone1, result.zone2, result.zone3, result.zone4, result.zone5,
        result.overallScore, result.grade, result.recommendations
      );

      // Write reports
      const baseName = path.basename(fiche.path, '.pdf').replace(/[^a-zA-Z0-9_-]/g, '_');
      const mdPath = `public/fichetest/comparaison_${baseName}_thorough.md`;
      const jsonPath = `public/fichetest/comparaison_${baseName}_thorough.json`;

      ensureDirSync(mdPath);
      await fsp.writeFile(mdPath, mdReport, 'utf-8');
      await fsp.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf-8');

      console.log(`  ✅ Rapports générés: ${mdPath}`);

      results.push(result);
    } catch (err) {
      console.error(`  ❌ Erreur pour ${fiche.label}:`, err.message);
    }
  }

  // Generate comparative report
  if (results.length > 1) {
    console.log('\n📊 Génération du rapport comparatif...');

    const comparativeReport = generateComparativeReport(results, COURSE_PDF);
    const comparativePath = 'public/fichetest/comparaison_IntroEco_02_comparative.md';
    await fsp.writeFile(comparativePath, comparativeReport, 'utf-8');

    const comparativeJson = {
      generatedAt,
      courseFile: COURSE_PDF,
      results: results.map(r => ({
        label: r.label,
        fichePath: r.fichePath,
        overallScore: r.overallScore,
        grade: r.grade,
        zone5: r.zone5
      })),
      ranking: results
        .map(r => ({ label: r.label, score: r.overallScore }))
        .sort((a, b) => b.score - a.score)
    };
    await fsp.writeFile(
      'public/fichetest/comparaison_IntroEco_02_comparative.json',
      JSON.stringify(comparativeJson, null, 2),
      'utf-8'
    );

    console.log(`✅ Rapport comparatif: ${comparativePath}`);
  }

  console.log('\n🎉 Analyse terminée!');
}

main().catch(console.error);
