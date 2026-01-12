// test-full-extraction.ts - Complete test of image extraction API
import { config } from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Load environment variables BEFORE importing modules
config({ path: '.env.local' });

import { extractImagesFromPDF } from './lib/pdf-ocr-server';

async function test() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.log('Usage: npx tsx test-full-extraction.ts <path-to-pdf>');
    process.exit(1);
  }

  console.log(`\n🧪 FULL IMAGE EXTRACTION TEST: ${pdfPath}\n`);

  const pdfBuffer = readFileSync(pdfPath);

  // Extract all images from the PDF
  const extractedImages = await extractImagesFromPDF(pdfBuffer, pdfPath);

  if (extractedImages.length === 0) {
    console.log('\n⚠️ No images found in PDF');
    process.exit(0);
  }

  // Save all extracted images
  const outputDir = join(process.cwd(), 'test-output', 'full-extraction');
  mkdirSync(outputDir, { recursive: true });

  console.log(`\n💾 Saving ${extractedImages.length} images to: ${outputDir}\n`);

  for (const img of extractedImages) {
    const filename = `page-${img.pageNum}-${img.imageId}.png`;
    const filepath = join(outputDir, filename);
    writeFileSync(filepath, img.imageBuffer);
    console.log(`  ✅ ${filename} (${(img.imageBuffer.length / 1024).toFixed(1)}KB)`);
  }

  console.log(`\n✅ Extraction complete! ${extractedImages.length} images saved to: ${outputDir}`);
}

test().catch(console.error);
