// test-image-extraction.ts
import { config } from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Load environment variables BEFORE importing modules
config({ path: '.env.local' });

import { extractTextWithMistralOCR } from '../../lib/mistral-ocr';
import { extractImagesFromPage } from '../../lib/pdf-ocr-server';

async function test() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.log('Usage: npx tsx test-image-extraction.ts <path-to-pdf>');
    process.exit(1);
  }

  console.log(`\n🧪 Testing Image Extraction: ${pdfPath}\n`);

  // Step 1: Extract text + image metadata with Mistral OCR
  const pdfBuffer = readFileSync(pdfPath);
  const result = await extractTextWithMistralOCR(pdfBuffer, pdfPath);

  if (!result.success || !result.pagesData) {
    console.error('❌ Mistral OCR failed');
    process.exit(1);
  }

  console.log(`\n✅ Mistral OCR: ${result.pages} pages, ${result.text.length} chars`);

  // Step 2: Find pages with images
  const pagesWithImages = result.pagesData.filter((page) => page.images && page.images.length > 0);
  console.log(`\n📊 Found ${pagesWithImages.length} pages with images:`);

  for (const page of pagesWithImages.slice(0, 5)) {
    console.log(`  - Page ${page.index}: ${page.images?.length || 0} image(s)`);
  }

  if (pagesWithImages.length > 5) {
    console.log(`  ... and ${pagesWithImages.length - 5} more pages`);
  }

  // Step 3: Extract images from first page with images
  if (pagesWithImages.length > 0) {
    const firstPage = pagesWithImages[0];
    console.log(`\n🖼️ Extracting images from page ${firstPage.index}...`);

    const extractedImages = await extractImagesFromPage(
      pdfBuffer,
      firstPage.index + 1, // Convert 0-indexed to 1-indexed
      firstPage.images || []
    );

    // Step 4: Save extracted images
    if (extractedImages.length > 0) {
      const outputDir = join(process.cwd(), 'test-output', 'extracted-images');
      mkdirSync(outputDir, { recursive: true });

      console.log(`\n💾 Saving images to: ${outputDir}`);

      for (const { id, imageBuffer } of extractedImages) {
        const filename = `page-${firstPage.index}-${id}.png`;
        const filepath = join(outputDir, filename);
        writeFileSync(filepath, imageBuffer);
        console.log(`  ✅ Saved: ${filename} (${(imageBuffer.length / 1024).toFixed(1)}KB)`);
      }

      console.log(`\n✅ Test complete! Check images in: ${outputDir}`);
    } else {
      console.log('\n⚠️ No images were extracted');
    }
  } else {
    console.log('\n⚠️ No pages with images found');
  }
}

test().catch(console.error);
