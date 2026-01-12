/**
 * Vérifie combien de graphics sont inclus dans la note générée
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseKey);

async function checkNoteGraphics() {
  const courseId = '9343e220-c833-4879-ad4c-dea9e3359753';

  console.log('📝 Analyse de la note générée...\n');

  // Get the latest note for this course
  const { data: notes, error } = await admin
    .from('course_notes')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }

  if (!notes || notes.length === 0) {
    console.log('⚠️  Aucune note trouvée pour ce cours');
    return;
  }

  const note = notes[0];

  console.log(`✅ Note trouvée: ${note.id}`);
  console.log(`   Créée le: ${new Date(note.created_at).toLocaleString()}\n`);

  const htmlContent = note.html_content || '';

  // Count <img> tags in the HTML
  const imgMatches = htmlContent.match(/<img[^>]*>/g) || [];
  console.log(`🖼️  Images dans le HTML: ${imgMatches.length}`);

  // Extract unique image URLs
  const imageUrls = new Set<string>();
  imgMatches.forEach((imgTag: string) => {
    const srcMatch = imgTag.match(/src="([^"]*)"/);
    if (srcMatch) {
      imageUrls.add(srcMatch[1]);
    }
  });

  console.log(`   URLs uniques: ${imageUrls.size}\n`);

  // Count graphics references by analyzing the HTML structure
  const graphicSectionMatches = htmlContent.match(/graphic-integration/g) || [];
  console.log(`📊 Sections "graphic-integration": ${graphicSectionMatches.length}`);

  // Show sample URLs
  if (imageUrls.size > 0) {
    console.log('\n🔗 Exemples d\'URLs:');
    Array.from(imageUrls).slice(0, 3).forEach((url, i) => {
      console.log(`   ${i + 1}. ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`);
    });
  }

  // Size info
  const htmlSizeKB = Math.round(htmlContent.length / 1024);
  console.log(`\n📦 Taille du HTML: ${htmlSizeKB} KB`);
}

checkNoteGraphics()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  });
