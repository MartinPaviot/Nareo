import fs from 'fs';
import path from 'path';

const testDir = 'public/Test';

// Get all PDF files in the test directory
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.pdf'));

console.log(`Found ${files.length} PDF files to test\n`);

// Import the modules
const { parsePDF } = await import('./lib/pdf-parser.js');
const { detectDocumentStructure, detectStructureQuick } = await import('./lib/llm/document-structure-detector.js');

for (const filename of files) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${filename}`);
  console.log('='.repeat(60));

  try {
    const filePath = path.join(testDir, filename);
    const buffer = fs.readFileSync(filePath);

    // Parse PDF
    console.log('Parsing PDF...');
    const text = await parsePDF(buffer);
    console.log(`Extracted ${text.length} characters`);

    // Show first 500 chars to understand structure
    console.log('\n--- First 500 chars ---');
    console.log(text.substring(0, 500));
    console.log('--- End preview ---\n');

    // Try quick detection first (regex only)
    console.log('Quick detection (regex only)...');
    const quickStructure = detectStructureQuick(text);
    console.log(`  Found ${quickStructure.sections.length} sections (confidence: ${quickStructure.confidence})`);
    if (quickStructure.sections.length > 0) {
      console.log('  Sections:');
      quickStructure.sections.slice(0, 5).forEach((s, i) => {
        console.log(`    ${i + 1}. "${s.title}" (pos: ${s.estimatedPosition})`);
      });
    }

    // Try LLM-based detection
    console.log('\nLLM-based detection...');
    const llmStructure = await detectDocumentStructure(text, 'EN', true);
    console.log(`  Document type: ${llmStructure.documentType}`);
    console.log(`  Confidence: ${llmStructure.confidence}`);
    console.log(`  Found ${llmStructure.sections.length} sections`);
    if (llmStructure.sections.length > 0) {
      console.log('  Sections:');
      llmStructure.sections.forEach((s, i) => {
        console.log(`    ${i + 1}. "${s.title}" (level: ${s.level}, formulas: ${s.hasFormulas})`);
      });
    }

    // Verdict
    const wouldUseReal = llmStructure.confidence >= 0.6 && llmStructure.sections.length >= 2;
    console.log(`\n  → Would use real chapters: ${wouldUseReal ? 'YES ✅' : 'NO ❌'}`);

  } catch (error) {
    console.error(`  ERROR: ${error.message}`);
  }
}

console.log('\n\nDone!');
