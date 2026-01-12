// @ts-nocheck
/**
 * Test script: Re-analyze graphics for a course
 *
 * Usage: npx tsx test-reanalyze-graphics.ts <courseId>
 *
 * This script:
 * 1. Resets the OpenAI Vision circuit breaker
 * 2. Re-analyzes all graphics that were previously extracted but not analyzed
 * 3. Updates the database with the new analysis results
 */

const courseId = process.argv[2];

if (!courseId) {
  console.error('❌ Usage: npx tsx test-reanalyze-graphics.ts <courseId>');
  process.exit(1);
}

console.log(`\n🔄 Re-analyzing graphics for course: ${courseId}\n`);

async function reanalyzeGraphics() {
  try {
    // Import required modules
    const { reanalyzeGraphics } = await import('./lib/backend/graphics-processor');
    const { openaiVisionCircuitBreaker } = await import('./lib/llm');

    // Reset circuit breaker
    console.log('🔧 Resetting OpenAI Vision circuit breaker...');
    openaiVisionCircuitBreaker.reset();
    console.log('✅ Circuit breaker reset\n');

    // Re-analyze graphics
    console.log('🔍 Starting re-analysis...\n');
    const count = await reanalyzeGraphics(courseId);

    console.log(`\n✅ Re-analysis complete!`);
    console.log(`   Re-analyzed ${count} graphics`);

    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Re-analysis failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

reanalyzeGraphics();
