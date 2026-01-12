// Simple, general-purpose PDF comparison for study-sheet quality checks
// Usage:
//   node scripts/fiche-compare2.mjs "public/Test/IntroEco-02.pdf" "public/fichetest/IntroEco_02_pdf_Study_Sheet (27).pdf" "public/fichetest/comparaison_IntroEco_02_27.md"
// If no args provided, defaults are used and report written to public/fichetest/comparaison_IntroEco_02_27.md
//
// This script is domain-agnostic and should work across various course types (sciences, humanities, etc.)
// It focuses on generic signals: keyword coverage, structure/formatting cues, duplicate concepts, and examples/graphics mentions.

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PDFParser = require('pdf2json');

// -------------------------------
// Helpers
// -------------------------------
const DEFAULT_COURSE_PDF = 'public/Test/IntroEco-02.pdf';
const DEFAULT_FICHE_PDF = 'public/fichetest/IntroEco_02_pdf_Study_Sheet (27).pdf';
const DEFAULT_REPORT_PATH = 'public/fichetest/comparaison_IntroEco_02_27.md';

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
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
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
// PDF extraction (text + lines)
// -------------------------------
async function extractPdfText(filePath) {
  const buffer = await fsp.readFile(filePath);
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData) => {
      reject(new Error(`Failed to parse PDF (${filePath}): ${errData?.parserError || 'unknown error'}`));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        const allLines = [];

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

            if (items.length === 0) continue;

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

            allLines.push(...pageLines, ''); // page separator
          }
        }

        const text = cleanTextBasic(allLines.join('\n'));
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        resolve({ text, lines });
      } catch (e) {
        reject(e);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

// -------------------------------
// Language-agnostic tokenization & stopwords (FR/EN/DE minimal sets)
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
  const tokens = text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .match(/[a-zà-ÿ0-9]+/gi) || [];
  return tokens;
}

function filterContentTokens(tokens) {
  return tokens.filter(t => {
    if (isStopword(t)) return false;
    if (/^\d+$/.test(t)) return false; // pure numbers
    return t.length > 1;
  });
}

function getBigrams(tokens) {
  const res = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    res.push(tokens[i] + ' ' + tokens[i+1]);
  }
  return res;
}

function topN(freqMap, N) {
  return [...freqMap.entries()]
    .sort((a,b) => b[1] - a[1])
    .slice(0, N)
    .map(([k, v]) => ({ key: k, count: v }));
}

// -------------------------------
// Structure & formatting heuristics (domain-agnostic)
// -------------------------------
const BULLET_REGEX = /^\s*([\-–—•*·●◦]|(\d+[\.\)]))\s+/;
const NUMBERED_REGEX = /^\s*(\d+[\.\)]|\(?[A-Za-z]\))\s+/;

function uppercaseRatio(line) {
  const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length === 0) return 0;
  const up = letters.replace(/[^A-ZÀ-Þ]/g, '').length; // À-Þ roughly uppercase latin accented
  return up / letters.length;
}

function isLikelyHeading(line) {
  const len = line.length;
  if (len < 3 || len > 120) return false;

  // Numbered headings like "1. Intro", "A) Title"
  if (NUMBERED_REGEX.test(line)) return true;

  // Uppercase-heavy short lines look like headings
  if (len <= 80 && uppercaseRatio(line) >= 0.6 && /[A-Za-zÀ-ÿ]/.test(line)) return true;

  // Title-like lines: Short, few punctuation, not bullet
  if (!BULLET_REGEX.test(line) && len <= 70 && /[A-Za-zÀ-ÿ]/.test(line)) {
    const punct = (line.match(/[.,;:!?]/g) || []).length;
    if (punct <= 2) return true;
  }

  return false;
}

