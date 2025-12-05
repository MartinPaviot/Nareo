/**
 * Debug test for ChapterDetector
 */
const { ChapterDetector, ChapterLevel } = await import('./lib/llm/chapter-detector.js');

// Original test pages from Python version - with repeated headers (like slides)
const testPages = [
  "Université de Rennes\nCours de Marketing Digital\n2024-2025",
  "SOMMAIRE\n1. Introduction .................. 3\n2. Les Fondamentaux ............ 8\n3. Stratégies Avancées ......... 15\n4. Études de Cas ............... 22",
  "1. INTRODUCTION\n\nLe marketing digital est devenu incontournable.",
  "1. INTRODUCTION\n\n1.1 Contexte historique\n\nLe marketing a évolué depuis les années 1990.",
  "1. INTRODUCTION\n\n1.2 Définitions clés\n\nLe marketing digital englobe toutes les actions.",
  "1. INTRODUCTION\n\nLes entreprises doivent s'adapter à cette nouvelle réalité.",
  "1. INTRODUCTION\n\nConclusion de cette section.",
  "2. LES FONDAMENTAUX\n\nCette section couvre les bases essentielles.",
  "2. LES FONDAMENTAUX\n\n2.1 SEO - Search Engine Optimization\n\nLe référencement.",
  "2. LES FONDAMENTAUX\n\n2.2 SEA - Search Engine Advertising\n\nLa publicité payante.",
  "2. LES FONDAMENTAUX\n\n2.3 Social Media Marketing\n\nLes réseaux sociaux.",
  "2. LES FONDAMENTAUX\n\nRécapitulatif des points clés.",
  "2. LES FONDAMENTAUX\n\nExercices pratiques.",
  "2. LES FONDAMENTAUX\n\nLecture recommandée.",
  "3. STRATÉGIES AVANCÉES\n\nNous abordons maintenant des techniques sophistiquées.",
  "3. STRATÉGIES AVANCÉES\n\n3.1 Marketing Automation\n\nL'automatisation.",
  "3. STRATÉGIES AVANCÉES\n\n3.2 Data-Driven Marketing\n\nLes données guident.",
  "3. STRATÉGIES AVANCÉES\n\n3.3 Personnalisation\n\nChaque client mérite.",
  "3. STRATÉGIES AVANCÉES\n\nL'intelligence artificielle transforme le marketing.",
  "3. STRATÉGIES AVANCÉES\n\nÉtude de l'impact des nouvelles technologies.",
  "3. STRATÉGIES AVANCÉES\n\nPerspectives d'avenir.",
  "4. ÉTUDES DE CAS\n\nAnalyse de cas réels.",
  "4. ÉTUDES DE CAS\n\n4.1 Cas Netflix\n\nComment Netflix utilise les données.",
  "4. ÉTUDES DE CAS\n\n4.2 Cas Amazon\n\nLa stratégie omnicanale d'Amazon.",
  "4. ÉTUDES DE CAS\n\nConclusion et synthèse du cours.",
];

// Extend class to access protected members
class DebugDetector extends ChapterDetector {
  debugScoring() {
    this.extractAndScoreLines();
    return this.allLines;
  }

  debugToc() {
    this.extractAndScoreLines();
    this.findTableOfContents();
    return this.tocEntries;
  }

  debugIdentify() {
    this.extractAndScoreLines();
    this.findTableOfContents();
    return this.identifyChapterTitles();
  }
}

console.log("=".repeat(70));
console.log("DEBUG CHAPTER DETECTOR");
console.log("=".repeat(70));

// Test 1: TOC detection
console.log("\n📑 Test 1: TOC Detection");
console.log("-".repeat(50));
const detector1 = new DebugDetector(testPages);
const toc = detector1.debugToc();
console.log(`TOC entries found: ${toc.length}`);
for (const entry of toc) {
  console.log(`  - "${entry}"`);
}

// Test 2: Chapter identification
console.log("\n📖 Test 2: Chapter Identification");
console.log("-".repeat(50));
const detector2 = new DebugDetector(testPages);
const identified = detector2.debugIdentify();
console.log(`Chapters identified: ${identified.length}`);
for (const ch of identified) {
  console.log(`  Page ${ch.page}: "${ch.text}" (score: ${ch.score.toFixed(2)})`);
}

// Test 3: Full detection
console.log("\n🎯 Test 3: Full Detection");
console.log("-".repeat(50));
const detector3 = new ChapterDetector(testPages);
const chapters = detector3.detect();
console.log(`Chapters found: ${chapters.length}`);
detector3.printStructure();
