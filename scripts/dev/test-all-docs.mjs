import fs from 'fs';
import path from 'path';

// Get all files from public/Test
const testDir = 'public/Test';
const files = fs.readdirSync(testDir).filter(f =>
  f.endsWith('.pdf') || f.endsWith('.docx') || f.endsWith('.doc')
);

console.log(`Found ${files.length} documents to test\n`);

async function testDocument(filename) {
  const filePath = path.join(testDir, filename);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${filename}`);
  console.log(`${'='.repeat(70)}`);

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  console.log(`File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB, Type: ${ext}`);

  try {
    let result;
    const startTime = Date.now();

    if (ext === '.pdf') {
      const { parsePDF } = await import('./lib/pdf-parser.js');
      result = await parsePDF(buffer);
    } else if (ext === '.docx' || ext === '.doc') {
      const { parseDocx } = await import('./lib/document-parser.js');
      result = await parseDocx(buffer);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ SUCCESS (${elapsed}s)`);
    console.log(`Result length: ${result.length} chars`);
    console.log(`First 250 chars: ${result.substring(0, 250).replace(/\n/g, ' ')}`);

    return { name: filename, success: true, length: result.length, time: elapsed };
  } catch (error) {
    console.error(`\n❌ FAILED: ${error.message}`);
    return { name: filename, success: false, error: error.message };
  }
}

async function main() {
  const results = [];
  for (const file of files) {
    const result = await testDocument(file);
    results.push(result);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(70)}`);

  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    const details = r.success ? `${r.length} chars, ${r.time}s` : r.error;
    console.log(`${status} ${r.name.substring(0, 50).padEnd(50)} (${details})`);
  }

  const passed = results.filter(r => r.success).length;
  console.log(`\nTotal: ${passed}/${results.length} passed`);
}

main().catch(console.error);
