/**
 * Check graphics in database for a course
 */

import { getServiceSupabase } from './lib/supabase';

const courseId = process.argv[2] || '1b5d1d76-de12-460c-aed5-da290933f0fa';

async function checkGraphics() {
  const admin = getServiceSupabase();

  console.log(`\n📊 Checking graphics for course: ${courseId}\n`);

  // Get all graphics
  const { data: all, error: allError } = await admin
    .from('course_graphics')
    .select('id, image_id, page_number, confidence, graphic_type, elements')
    .eq('course_id', courseId)
    .order('page_number');

  if (allError) {
    console.error('❌ Error:', allError);
    return;
  }

  console.log(`Total graphics: ${all?.length || 0}\n`);

  if (all && all.length > 0) {
    const withElements = all.filter(g => g.elements !== null && g.elements !== undefined);
    const withoutElements = all.filter(g => g.elements === null || g.elements === undefined);
    const lowConfidence = all.filter(g => (g.confidence || 0) < 0.9);
    const highConfidence = all.filter(g => (g.confidence || 0) >= 0.9);

    console.log(`With elements:    ${withElements.length}`);
    console.log(`Without elements: ${withoutElements.length}`);
    console.log(`Low confidence:   ${lowConfidence.length} (< 0.9)`);
    console.log(`High confidence:  ${highConfidence.length} (>= 0.9)\n`);

    console.log('Sample records:');
    all.slice(0, 3).forEach(g => {
      console.log(`  - ${g.image_id} (page ${g.page_number}): confidence=${g.confidence}, type=${g.graphic_type || 'null'}, elements=${g.elements ? 'YES' : 'NO'}`);
    });

    // Check what reanalyze query would find
    const { data: reanalyze, error: reanalyzeError } = await admin
      .from('course_graphics')
      .select('id, image_id, confidence, elements')
      .eq('course_id', courseId)
      .or('confidence.lt.0.9,elements.is.null');

    console.log(`\n🔍 Re-analyze query would find: ${reanalyze?.length || 0} graphics`);

    if (reanalyze && reanalyze.length > 0) {
      console.log('Examples:');
      reanalyze.slice(0, 3).forEach(g => {
        console.log(`  - ${g.image_id}: confidence=${g.confidence}, elements=${g.elements ? 'YES' : 'NO'}`);
      });
    }
  }
}

checkGraphics().catch(console.error);
