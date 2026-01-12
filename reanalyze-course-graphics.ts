/**
 * Ré-analyse les graphiques d'un cours avec le nouveau prompt V2
 * pour générer les champs elements, textContent, suggestions, relatedConcepts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { analyzeGraphicsBatch } from './lib/image-analysis';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseKey);

const GRAPHICS_CONFIG = {
  storageBasePath: 'course-graphics',
};

async function reanalyzeGraphics(courseId: string): Promise<number> {
  console.log(`\n🔄 [Re-analyze] Starting for course ${courseId}`);

  // Fetch existing graphics
  const { data: graphics, error } = await admin
    .from('course_graphics')
    .select('*')
    .eq('course_id', courseId);

  if (error) {
    console.error('❌ Error fetching graphics:', error);
    return 0;
  }

  if (!graphics || graphics.length === 0) {
    console.log('✅ No graphics to re-analyze');
    return 0;
  }

  console.log(`   Found ${graphics.length} graphics to re-analyze`);

  // Download images and re-analyze
  const imagesForAnalysis = [];

  for (const graphic of graphics) {
    // Download image from storage
    const { data: imageData, error: downloadError } = await admin.storage
      .from(GRAPHICS_CONFIG.storageBasePath)
      .download(graphic.storage_path);

    if (downloadError || !imageData) {
      console.error(`   ❌ Failed to download ${graphic.image_id}`);
      continue;
    }

    const buffer = Buffer.from(await imageData.arrayBuffer());
    imagesForAnalysis.push({
      pageNum: graphic.page_number,
      imageId: graphic.image_id,
      base64Data: `data:image/jpeg;base64,${buffer.toString('base64')}`,
      graphicDbId: graphic.id,
    });
  }

  console.log(`\n🔍 Analyzing ${imagesForAnalysis.length} graphics with NEW V2 prompt...\n`);

  // Analyze with Claude using NEW prompt
  const analyses = await analyzeGraphicsBatch(imagesForAnalysis);

  // Update database with new analyses
  let updated = 0;
  for (const [imageId, analysis] of analyses) {
    const graphic = graphics.find(g => g.image_id === imageId);
    if (!graphic) continue;

    const { error: updateError } = await admin
      .from('course_graphics')
      .update({
        graphic_type: analysis.type,
        confidence: analysis.confidence,
        description: analysis.description,
        elements: analysis.elements || [],
        textContent: analysis.textContent || [],
        suggestions: analysis.suggestions || [],
        relatedConcepts: analysis.relatedConcepts || [],
      })
      .eq('id', graphic.id);

    if (updateError) {
      console.error(`   ❌ Failed to update ${imageId}:`, updateError.message);
      continue;
    }

    updated++;
    console.log(`   ✅ Updated ${imageId} (${analysis.type})`);
    console.log(`      - ${analysis.elements?.length || 0} elements`);
    console.log(`      - ${analysis.textContent?.length || 0} text items`);
    console.log(`      - ${analysis.suggestions?.length || 0} suggestions`);
  }

  console.log(`\n✅ Re-analyzed ${updated}/${graphics.length} graphics`);
  return updated;
}

// Main
const courseId = 'bcdaa409-c65c-426d-83a3-3a098cb5c611';

console.log('🔄 Ré-analyse des graphiques avec le prompt V2\n');
console.log(`Course ID: ${courseId}\n`);

reanalyzeGraphics(courseId)
  .then(count => {
    console.log(`\n✅ Ré-analyse terminée: ${count} graphiques mis à jour`);
    console.log('\n📝 Vous pouvez maintenant régénérer la note pour voir les améliorations:');
    console.log('   1. Allez sur le cours dans l\'interface');
    console.log('   2. Cliquez sur "Générer Fiche de Révision A+"');
    console.log('   3. Les 20 graphiques devraient maintenant être inclus avec contexte enrichi\n');
  })
  .catch(error => {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
