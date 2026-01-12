/**
 * Debug Note Quality - Analyse la qualité d'intégration des graphiques
 *
 * Vérifie que chaque graphique a :
 * - Une introduction avant (2-3 phrases)
 * - Une analyse après (3-5 phrases)
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseKey);

// Mots-clés pour détecter une introduction
const INTRO_KEYWORDS = [
  'illustre',
  'montre',
  'représente',
  'suivant',
  'ci-dessous',
  'ci-dessus',
  'graphique',
  'schéma',
  'diagramme',
  'figure',
  'exemple',
  'visible',
  'présent',
];

// Mots-clés pour détecter une analyse
const ANALYSIS_KEYWORDS = [
  'observe',
  'observez',
  'noter',
  'notez',
  'intersection',
  'courbe',
  'axe',
  'point',
  'zone',
  'surplus',
  'équilibre',
  'demande',
  'offre',
  'prix',
  'quantité',
  'élasticité',
  'constat',
  'analyse',
  'interpréter',
];

interface GraphicContext {
  url: string;
  before: string;
  after: string;
  hasIntro: boolean;
  hasAnalysis: boolean;
  introKeywords: string[];
  analysisKeywords: string[];
}

/**
 * Extrait tous les graphiques avec leur contexte
 */
function extractGraphicsWithContext(markdown: string): GraphicContext[] {
  const graphics: GraphicContext[] = [];

  // Regex pour trouver les images Supabase
  const imageRegex = /!\[([^\]]*)\]\((https:\/\/[^\)]+\.supabase\.co[^\)]+)\)/g;

  let match;
  while ((match = imageRegex.exec(markdown)) !== null) {
    const url = match[2];
    const matchIndex = match.index;

    // Extraire contexte avant (300 caractères)
    const beforeStart = Math.max(0, matchIndex - 300);
    const before = markdown.substring(beforeStart, matchIndex).trim();

    // Extraire contexte après (400 caractères)
    const afterStart = matchIndex + match[0].length;
    const after = markdown.substring(afterStart, afterStart + 400).trim();

    // Détecter mots-clés d'introduction
    const introKeywords = INTRO_KEYWORDS.filter(keyword =>
      before.toLowerCase().includes(keyword.toLowerCase())
    );
    const hasIntro = introKeywords.length > 0;

    // Détecter mots-clés d'analyse
    const analysisKeywords = ANALYSIS_KEYWORDS.filter(keyword =>
      after.toLowerCase().includes(keyword.toLowerCase())
    );
    const hasAnalysis = analysisKeywords.length > 0;

    graphics.push({
      url,
      before,
      after,
      hasIntro,
      hasAnalysis,
      introKeywords,
      analysisKeywords,
    });
  }

  return graphics;
}

/**
 * Trouve le meilleur exemple (graphique avec intro ET analyse)
 */
function findBestExample(graphics: GraphicContext[]): GraphicContext | null {
  return graphics
    .filter(g => g.hasIntro && g.hasAnalysis)
    .sort((a, b) => {
      const scoreA = a.introKeywords.length + a.analysisKeywords.length;
      const scoreB = b.introKeywords.length + b.analysisKeywords.length;
      return scoreB - scoreA;
    })[0] || null;
}

/**
 * Fonction principale
 */