function analyzeVisualFormatting(lines) {
  const total = lines.length || 1;
  let bulletLines = 0;
  let headingLines = 0;
  let blankLines = 0;
  let totalLen = 0;

  for (const line of lines) {
    if (line.trim().length === 0) blankLines++;
    if (BULLET_REGEX.test(line)) bulletLines++;
    if (isLikelyHeading(line)) headingLines++;
    totalLen += line.length;
  }

  const avgLen = totalLen / total;
  const densityBullets = bulletLines / total;
  const densityHeadings = headingLines / total;
  const densityBlanks = blankLines / total;

  // Scoring (0-100):
  // - Structure score from bullets and headings (prefer both present)
  const structureScore = clamp((0.5 * densityBullets + 0.5 * densityHeadings) * 120, 0, 100);
  // - Concision score: best ~60-110 characters average line length
  const concisionScore = clamp(100 - (Math.abs(avgLen - 85) / 85) * 100, 0, 100);
  // - Spacing score: blank line density ideal in [0.05, 0.25]
  const idealMin = 0.05, idealMax = 0.25;
  let spacingScore;
  if (densityBlanks < idealMin) spacingScore = clamp(100 - ((idealMin - densityBlanks) / idealMin) * 100, 0, 100);
  else if (densityBlanks > idealMax) spacingScore = clamp(100 - ((densityBlanks - idealMax) / (1 - idealMax)) * 100, 0, 100);
  else spacingScore = 100;

  const visualScore = Math.round(0.45 * structureScore + 0.35 * concisionScore + 0.20 * spacingScore);

  return {
    bulletLines,
    headingLines,
    blankLines,
    totalLines: total,
    densityBullets,
    densityHeadings,
    densityBlanks,
    avgLen,
    structureScore: Math.round(structureScore),
    concisionScore: Math.round(concisionScore),
    spacingScore: Math.round(spacingScore),
    visualScore
  };
}

// -------------------------------
// Keyword coverage (domain-agnostic)
// -------------------------------
function extractTopKeywords(courseText, topNCount = 50) {
  const tokens = filterContentTokens(tokenizeWords(courseText));
  const bigrams = getBigrams(tokens);

  const uniFreq = new Map();
  for (const t of tokens) uniFreq.set(t, (uniFreq.get(t) || 0) + 1);

  const biFreq = new Map();
  for (const b of bigrams) biFreq.set(b, (biFreq.get(b) || 0) + 1);

  // Weight bigrams higher to capture concepts
  const combined = new Map();
  for (const [k, v] of uniFreq.entries()) combined.set(k, (combined.get(k) || 0) + v);
  for (const [k, v] of biFreq.entries()) combined.set(k, (combined.get(k) || 0) + v * 2);

  const top = [...combined.entries()]
    .filter(([k, v]) => v >= 2 || k.includes(' ')) // keep repeated unigrams or any bigram
    .sort((a,b) => b[1] - a[1])
    .slice(0, topNCount)
    .map(([key, count]) => ({ key, count, isBigram: key.includes(' ') }));

  return top;
}

function computeCoverageScore(topKeywords, ficheText) {
  const ficheTokens = new Set(filterContentTokens(tokenizeWords(ficheText)));
  const ficheTextLC = ficheText.toLowerCase();

  let foundWeighted = 0;
  let totalWeighted = 0;

  const details = [];

  for (const kw of topKeywords) {
    const w = kw.isBigram ? 2 : 1;
    totalWeighted += w;

    let present = false;
    if (kw.isBigram) {
      // bigram presence in raw text
      present = ficheTextLC.includes(kw.key);
    } else {
      present = ficheTokens.has(kw.key);
    }

    if (present) foundWeighted += w;
    details.push({ keyword: kw.key, bigram: kw.isBigram, present });
  }

  const coverage = totalWeighted === 0 ? 0 : (foundWeighted / totalWeighted);
  // Coverage to 0-100 score
  const score = Math.round(coverage * 100);

  return { coverage, score, details };
}

// -------------------------------
// Duplicate concepts: headings & n-grams (domain-agnostic)
// -------------------------------
function normalizeHeading(h) {
  const s = stripDiacritics(h.toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) dp[j] = prev;
      else dp[j] = Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      prev = temp;
    }
  }
  return dp[n];
}

function similarity(a, b) {
  const d = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - d / maxLen;
}

function analyzeDuplicates(lines) {
  // Collect candidate headings
  const headings = lines.filter(isLikelyHeading);

  // Exact duplicates (normalized)
  const normCounts = new Map();
  const examples = {};
  for (const h of headings) {
    const n = normalizeHeading(h);
    if (!n) continue;
    normCounts.set(n, (normCounts.get(n) || 0) + 1);
    if (!examples[n]) examples[n] = h;
  }
  const exactDupes = [...normCounts.entries()].filter(([, c]) => c >= 2)
    .map(([norm, count]) => ({ heading: examples[norm], norm, count }));

  // Fuzzy duplicates: compare pairwise with threshold
  const norms = [...normCounts.keys()];
  const fuzzyPairs = [];
  for (let i = 0; i < norms.length; i++) {
    for (let j = i + 1; j < norms.length; j++) {
      const s = similarity(norms[i], norms[j]);
      if (s >= 0.9) {
        fuzzyPairs.push({ h1: examples[norms[i]], h2: examples[norms[j]], similarity: Number(s.toFixed(2)) });
      }
    }
  }

  // Repeated 3-grams on fiche text
  const allTokens = filterContentTokens(tokenizeWords(lines.join(' ')));
  const tri = [];
  for (let i = 0; i < allTokens.length - 2; i++) {
    tri.push(`${allTokens[i]} ${allTokens[i+1]} ${allTokens[i+2]}`);
  }
  const triFreq = new Map();
  for (const t of tri) triFreq.set(t, (triFreq.get(t) || 0) + 1);
  const repeatedTri = [...triFreq.entries()].filter(([, c]) => c >= 3)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 15)
    .map(([gram, count]) => ({ gram, count }));

  return { headingsCount: headings.length, exactDupes, fuzzyPairs, repeatedTri };
}

