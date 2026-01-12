// test-mistral-images.ts - Test that Mistral returns images with includeImageBase64: true
import { config } from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Load environment variables BEFORE importing modules
config({ path: '.env.local' });

import { extractTextWithMistralOCR, extractImagesFromMistralResult } from './lib/mistral-ocr';

async function test() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.log('Usage: npx tsx test-mistral-images.ts <path-to-pdf>');
    process.exit(1);
  }

  console.log(`\n🧪 Testing Mistral Image Extraction (with includeImageBase64): ${pdfPath}\n`);

  const pdfBuffer = readFileSync(pdfPath);

  // Step 1: Extract with Mistral OCR (now includes images)
  const result = await extractTextWithMistralOCR(pdfBuffer, pdfPath);

  if (!result.success) {
    console.error('❌ Mistral OCR failed');
    process.exit(1);
  }

  console.log(`\n✅ Mistral OCR: ${result.pages} pages, ${result.text.length} chars`);

  // Step 2: Extract images directly from Mistral result
  const images = extractImagesFromMistralResult(result);

  console.log(`\n📊 Found ${images.length} images with base64 data\n`);

  if (images.length === 0) {
    console.log('⚠️ No images found (or imageBase64 is still null)');
    process.exit(0);
  }

  // Step 3: Save first few images to verify
  const outputDir = join(process.cwd(), 'test-output', 'mistral-direct');
  mkdirSync(outputDir, { recursive: true });

  console.log(`💾 Saving images to: ${outputDir}\n`);

  for (const img of images.slice(0, 5)) {
    // Extract base64 data (remove data URL prefix if present)
    const base64Data = img.base64Data.includes(',')
      ? img.base64Data.split(',')[1]
      : img.base64Data;

    // Detect format from data URL prefix
    const format = img.base64Data.includes('image/jpeg') ? 'jpg' : 'png';

    const filename = `page-${img.pageNum}-${img.imageId}.${format}`;
    const filepath = join(outputDir, filename);

    writeFileSync(filepath, base64Data, 'base64');

    const sizeKB = (Buffer.from(base64Data, 'base64').length / 1024).toFixed(1);
    console.log(`  ✅ ${filename} (${sizeKB}KB)`);
  }

  if (images.length > 5) {
    console.log(`  ... and ${images.length - 5} more images`);
  }

  console.log(`\n✅ Test complete! Images extracted directly from Mistral (no PDF rendering needed)`);
}

test().catch(console.error);
