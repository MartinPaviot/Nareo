/**
 * Vérifie le nombre exact de graphics pour le cours actuel
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseKey);

async function checkGraphicsCount() {
  const courseId = '9343e220-c833-4879-ad4c-dea9e3359753';

  console.log('📊 Analyse des graphics du cours...\n');

  const { data: graphics, error } = await admin
    .from('course_graphics')
    .select('*')
    .eq('course_id', courseId)
    .order('page_number', { ascending: true });

  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }

  console.log(`✅ Total graphics stockés: ${graphics.length}\n`);

  // Group by page
  const byPage = graphics.reduce((acc, g) => {
    if (!acc[g.page_number]) acc[g.page_number] = [];
    acc[g.page_number].push(g);
    return acc;
  }, {} as Record<number, any[]>);

  console.log('📄 Par page:');
  Object.keys(byPage)
    .sort((a, b) => Number(a) - Number(b))
    .forEach(page => {
      console.log(`   Page ${page}: ${byPage[page].length} graphic(s)`);
    });

  console.log('\n📈 Par type:');
  const byType = graphics.reduce((acc, g) => {
    if (!acc[g.graphic_type]) acc[g.graphic_type] = 0;
    acc[g.graphic_type]++;
    return acc;
  }, {} as Record<string, number>);

  (Object.entries(byType) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

  console.log('\n🎯 Confidence moyenne:',
    (graphics.reduce((sum, g) => sum + g.confidence, 0) / graphics.length).toFixed(2)
  );

  // Check V2 fields
  const withElements = graphics.filter(g => g.elements && g.elements.length > 0);
  const withSuggestions = graphics.filter(g => g.suggestions && g.suggestions.length > 0);

  console.log(`\n✨ Champs V2:`);
  console.log(`   Avec elements: ${withElements.length}/${graphics.length} (${Math.round((withElements.length / graphics.length) * 100)}%)`);
  console.log(`   Avec suggestions: ${withSuggestions.length}/${graphics.length} (${Math.round((withSuggestions.length / graphics.length) * 100)}%)`);
}

checkGraphicsCount()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  });
