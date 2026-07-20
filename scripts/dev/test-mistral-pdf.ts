// test-mistral-pdf.ts (à la racine du projet)
import { config } from 'dotenv';
import { readFileSync } from 'fs';

// Charge les variables d'environnement AVANT d'importer mistral-ocr
config({ path: '.env.local' });

import { extractTextWithMistralOCR } from '../../lib/mistral-ocr';

async function test() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.log('Usage: npx tsx test-mistral-pdf.ts <chemin-vers-pdf>');
    process.exit(1);
  }

  // DEBUG: Vérifier si la clé API est chargée
  const mistralKey = process.env.MISTRAL;
  console.log('\n🔑 Mistral API Key check:');
  console.log('  - Loaded:', mistralKey ? 'YES' : 'NO');
  console.log('  - Length:', mistralKey?.length || 0);
  console.log('  - First 10 chars:', mistralKey?.substring(0, 10) || 'N/A');

  console.log(`\n🧪 TEST 2: Mistral OCR sur PDF COMPLET: ${pdfPath}\n`);

  const pdfBuffer = readFileSync(pdfPath);
  const result = await extractTextWithMistralOCR(pdfBuffer, pdfPath);

  console.log('\n📊 Résultat final:');
  console.log('  - Success:', result.success);
  console.log('  - Pages:', result.pages);
  console.log('  - Text length:', result.text.length);
}

test().catch(console.error);