async function main() {
  const courseId = '9343e220-c833-4879-ad4c-dea9e3359753';

  console.log('\n🔍 Analyse de la qualité d\'intégration des graphiques\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // Récupérer la note
  const { data: course, error } = await admin
    .from('courses')
    .select('aplus_note, title')
    .eq('id', courseId)
    .single();

  if (error || !course || !course.aplus_note) {
    console.error('❌ Erreur:', error?.message || 'Note non trouvée');
    return;
  }

  console.log(`📄 Cours : ${course.title}`);
  console.log(`📝 Longueur de la note : ${course.aplus_note.length.toLocaleString()} caractères\n`);

  // Extraire les graphiques avec contexte
  const graphics = extractGraphicsWithContext(course.aplus_note);

  if (graphics.length === 0) {
    console.log('⚠️  Aucun graphique trouvé dans la note.\n');
    return;
  }

  // Calculer les statistiques
  const withIntro = graphics.filter(g => g.hasIntro).length;
  const withAnalysis = graphics.filter(g => g.hasAnalysis).length;
  const withBoth = graphics.filter(g => g.hasIntro && g.hasAnalysis).length;

  const introPercentage = Math.round((withIntro / graphics.length) * 100);
  const analysisPercentage = Math.round((withAnalysis / graphics.length) * 100);
  const qualityScore = Math.round((withBoth / graphics.length) * 100);

  // Afficher les statistiques
  console.log('📊 STATISTIQUES\n');
  console.log(`Total graphiques trouvés      : ${graphics.length}`);
  console.log(`Avec introduction (avant)     : ${withIntro} (${introPercentage}%)`);
  console.log(`Avec analyse (après)          : ${withAnalysis} (${analysisPercentage}%)`);
  console.log(`Avec intro ET analyse         : ${withBoth} (${qualityScore}%)`);
  console.log();

  // Score de qualité
  let qualityEmoji = '❌';
  let qualityText = 'Très faible';

  if (qualityScore >= 90) {
    qualityEmoji = '🟢';
    qualityText = 'Excellent';
  } else if (qualityScore >= 70) {
    qualityEmoji = '🟡';
    qualityText = 'Bon';
  } else if (qualityScore >= 50) {
    qualityEmoji = '🟠';
    qualityText = 'Moyen';
  } else if (qualityScore >= 30) {
    qualityEmoji = '🔴';
    qualityText = 'Faible';
  }

  console.log(`${qualityEmoji} Score de qualité : ${qualityScore}% (${qualityText})`);
  console.log();

  // Détails par graphique
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log('📋 DÉTAILS PAR GRAPHIQUE\n');

  graphics.forEach((g, index) => {
    const status = g.hasIntro && g.hasAnalysis ? '✅' : g.hasIntro || g.hasAnalysis ? '⚠️' : '❌';

    console.log(`${status} Graphique ${index + 1}/${graphics.length}`);

    if (g.hasIntro) {
      console.log(`   ✓ Introduction détectée (${g.introKeywords.join(', ')})`);
    } else {
      console.log(`   ✗ Pas d'introduction`);
    }

    if (g.hasAnalysis) {
      console.log(`   ✓ Analyse détectée (${g.analysisKeywords.join(', ')})`);
    } else {
      console.log(`   ✗ Pas d'analyse`);
    }

    console.log();
  });

  // Afficher le meilleur exemple
  const bestExample = findBestExample(graphics);

  if (bestExample) {
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    console.log('🌟 EXEMPLE DE GRAPHIQUE BIEN INTÉGRÉ\n');

    console.log('📝 CONTEXTE AVANT (introduction) :');
    console.log('─'.repeat(79));
    console.log(bestExample.before);
    console.log();

    console.log('🖼️  IMAGE :');
    console.log('─'.repeat(79));
    console.log(`![Image](${bestExample.url})`);
    console.log();

    console.log('📊 CONTEXTE APRÈS (analyse) :');
    console.log('─'.repeat(79));
    console.log(bestExample.after);
    console.log();

    console.log('✨ Mots-clés détectés :');
    console.log(`   Introduction : ${bestExample.introKeywords.join(', ')}`);
    console.log(`   Analyse      : ${bestExample.analysisKeywords.join(', ')}`);
    console.log();
  } else if (graphics.length > 0) {
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    console.log('⚠️  Aucun graphique parfaitement intégré trouvé.\n');

    // Afficher le premier graphique comme exemple
    const example = graphics[0];
    console.log('📝 Exemple du premier graphique trouvé :\n');
    console.log('AVANT :');
    console.log('─'.repeat(79));
    console.log(example.before || '(vide)');
    console.log();
    console.log('IMAGE :');
    console.log('─'.repeat(79));
    console.log(`![Image](${example.url})`);
    console.log();
    console.log('APRÈS :');
    console.log('─'.repeat(79));
    console.log(example.after || '(vide)');
    console.log();
  }

  // Recommandations
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log('💡 RECOMMANDATIONS\n');

  if (qualityScore < 50) {
    console.log('🔴 ACTIONS URGENTES :');
    console.log('   1. Vérifier que le prompt V2 est bien utilisé');
    console.log('   2. Régénérer la note avec les nouveaux prompts');
    console.log('   3. Vérifier que formatGraphicsContext() est appelé');
    console.log();
  } else if (qualityScore < 80) {
    console.log('🟠 AMÉLIORATIONS POSSIBLES :');
    console.log('   1. Renforcer les instructions du prompt');
    console.log('   2. Ajouter plus d\'exemples dans le prompt');
    console.log('   3. Augmenter la temperature pour plus de créativité');
    console.log();
  } else {
    console.log('🟢 EXCELLENTE QUALITÉ :');
    console.log('   1. Le système fonctionne correctement');
    console.log('   2. Les graphiques sont bien intégrés');
    console.log('   3. Continuer avec cette configuration');
    console.log();
  }

  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
