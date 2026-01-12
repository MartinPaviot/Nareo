// @ts-nocheck
/**
 * Vision Comparison Test Script
 *
 * Compares graphic analysis between:
 * - OpenAI GPT-4o ($2.50/$10.00 per 1M tokens)
 * - Claude 3.5 Haiku ($0.80/$4.00 per 1M tokens)
 * - Claude 3 Haiku ($0.25/$1.25 per 1M tokens)
 *
 * Usage:
 *   npx tsx test-vision-comparison.ts <courseId> [maxGraphics]
 *
 * Example:
 *   npx tsx test-vision-comparison.ts 123e4567-e89b-12d3-a456-426614174000 3
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import {
  analyzeGraphicWithClaude,
  analyzeGraphicWithAnthropicVision,
  GraphicAnalysis,
} from './lib/image-analysis';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ModelResult {
  name: string;
  cost: string;
  analysis: GraphicAnalysis | null;
  score: number;
}

interface ComparisonResult {
  graphicId: string;
  pageNumber: number;
  models: ModelResult[];
  winner: string;
}

async function fetchGraphicsForCourse(courseId: string) {
  const { data, error } = await supabase
    .from('course_graphics')
    .select('id, page_number, storage_path, graphic_type, description, confidence')
    .eq('course_id', courseId)
    .order('page_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch graphics: ${error.message}`);
  }

  return data || [];
}

async function getImageAsBase64(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('course-graphics')
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Failed to download image: ${error?.message}`);
  }

  const buffer = await data.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}

function scoreAnalysis(analysis: GraphicAnalysis | null): number {
  if (!analysis) return 0;

  let score = 0;

  // Confidence (0-30 points)
  score += Math.round(analysis.confidence * 30);

  // Elements extracted (0-20 points)
  const elements = analysis.elements?.length || 0;
  score += Math.min(elements * 4, 20);

  // Description quality (0-30 points based on length)
  const descLen = analysis.description?.length || 0;
  if (descLen > 150) score += 30;
  else if (descLen > 100) score += 20;
  else if (descLen > 50) score += 10;

  // Has specific type (not just 'other') - 10 points
  if (analysis.type && analysis.type !== 'other') score += 10;

  // Has text content extracted - 10 points
  if (analysis.textContent && analysis.textContent.length > 0) score += 10;

  return score;
}

async function runComparison(courseId: string, maxGraphics: number = 3) {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('           VISION MODEL COMPARISON TEST (3 models)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('Models being tested:');
  console.log('  🔵 GPT-4o        : $2.50/$10.00 per 1M tokens (baseline)');
  console.log('  🟣 Claude 3.5 Haiku: $0.80/$4.00 per 1M tokens (~3x cheaper)');
  console.log('  🟤 Claude 3 Haiku  : $0.25/$1.25 per 1M tokens (~10x cheaper)\n');

  console.log(`Course ID: ${courseId}`);
  console.log(`Max graphics to test: ${maxGraphics}\n`);

  // Fetch graphics
  console.log('Fetching graphics from database...');
  const graphics = await fetchGraphicsForCourse(courseId);
  console.log(`Found ${graphics.length} graphics in database\n`);

  if (graphics.length === 0) {
    console.log('No graphics found for this course. Exiting.');
    return;
  }

  const toTest = graphics.slice(0, maxGraphics);
  const results: ComparisonResult[] = [];
  const totals = { openai: 0, haiku35: 0, haiku: 0 };

  for (let i = 0; i < toTest.length; i++) {
    const graphic = toTest[i];
    console.log(`\n─────────────────────────────────────────────────────────────────`);
    console.log(`[${i + 1}/${toTest.length}] Testing graphic: ${graphic.id.slice(0, 8)}...`);
    console.log(`Page: ${graphic.page_number} | Current type: ${graphic.graphic_type}`);
    console.log(`─────────────────────────────────────────────────────────────────`);

    try {
      // Download image
      console.log('📥 Downloading image...');
      const imageDataUrl = await getImageAsBase64(graphic.storage_path);

      const models: ModelResult[] = [];

      // Test OpenAI GPT-4o
      console.log('\n🔵 Testing GPT-4o...');
      const openaiResult = await analyzeGraphicWithClaude(imageDataUrl);
      models.push({
        name: 'GPT-4o',
        cost: '$2.50/$10.00',
        analysis: openaiResult,
        score: scoreAnalysis(openaiResult),
      });
      console.log(`   Type: ${openaiResult?.type || 'N/A'} | Confidence: ${openaiResult ? (openaiResult.confidence * 100).toFixed(0) + '%' : 'N/A'}`);

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Test Claude 3.5 Haiku
      console.log('\n🟣 Testing Claude 3.5 Haiku...');
      const haiku35Result = await analyzeGraphicWithAnthropicVision(imageDataUrl, 'haiku35');
      models.push({
        name: 'Claude 3.5 Haiku',
        cost: '$0.80/$4.00',
        analysis: haiku35Result,
        score: scoreAnalysis(haiku35Result),
      });
      console.log(`   Type: ${haiku35Result?.type || 'N/A'} | Confidence: ${haiku35Result ? (haiku35Result.confidence * 100).toFixed(0) + '%' : 'N/A'}`);

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Test Claude 3 Haiku
      console.log('\n🟤 Testing Claude 3 Haiku...');
      const haikuResult = await analyzeGraphicWithAnthropicVision(imageDataUrl, 'haiku');
      models.push({
        name: 'Claude 3 Haiku',
        cost: '$0.25/$1.25',
        analysis: haikuResult,
        score: scoreAnalysis(haikuResult),
      });
      console.log(`   Type: ${haikuResult?.type || 'N/A'} | Confidence: ${haikuResult ? (haikuResult.confidence * 100).toFixed(0) + '%' : 'N/A'}`);

      // Determine winner
      const sorted = [...models].sort((a, b) => b.score - a.score);
      const winner = sorted[0].name;

      // Track totals
      if (winner === 'GPT-4o') totals.openai++;
      else if (winner === 'Claude 3.5 Haiku') totals.haiku35++;
      else if (winner === 'Claude 3 Haiku') totals.haiku++;

      results.push({
        graphicId: graphic.id,
        pageNumber: graphic.page_number,
        models,
        winner,
      });

      // Print comparison
      console.log('\n📊 SCORES:');
      models.forEach(m => {
        const isWinner = m.name === winner;
        console.log(`   ${isWinner ? '🏆' : '  '} ${m.name}: ${m.score} pts`);
      });

      // Print descriptions side by side
      console.log('\n📝 DESCRIPTIONS:');
      models.forEach(m => {
        console.log(`   [${m.name}]:`);
        console.log(`   ${m.analysis?.description || 'N/A'}\n`);
      });

    } catch (error: any) {
      console.error(`Error testing graphic ${graphic.id}: ${error.message}`);
      results.push({
        graphicId: graphic.id,
        pageNumber: graphic.page_number,
        models: [],
        winner: 'error',
      });
    }

    // Delay between graphics
    if (i < toTest.length - 1) {
      console.log('\nWaiting 2 seconds before next graphic...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Print summary
  console.log('\n\n═══════════════════════════════════════════════════════════════════');
  console.log('                         SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log(`Total graphics tested: ${results.length}`);
  console.log(`\n🏆 WINS BY MODEL:`);
  console.log(`   🔵 GPT-4o         : ${totals.openai} wins`);
  console.log(`   🟣 Claude 3.5 Haiku: ${totals.haiku35} wins`);
  console.log(`   🟤 Claude 3 Haiku  : ${totals.haiku} wins`);

  // Cost analysis
  console.log('\n💰 COST COMPARISON (per 1000 images, ~500 tokens each):');
  console.log('   🔵 GPT-4o         : ~$6.25');
  console.log('   🟣 Claude 3.5 Haiku: ~$2.40 (62% savings)');
  console.log('   🟤 Claude 3 Haiku  : ~$0.75 (88% savings)');

  // Recommendation
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                      RECOMMENDATION');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const maxWins = Math.max(totals.openai, totals.haiku35, totals.haiku);

  if (totals.haiku35 === maxWins && totals.haiku35 >= totals.openai) {
    console.log('🟣 CLAUDE 3.5 HAIKU is recommended!');
    console.log('   Best quality/price ratio: 3x cheaper than GPT-4o with similar quality.');
    console.log('\n   To switch, change in lib/llm/index.ts:');
    console.log('   visionProvider: "anthropic"');
    console.log('\n   And in lib/image-analysis.ts analyzeGraphic():');
    console.log('   return analyzeGraphicWithAnthropicVision(imageDataUrl, "haiku35");');
  } else if (totals.haiku === maxWins && totals.haiku >= totals.openai) {
    console.log('🟤 CLAUDE 3 HAIKU is recommended!');
    console.log('   10x cheaper than GPT-4o and performs well.');
    console.log('\n   To switch, change visionProvider to "anthropic" in lib/llm/index.ts');
  } else if (totals.openai >= totals.haiku35 && totals.openai >= totals.haiku) {
    console.log('🔵 GPT-4o remains the best choice (current setting).');
    console.log('   Quality advantage justifies the higher cost.');
  } else {
    console.log('🟡 Results are mixed. Consider:');
    console.log('   - GPT-4o for quality-critical applications');
    console.log('   - Claude 3.5 Haiku for cost savings with good quality');
  }

  console.log('\n');
}

// Main
const courseId = process.argv[2];
if (!courseId) {
  console.error('Usage: npx tsx test-vision-comparison.ts <courseId> [maxGraphics]');
  console.error('Example: npx tsx test-vision-comparison.ts 123e4567-e89b-12d3-a456-426614174000 3');
  process.exit(1);
}

const maxGraphics = parseInt(process.argv[3] || '3', 10);

runComparison(courseId, maxGraphics).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
