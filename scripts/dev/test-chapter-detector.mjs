/**
 * Test script for the new ChapterDetector
 */
import fs from 'fs';
import path from 'path';

// Import the chapter detector
const { ChapterDetector, detectChapters, chaptersToStructure, ChapterLevel } = await import('./lib/llm/chapter-detector.js');

// Simulated test pages (like in the Python version)
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

console.log("=" .repeat(70));
console.log("TEST DU DÉTECTEUR DE CHAPITRES (TypeScript)");
console.log("=" .repeat(70));

console.log("\n📝 Test 1: Document simulé Marketing Digital");
console.log("-".repeat(50));

const detector = new ChapterDetector(testPages);

// Debug: Check if lines are being scored
console.log("\n🔍 Debug: Checking line scoring...");

// Manually test scoring
for (let pageIdx = 0; pageIdx < Math.min(3, testPages.length); pageIdx++) {
  const lines = testPages[pageIdx].split('\n');
  console.log(`\nPage ${pageIdx + 1}:`);
  for (const line of lines.slice(0, 3)) {
    const clean = line.trim();
    if (clean) console.log(`  "${clean.substring(0, 40)}..."`);
  }
}

const chapters = detector.detect();

console.log(`\n📊 Résultat: ${chapters.length} chapitres détectés`);
detector.printStructure();

console.log("\n" + "=".repeat(70));
console.log("EXPORT JSON");
console.log("=".repeat(70));
console.log(JSON.stringify(detector.toDict(), null, 2));

console.log("\n" + "=".repeat(70));
console.log("CONVERSION PIPELINE FORMAT");
console.log("=".repeat(70));
const pipelineFormat = chaptersToStructure(chapters, testPages);
console.log(JSON.stringify(pipelineFormat, null, 2));

// Test with a real PDF if available
const testPdfPath = 'public/Test/2. PE.pdf';
if (fs.existsSync(testPdfPath)) {
  console.log("\n\n" + "=".repeat(70));
  console.log("TEST AVEC UN VRAI PDF: 2. PE.pdf");
  console.log("=".repeat(70));

  try {
    // Load PDF parser
    const { parsePDFWithPages } = await import('./lib/pdf-parser.js');

    const buffer = fs.readFileSync(testPdfPath);
    const { pages } = await parsePDFWithPages(buffer);

    console.log(`\n📄 PDF chargé: ${pages.length} pages`);

    const pdfDetector = new ChapterDetector(pages);
    const pdfChapters = pdfDetector.detect();

    pdfDetector.printStructure();

    console.log("\n--- Pipeline Format ---");
    const pdfPipeline = chaptersToStructure(pdfChapters, pages);
    console.log(JSON.stringify(pdfPipeline.slice(0, 5), null, 2));
    console.log(`... (${pdfPipeline.length} chapitres au total)`);

  } catch (err) {
    console.log(`\n⚠️ Impossible de tester avec le PDF: ${err.message}`);
  }
}

console.log("\n✅ Test terminé!");