// -------------------------------
// Examples and graphics mentions (language-agnostic)
// -------------------------------
const EXAMPLE_PATTERNS = [
  /\bexemples?\b/gi, /\bpar exemple\b/gi, /\bex\.\b/gi, /\bcas\b/gi,
  /\bexample(s)?\b/gi, /\be\.g\.\b/gi, /\bz\.b\.\b/gi, /\bbeispiel(e)?\b/gi
];

const GRAPHICS_PATTERNS = [
  /\bgraphique(s)?\b/gi, /\bschéma(s)?\b/gi, /\bschema(s)?\b/gi, /\bfigure(s)?\b/gi, /\btableau(x)?\b/gi,
  /\bdiagram(s)?\b/gi, /\bchart(s)?\b/gi, /\billustration(s)?\b/gi, /\bplot(s)?\b/gi, /\bgraph(s)?\b/gi,
  /!\[[^\]]*\]\([^)]+\)/g // Markdown image
];

function countMatches(text, patterns) {
  let count = 0;
  for (const p of patterns) {
    const matches = text.match(p);
    if (matches) count += matches.length;
  }
  return count;
}

function analyzeExamplesAndGraphics(text) {
  const exCount = countMatches(text.toLowerCase(), EXAMPLE_PATTERNS);
  const gfxCount = countMatches(text.toLowerCase(), GRAPHICS_PATTERNS);
  const needsGraphicsFlag = exCount > 0 && gfxCount === 0;

  return {
    examplesCount: exCount,
    graphicsMentionsCount: gfxCount,
    needsGraphicsFlag
  };
}

// -------------------------------
// Overall sufficiency score (combine coverage + visual)
// -------------------------------
function computeSufficiencyScore(coverageScore, visualScore) {
  // Balanced weighting; domain-agnostic
  return Math.round(0.6 * coverageScore + 0.4 * visualScore);
}

// -------------------------------
// Report generation
// -------------------------------
function renderCoverageTable(details) {
  const rows = details.slice(0, 50).map(d => `| ${d.keyword} | ${d.bigram ? 'Oui' : 'Non'} | ${d.present ? 'Oui' : 'Non'} |`).join('\n');
  return [
    '| Mot-clé | Bigram | Présent dans la fiche |',
    '|---|---|---|',
    rows
  ].join('\n');
}

function renderDuplicatesSection(dupes) {
  const exact = dupes.exactDupes.map(d => `- "${d.heading}" (x${d.count})`).join('\n') || '- Aucun';
  const fuzzy = dupes.fuzzyPairs.slice(0, 15).map(p => `- "${p.h1}" ~ "${p.h2}" (sim=${p.similarity})`).join('\n') || '- Aucun';
  const tris = dupes.repeatedTri.map(t => `- ${t.gram} (x${t.count})`).join('\n') || '- Aucun';

  return `- Titres/sections dupliqués (exact):\n${exact}\n\n- Titres/sections proches (fuzzy):\n${fuzzy}\n\n- 3-grammes répétés (>=3):\n${tris}`;
}

function buildRecommendations({
  suffScore, covScore, visualScore,
  visual, duplicates, exgfx
}) {
  const recs = [];

  // Coverage
  if (covScore < 75) {
    recs.push('Augmenter la couverture des notions clés du cours (ajouter les concepts manquants identifiés).');
  }

  // Visual formatting
  if (visualScore < 75) {
    if (visual.densityBullets < 0.05) recs.push('Ajouter des listes à puces pour structurer les idées.');
    if (visual.densityHeadings < 0.03) recs.push('Ajouter des titres et sous-titres courts et explicites.');
    recs.push('Améliorer la lisibilité: phrases plus concises et espaces/blancs équilibrés.');
  }

  // Duplicates
  if (duplicates.exactDupes.length > 0 || duplicates.fuzzyPairs.length > 0) {
    recs.push('Fusionner ou reformuler les sections redondantes (doublons de titres détectés).');
  }

  // Examples vs graphics
  if (exgfx.needsGraphicsFlag) {
    recs.push('Ajouter des graphiques/diagrammes/figures pour illustrer les exemples cités.');
  }

  // Generalist reminders
  recs.push('Utiliser un langage clair et universel; éviter le jargon inutile.');
  recs.push('Préférer des schémas simples et des listes pour faciliter la mémorisation, quel que soit le domaine.');

  return recs;
}

