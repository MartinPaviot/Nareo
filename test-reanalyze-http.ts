// @ts-nocheck
/**
 * Test script: Re-analyze graphics via HTTP API
 *
 * Usage: npx tsx test-reanalyze-http.ts <courseId>
 */

const courseId = process.argv[2] || '1b5d1d76-de12-460c-aed5-da290933f0fa';
const port = process.env.PORT || 3000;
const baseUrl = `http://localhost:${port}`;

console.log(`\n🔄 Re-analyzing graphics for course: ${courseId}\n`);
console.log(`   API URL: ${baseUrl}/api/courses/${courseId}/graphics\n`);

async function reanalyzeViaHttp() {
  try {
    const response = await fetch(`${baseUrl}/api/courses/${courseId}/graphics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }

    console.log('✅ Re-analysis complete!');
    console.log(`   Result:`, data);

    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Re-analysis failed:', error.message);
    process.exit(1);
  }
}

reanalyzeViaHttp();
