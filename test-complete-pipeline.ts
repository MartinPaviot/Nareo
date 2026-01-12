// test-complete-pipeline.ts - Pipeline complet : Extraction Mistral + Analyse Claude
import { config } from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Load environment variables BEFORE importing modules
config({ path: '.env.local' });

import { extractTextWithMistralOCR, extractImagesFromMistralResult } from './lib/mistral-ocr';
import { analyzeGraphicsBatch, type GraphicAnalysis } from './lib/image-analysis';

async function test() {
  const pdfPath = process.argv[2];
  const maxImages = parseInt(process.argv[3] || '5'); // Limit number of images to analyze

  if (!pdfPath) {
    console.log('Usage: npx tsx test-complete-pipeline.ts <path-to-pdf> [max-images]');
    console.log('');
    console.log('Example: npx tsx test-complete-pipeline.ts document.pdf 10');
    console.log('');
    console.log('This will:');
    console.log('  1. Extract images from PDF with Mistral OCR');
    console.log('  2. Analyze each image with Claude Vision');
    console.log('  3. Save images + metadata as JSON');
    process.exit(1);
  }

  console.log(`\n🚀 COMPLETE PIPELINE TEST: ${pdfPath}`);
  console.log(`   Max images to analyze: ${maxImages}\n`);

  const pdfBuffer = readFileSync(pdfPath);

  // ============================================================
  // STEP 1: Extract images from PDF with Mistral OCR
  // ============================================================
  console.log('📄 STEP 1: Extracting images with Mistral OCR...\n');

  const mistralResult = await extractTextWithMistralOCR(pdfBuffer, pdfPath);

  if (!mistralResult.success) {
    console.error('❌ Mistral OCR failed');
    process.exit(1);
  }

  const images = extractImagesFromMistralResult(mistralResult);

  if (images.length === 0) {
    console.log('⚠️ No images found in PDF');
    process.exit(0);
  }

  console.log(`✅ Extracted ${images.length} images from PDF\n`);

  // ============================================================
  // STEP 2: Analyze images with Claude Vision (limited to maxImages)
  // ============================================================
  const imagesToAnalyze = images.slice(0, maxImages);

  console.log(`🔍 STEP 2: Analyzing ${imagesToAnalyze.length} images with Claude Vision...\n`);

  const analyses = await analyzeGraphicsBatch(imagesToAnalyze);

  // ============================================================
  // STEP 3: Save results (images + metadata)
  // ============================================================
  console.log(`\n💾 STEP 3: Saving results...\n`);

  const outputDir = join(process.cwd(), 'test-output', 'complete-pipeline');
  mkdirSync(outputDir, { recursive: true });

  // Save each image with its analysis
  const results: Array<{
    imageId: string;
    pageNum: number;
    filename: string;
    analysis: GraphicAnalysis | null;
  }> = [];

  for (const img of imagesToAnalyze) {
    // Extract base64 data (remove data URL prefix if present)
    const base64Data = img.base64Data.includes(',')
      ? img.base64Data.split(',')[1]
      : img.base64Data;

    // Detect format from data URL prefix
    const format = img.base64Data.includes('image/jpeg') ? 'jpg' : 'png';
    const filename = `page-${img.pageNum}-${img.imageId}.${format}`;
    const filepath = join(outputDir, filename);

    // Save image
    writeFileSync(filepath, base64Data, 'base64');

    const analysis = analyses.get(img.imageId) || null;
    const sizeKB = (Buffer.from(base64Data, 'base64').length / 1024).toFixed(1);

    console.log(`  ✅ ${filename} (${sizeKB}KB)`);
    if (analysis) {
      console.log(`     → ${analysis.type} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`);
      console.log(`     → ${analysis.elements.length} elements: ${analysis.description}`);
    } else {
      console.log(`     → Analysis failed or skipped`);
    }

    results.push({
      imageId: img.imageId,
      pageNum: img.pageNum,
      filename,
      analysis,
    });
  }

  // Save summary JSON
  const summaryPath = join(outputDir, '_summary.json');
  writeFileSync(summaryPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n  📋 Summary saved to: _summary.json`);

  // ============================================================
  // STEP 4: Display statistics
  // ============================================================
  console.log(`\n📊 STATISTICS:\n`);
  console.log(`  Total images extracted: ${images.length}`);
  console.log(`  Images analyzed: ${analyses.size}/${imagesToAnalyze.length}`);

  // Count by type
  const typeCounts = new Map<string, number>();
  for (const analysis of analyses.values()) {
    typeCounts.set(analysis.type, (typeCounts.get(analysis.type) || 0) + 1);
  }

  if (typeCounts.size > 0) {
    console.log(`\n  Breakdown by type:`);
    for (const [type, count] of typeCounts.entries()) {
      console.log(`    - ${type}: ${count}`);
    }
  }

  // Average confidence
  const confidences = Array.from(analyses.values()).map(a => a.confidence);
  if (confidences.length > 0) {
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    console.log(`\n  Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  }

  console.log(`\n✅ Pipeline complete! Results saved to: ${outputDir}`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Review _summary.json for all analyses`);
  console.log(`   2. Use the coordinates to generate SVG overlays`);
  console.log(`   3. Import into Nareo for interactive revision cards\n`);
}

test().catch(console.error);
