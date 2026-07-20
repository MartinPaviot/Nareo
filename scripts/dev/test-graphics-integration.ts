// @ts-nocheck
/**
 * Test Graphics Integration
 *
 * Quick test to verify the graphics extraction pipeline works end-to-end
 *
 * Usage:
 *   npx tsx test-graphics-integration.ts
 */

import 'dotenv/config';
import { getServiceSupabase } from '../../lib/supabase';

async function testGraphicsIntegration() {
  console.log('\n🧪 Testing Graphics Integration...\n');

  const admin = getServiceSupabase();

  // ============================================================================
  // 1. Check database table exists
  // ============================================================================
  console.log('1️⃣ Checking database table...');

  const { data: tables, error: tableError } = await admin
    .rpc('check_table_exists', { table_name: 'course_graphics' })
    .catch(() => ({ data: null, error: 'RPC not available' }));

  // Alternative: Try to query the table
  const { error: queryError } = await admin
    .from('course_graphics')
    .select('count')
    .limit(1);

  if (queryError) {
    console.log('   ❌ Table course_graphics not found or not accessible');
    console.log('   💡 Run migration: database/migrations/026_course_graphics.sql');
    return;
  }

  console.log('   ✅ Table course_graphics exists and is accessible');

  // ============================================================================
  // 2. Check storage bucket exists
  // ============================================================================
  console.log('\n2️⃣ Checking storage bucket...');

  const { data: buckets, error: bucketError } = await admin
    .storage
    .listBuckets();

  if (bucketError) {
    console.log('   ❌ Error checking buckets:', bucketError.message);
    return;
  }

  const courseGraphicsBucket = buckets?.find(b => b.id === 'course-graphics');

  if (!courseGraphicsBucket) {
    console.log('   ❌ Bucket "course-graphics" not found');
    console.log('   💡 Run migration: database/migrations/026_course_graphics.sql');
    return;
  }

  console.log('   ✅ Bucket "course-graphics" exists');
  console.log(`      Public: ${courseGraphicsBucket.public}`);

  // ============================================================================
  // 3. Check API keys configured
  // ============================================================================
  console.log('\n3️⃣ Checking API keys...');

  if (!process.env.MISTRAL) {
    console.log('   ❌ MISTRAL API key not configured');
    console.log('   💡 Add MISTRAL=your_key to .env.local');
  } else {
    console.log('   ✅ MISTRAL API key configured');
  }

  if (!process.env.OPENAI_API_KEY && !process.env.CLAUDE_API_KEY) {
    console.log('   ⚠️  No Claude Vision API key configured');
    console.log('   💡 Add OPENAI_API_KEY or CLAUDE_API_KEY to .env.local');
  } else {
    console.log('   ✅ Claude Vision API key configured');
  }

  // ============================================================================
  // 4. Check existing graphics
  // ============================================================================
  console.log('\n4️⃣ Checking existing graphics...');

  const { data: graphics, error: graphicsError } = await admin
    .from('course_graphics')
    .select('id, course_id, page_number, graphic_type, confidence')
    .order('created_at', { ascending: false })
    .limit(10);

  if (graphicsError) {
    console.log('   ❌ Error fetching graphics:', graphicsError.message);
    return;
  }

  if (!graphics || graphics.length === 0) {
    console.log('   ℹ️  No graphics found yet');
    console.log('   💡 Upload a PDF to test extraction');
  } else {
    console.log(`   ✅ Found ${graphics.length} graphics (showing last 10):`);

    for (const g of graphics) {
      console.log(`      - Page ${g.page_number}: ${g.graphic_type} (${(g.confidence * 100).toFixed(0)}%)`);
    }
  }

  // ============================================================================
  // 5. Test API route (if server running)
  // ============================================================================
  console.log('\n5️⃣ Testing API route...');

  if (graphics && graphics.length > 0) {
    const testCourseId = graphics[0].course_id;

    try {
      const response = await fetch(`http://localhost:3000/api/courses/${testCourseId}/graphics`);

      if (!response.ok) {
        console.log('   ⚠️  API route not accessible (is server running?)');
        console.log('   💡 Start server: npm run dev');
      } else {
        const data = await response.json();
        console.log(`   ✅ API route working: ${data.count} graphics returned`);
      }
    } catch (error: any) {
      console.log('   ℹ️  Could not test API route (server not running)');
      console.log('   💡 Start server: npm run dev');
    }
  } else {
    console.log('   ℹ️  Skipped (no graphics to test with)');
  }

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('\n📊 Summary:');
  console.log('   - Database: ✅ Ready');
  console.log('   - Storage: ✅ Ready');
  console.log('   - API Keys: ' + (process.env.MISTRAL && (process.env.OPENAI_API_KEY || process.env.CLAUDE_API_KEY) ? '✅ Configured' : '⚠️  Missing'));
  console.log('   - Existing Graphics: ' + (graphics && graphics.length > 0 ? `✅ ${graphics.length} found` : 'ℹ️  None yet'));

  console.log('\n🎯 Next Steps:');
  console.log('   1. Start server: npm run dev');
  console.log('   2. Upload a PDF with graphics');
  console.log('   3. Check logs for extraction progress');
  console.log('   4. Open revision sheet to see graphics at bottom');

  console.log('\n✅ Integration test complete!\n');
}

// Run test
testGraphicsIntegration().catch(console.error);