function renderReport({
  coursePath, fichePath,
  coverage, visual, sufficiencyScore,
  duplicates, exgfx
}) {
  const covScore = coverage.score;
  const visScore = visual.visualScore;
  const suffScore = sufficiencyScore;

  const recommendations = buildRecommendations({
    suffScore: suffScore,
    covScore: covScore,
    visualScore: visScore,
    visual, duplicates, exgfx
  });

  return `# Comparaison Cours vs Fiche de révision

Fichiers:
- Cours: ${coursePath}
- Fiche: ${fichePath}

## Synthèse (scores généraux)
- Couverture des concepts (top mots-clés du cours retrouvés dans la fiche): ${covScore}/100
- Qualité de mise en forme (structure, titres, puces, concision): ${visScore}/100
- Suffisance globale (pondérée): ${suffScore}/100

## Détails Couverture
- Couverture pondérée des mots-clés du cours dans la fiche: ${pct(coverage.coverage)}
${renderCoverageTable(coverage.details)}

## Détails Mise en forme (Fiche)
- Lignes: ${visual.totalLines}
- Taux de puces: ${pct(visual.densityBullets)}
- Taux de titres: ${pct(visual.densityHeadings)}
- Taux de lignes vides: ${pct(visual.densityBlanks)}
- Longueur moyenne des lignes: ${visual.avgLen.toFixed(1)}
- Scores partiels:
  - Structure: ${visual.structureScore}/100
  - Concision: ${visual.concisionScore}/100
  - Espacement: ${visual.spacingScore}/100

## Doublons / Répétitions
${renderDuplicatesSection(duplicates)}

## Exemples et illustrations
- Occurrences d'exemples/cas détectées: ${exgfx.examplesCount}
- Mentions de graphiques/figures/diagrammes/tableaux: ${exgfx.graphicsMentionsCount}
- Besoin d'illustrations pour exemples: ${exgfx.needsGraphicsFlag ? 'Oui' : 'Non'}

## Recommandations (généralistes, applicables à tous cours)
${recommendations.map(r => `- ${r}`).join('\n')}
`;
}

// -------------------------------
// Main
// -------------------------------
async function main() {
  const coursePath = process.argv[2] || DEFAULT_COURSE_PDF;
  const fichePath = process.argv[3] || DEFAULT_FICHE_PDF;
  const reportPath = process.argv[4] || DEFAULT_REPORT_PATH;

  // Validate files
  if (!fs.existsSync(coursePath)) {
    console.error(`Course PDF not found: ${coursePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(fichePath)) {
    console.error(`Fiche PDF not found: ${fichePath}`);
    process.exit(1);
  }

  console.log('🔎 Extracting course text...');
  const course = await extractPdfText(coursePath);
  console.log(`   Course chars: ${course.text.length}, lines: ${course.lines.length}`);

  console.log('🔎 Extracting fiche text...');
  const fiche = await extractPdfText(fichePath);
  console.log(`   Fiche chars: ${fiche.text.length}, lines: ${fiche.lines.length}`);

  // Keyword coverage
  console.log('🧠 Computing top keywords from course...');
  const topKW = extractTopKeywords(course.text, 50);
  const coverage = computeCoverageScore(topKW, fiche.text);

  // Visual formatting (fiche)
  console.log('🧩 Analyzing visual/structural cues...');
  const visual = analyzeVisualFormatting(fiche.lines);

  // Sufficiency
  const sufficiencyScore = computeSufficiencyScore(coverage.score, visual.visualScore);

  // Duplicates
  console.log('🔁 Checking duplicates/repetitions...');
  const duplicates = analyzeDuplicates(fiche.lines);

  // Examples vs Graphics mentions
  console.log('🖼️ Checking examples and graphics mentions...');
  const exgfx = analyzeExamplesAndGraphics(fiche.text);

  // Build report
  const report = renderReport({
    coursePath, fichePath,
    coverage, visual, sufficiencyScore,
    duplicates, exgfx
  });

  ensureDirSync(reportPath);
  await fsp.writeFile(reportPath, report, 'utf8');

  console.log(`✅ Report written: ${reportPath}`);
}

const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  main().catch(err => {
    console.error('❌ Error:', err?.message || err);
    process.exit(1);
  });
}
