// test-generate-html.ts - Generate annotated HTML visualizations
import { config } from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

config({ path: '.env.local' });

import { generateAnnotatedHTML } from './lib/svg-generator';
import type { GraphicAnalysis } from './lib/image-analysis';

async function test() {
  const summaryPath = process.argv[2] || join(process.cwd(), 'test-output', 'complete-pipeline', '_summary.json');

  console.log(`\n🎨 Generating annotated HTML visualizations...\n`);
  console.log(`   Reading: ${summaryPath}\n`);

  // Read summary JSON
  const summaryContent = readFileSync(summaryPath, 'utf-8');
  const results: Array<{
    imageId: string;
    pageNum: number;
    filename: string;
    analysis: GraphicAnalysis | null;
  }> = JSON.parse(summaryContent);

  // Output directory
  const outputDir = join(process.cwd(), 'test-output', 'annotated-html');
  mkdirSync(outputDir, { recursive: true });

  // Get input directory from summary path
  const inputDir = join(summaryPath, '..');

  // Generate HTML for each analyzed image
  let generated = 0;
  for (const result of results) {
    if (!result.analysis) {
      console.log(`⚠️ Skipping ${result.filename} (no analysis)`);
      continue;
    }

    // Read image file
    const imagePath = join(inputDir, result.filename);
    const imageBuffer = readFileSync(imagePath);
    const base64Data = imageBuffer.toString('base64');

    // Detect format
    const format = result.filename.endsWith('.jpg') ? 'jpeg' : 'png';
    const dataUrl = `data:image/${format};base64,${base64Data}`;

    // Generate HTML
    const html = generateAnnotatedHTML(
      result.analysis,
      dataUrl,
      800, // Default width
      600  // Default height (will maintain aspect ratio)
    );

    // Save HTML file
    const htmlFilename = result.filename.replace(/\.(jpg|png)$/, '.html');
    const htmlPath = join(outputDir, htmlFilename);
    writeFileSync(htmlPath, html, 'utf-8');

    console.log(`✅ ${htmlFilename}`);
    console.log(`   → ${result.analysis.type} (${result.analysis.elements.length} elements)`);
    generated++;
  }

  console.log(`\n✅ Generated ${generated} annotated HTML files`);
  console.log(`\n📂 Output directory: ${outputDir}`);
  console.log(`\n💡 Open any .html file in your browser to see the annotated graphic!`);
}

test().catch(console.error);
