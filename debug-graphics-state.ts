/**
 * Diagnostic: Vérifie l'état des graphics après migration 029
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseKey);

const COURSE_ID = '34a9b0a8-a49f-4ded-958d-3f423c3c77a3';

async function diagnose() {
  console.log('🔍 DIAGNOSTIC: État des graphics après migration 029\n');
  console.log(`Course ID: ${COURSE_ID}\n`);

  // 1. Check constraint status
  console.log('═══════════════════════════════════════════════════════════');
  console.log('1️⃣ VÉRIFICATION DU CONSTRAINT');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { data: constraints, error: constraintError } = await admin.rpc('exec_sql', {
    sql: `
      SELECT tc.constraint_name, cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name = 'course_graphics'
        AND tc.constraint_type = 'CHECK'
        AND tc.constraint_name LIKE '%graphic_type%';
    `
  });

  if (constraintError) {
    console.log('⚠️  Impossible de vérifier le constraint');
    console.log('   Erreur:', constraintError.message);
  } else if (!constraints || constraints.length === 0) {
    console.log('✅ Constraint supprimé avec succès!');
    console.log('   Le champ graphic_type accepte maintenant tous les types.\n');
  } else {
    console.log('❌ Constraint TOUJOURS PRÉSENT:');
    console.log(JSON.stringify(constraints, null, 2));
    console.log('\n⚠️  La migration n\'a pas été appliquée correctement!\n');
  }

  // 2. Check graphics count
  console.log('═══════════════════════════════════════════════════════════');
  console.log('2️⃣ NOMBRE DE GRAPHICS DANS LA DB');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { data: graphics, error: graphicsError, count } = await admin
    .from('course_graphics')
    .select('*', { count: 'exact' })
    .eq('course_id', COURSE_ID);

  if (graphicsError) {
    console.log('❌ Erreur:', graphicsError.message);
    return;
  }

  console.log(`📊 Total graphics stockés: ${count || 0}\n`);

  if (!graphics || graphics.length === 0) {
    console.log('❌ AUCUN graphic dans la base de données!');
    console.log('   Cause probable: Le constraint bloquait TOUS les inserts.\n');
    console.log('   Solution: Re-uploader le PDF ou exécuter reanalyze-course-graphics.ts\n');
    return;
  }

  // 3. Check V2 fields
  console.log('═══════════════════════════════════════════════════════════');
  console.log('3️⃣ VÉRIFICATION DES CHAMPS V2');
  console.log('═══════════════════════════════════════════════════════════\n');

  let withElements = 0;
  let withTextContent = 0;
  let withSuggestions = 0;
  let withRelatedConcepts = 0;

  for (const graphic of graphics) {
    if (graphic.elements && graphic.elements.length > 0) withElements++;
    if (graphic.textContent && graphic.textContent.length > 0) withTextContent++;
    if (graphic.suggestions && graphic.suggestions.length > 0) withSuggestions++;
    if (graphic.relatedConcepts && graphic.relatedConcepts.length > 0) withRelatedConcepts++;
  }

  console.log(`Graphics avec champs V2 remplis:`);
  console.log(`   - elements:        ${withElements}/${graphics.length}`);
  console.log(`   - textContent:     ${withTextContent}/${graphics.length}`);
  console.log(`   - suggestions:     ${withSuggestions}/${graphics.length}`);
  console.log(`   - relatedConcepts: ${withRelatedConcepts}/${graphics.length}\n`);

  if (withElements === 0) {
    console.log('❌ AUCUN graphic n\'a les nouveaux champs V2!');
    console.log('   Cause: Graphics analysés avec l\'ANCIEN prompt.\n');
    console.log('   Solution: Exécuter npx tsx reanalyze-course-graphics.ts\n');
  } else if (withElements < graphics.length) {
    console.log('⚠️  Certains graphics manquent les champs V2.');
    console.log(`   ${graphics.length - withElements} graphics à ré-analyser.\n`);
  } else {
    console.log('✅ Tous les graphics ont les champs V2!\n');
  }

  // 4. Check graphic types
  console.log('═══════════════════════════════════════════════════════════');
  console.log('4️⃣ DISTRIBUTION DES TYPES');
  console.log('═══════════════════════════════════════════════════════════\n');

  const typeDistribution = graphics.reduce((acc: any, g: any) => {
    const type = g.graphic_type || 'null';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  Object.entries(typeDistribution)
    .sort(([, a]: any, [, b]: any) => b - a)
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

  console.log('\n');

  // 5. Check confidence
  console.log('═══════════════════════════════════════════════════════════');
  console.log('5️⃣ CONFIANCE (minConfidence = 0.3)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const highConfidence = graphics.filter(g => g.confidence >= 0.9).length;
  const mediumConfidence = graphics.filter(g => g.confidence >= 0.5 && g.confidence < 0.9).length;
  const lowConfidence = graphics.filter(g => g.confidence < 0.5).length;

  console.log(`   Haute (≥0.9):   ${highConfidence}`);
  console.log(`   Moyenne (≥0.5): ${mediumConfidence}`);
  console.log(`   Basse (<0.5):   ${lowConfidence}\n`);

  // 6. Sample graphic
  console.log('═══════════════════════════════════════════════════════════');
  console.log('6️⃣ EXEMPLE DE GRAPHIC (le premier)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const sample = graphics[0];
  console.log(`ID:          ${sample.id}`);
  console.log(`Page:        ${sample.page_number}`);
  console.log(`Type:        ${sample.graphic_type}`);
  console.log(`Confidence:  ${sample.confidence}`);
  console.log(`Description: ${sample.description?.substring(0, 100)}...`);
  console.log(`Elements:    ${sample.elements ? `${sample.elements.length} items` : 'NULL'}`);
  console.log(`Suggestions: ${sample.suggestions ? `${sample.suggestions.length} items` : 'NULL'}\n`);

  // 7. Recommendations
  console.log('═══════════════════════════════════════════════════════════');
  console.log('7️⃣ RECOMMANDATIONS');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (count === 0) {
    console.log('🔴 CRITIQUE: Aucun graphic stocké');
    console.log('   → Re-uploader le PDF dans l\'interface\n');
  } else if (withElements === 0) {
    console.log('🟡 IMPORTANT: Graphics présents mais sans champs V2');
    console.log('   → Exécuter: npx tsx reanalyze-course-graphics.ts\n');
  } else if (highConfidence === 0) {
    console.log('🟡 ATTENTION: Aucun graphic haute confiance');
    console.log('   → Vérifier la qualité des images du PDF\n');
  } else {
    console.log('🟢 Tout semble bon! Régénère la note pour voir les améliorations.\n');
  }
}

diagnose()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  });
