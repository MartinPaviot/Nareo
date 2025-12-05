import fs from 'fs';
import path from 'path';

const filePath = 'public/Test/2. PE.pdf';

console.log(`Testing: ${filePath}\n`);

const buffer = fs.readFileSync(filePath);

const { parsePDF } = await import('./lib/pdf-parser.js');

try {
  console.log('Parsing PDF...');
  const text = await parsePDF(buffer);
  console.log(`\n✅ SUCCESS! Extracted ${text.length} characters`);
  console.log('\n--- First 500 chars ---');
  console.log(text.substring(0, 500));
  console.log('--- End preview ---');
} catch (error) {
  console.error(`\n❌ FAILED: ${error.message}`);
}
