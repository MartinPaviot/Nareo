/**
 * Vérifie directement si le constraint existe via une requête simple
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseKey);

async function checkConstraint() {
  console.log('🔍 Vérification du constraint...\n');

  // Test 1: Try to insert a graphic with a new V2 type
  console.log('Test 1: Tentative d\'insertion avec type V2...');

  const testGraphic = {
    course_id: '9343e220-c833-4879-ad4c-dea9e3359753',
    page_number: 999,
    image_id: 'test-constraint-check.jpeg',
    storage_path: 'test/constraint-check.jpeg',
    graphic_type: 'supply_demand_curve', // Type V2 en anglais
    confidence: 0.95,
    description: 'Test constraint check',
    elements: ['test'],
    suggestions: ['test'],
  };

  const { data: insertData, error: insertError } = await admin
    .from('course_graphics')
    .insert(testGraphic)
    .select();

  if (insertError) {
    console.log('❌ INSERT ÉCHOUÉ:');
    console.log('   Message:', insertError.message);
    console.log('   Code:', insertError.code);
    console.log('   Details:', insertError.details);

    if (insertError.message.includes('check constraint')) {
      console.log('\n🔴 LE CONSTRAINT EXISTE TOUJOURS!\n');
      console.log('Solutions possibles:');
      console.log('1. La migration n\'a pas été exécutée dans Supabase SQL Editor');
      console.log('2. Tu as plusieurs environnements (dev/prod) et tu es sur le mauvais');
      console.log('3. Il faut reconnecter ou rafraîchir le cache Supabase\n');
    }
    return;
  }

  console.log('✅ INSERT RÉUSSI!');
  console.log('   Le constraint a bien été supprimé.\n');

  // Cleanup: delete test graphic
  await admin
    .from('course_graphics')
    .delete()
    .eq('image_id', 'test-constraint-check.jpeg');

  console.log('🧹 Test graphic nettoyé.\n');

  // Test 2: Check why real graphics aren't being stored
  console.log('Test 2: Vérification des graphics existants...');
  const { data: graphics, count } = await admin
    .from('course_graphics')
    .select('*', { count: 'exact' })
    .eq('course_id', '9343e220-c833-4879-ad4c-dea9e3359753');

  console.log(`   Graphics stockés pour ce cours: ${count || 0}\n`);

  if (count === 0) {
    console.log('⚠️  Aucun graphic stocké malgré le constraint supprimé.');
    console.log('   Possible causes:');
    console.log('   - Le pipeline échoue avant d\'arriver au INSERT');
    console.log('   - Erreur de permission (RLS policy)');
    console.log('   - Course ID différent\n');
  }
}

checkConstraint()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  });
