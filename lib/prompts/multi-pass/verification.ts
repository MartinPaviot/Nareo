import { PersonnalisationConfig } from '@/types/personnalisation';

/**
 * Génère le prompt pour le Pass 4 (vérification de complétude)
 * Modèle : gpt-4o-mini
 * Temperature : 0.2
 * Max tokens : 3000
 */
export function getVerificationPrompt(
  config: PersonnalisationConfig,
  expectedContent: string,
  languageName: string
): string {
  return `Compare la transcription générée avec le contenu attendu.

CONTENU ATTENDU (de l'analyse structurelle) :
${expectedContent}

Pour chaque élément attendu, indique :
- ✅ PRÉSENT : l'élément est correctement transcrit
- ⚠️ PARTIEL : l'élément est présent mais incomplet (précise ce qui manque)
- ❌ ABSENT : l'élément n'a pas été transcrit

RAPPEL : Le mode choisi est "${config.niveau}".
- En mode SYNTHÉTIQUE : les éléments peuvent être condensés mais doivent être PRÉSENTS
- En mode STANDARD : tous les éléments doivent être complets
- En mode EXPLICATIF : tous les éléments doivent être complets ET développés

RETOURNE UN JSON VALIDE :
{
  "verification": [
    {"item": "nom de l'élément", "status": "PRÉSENT|PARTIEL|ABSENT", "details": "..."}
  ],
  "missing_content": "contenu Markdown à ajouter (vide si tout est présent)",
  "completeness_score": 85
}

Réponds en ${languageName}.`;
}

/**
 * Interface pour les graphiques attendus dans la vérification
 */
export interface ExpectedGraphic {
  id: string;
  description: string;
  type: string;
  pageNumber: number;
}

/**
 * Génère le prompt de vérification spécifique aux graphiques (V2)
 * Vérifie que tous les graphiques sont correctement intégrés
 */
export function getGraphicsVerificationPrompt(
  generatedContent: string,
  expectedGraphics: ExpectedGraphic[],
  languageName: string
): string {
  const expectedList = expectedGraphics
    .map((g, i) => `${i + 1}. [GRAPHIC-${g.id}] - ${g.description || g.type} (Page ${g.pageNumber})`)
    .join('\n');

  return `Tu es un vérificateur qualité pour fiches de révision.

═══════════════════════════════════════════════════════════════════════════════
                              MISSION
═══════════════════════════════════════════════════════════════════════════════

Vérifie que TOUS les graphiques requis sont correctement intégrés dans la fiche générée.

═══════════════════════════════════════════════════════════════════════════════
                         GRAPHIQUES ATTENDUS
═══════════════════════════════════════════════════════════════════════════════

${expectedGraphics.length} graphiques doivent être présents :

${expectedList}

═══════════════════════════════════════════════════════════════════════════════
                         FICHE À VÉRIFIER
═══════════════════════════════════════════════════════════════════════════════

${generatedContent.length > 20000 ? generatedContent.substring(0, 20000) + '\n...[tronqué pour vérification]' : generatedContent}

═══════════════════════════════════════════════════════════════════════════════
                         VÉRIFICATIONS À EFFECTUER
═══════════════════════════════════════════════════════════════════════════════

Pour CHAQUE graphique attendu, vérifie :

1. **PRÉSENCE** : Le placeholder ![GRAPHIC-{id}](#loading) ou l'URL finale est-il présent ?

2. **CONTEXTE AVANT** : Y a-t-il 2-3 phrases d'introduction AVANT le graphique ?
   - Mauvais : le graphique apparaît sans contexte
   - Bon : "Le concept X est illustré par le graphique suivant..."

3. **ANALYSE APRÈS** : Y a-t-il 3-5 phrases d'analyse APRÈS le graphique ?
   - Mauvais : rien après le graphique
   - Bon : "On observe sur ce graphique que... L'intersection représente..."

4. **PLACEMENT** : Le graphique est-il dans la bonne section thématique ?
   - Un graphique sur l'élasticité doit être dans la section élasticité

═══════════════════════════════════════════════════════════════════════════════
                         FORMAT DE RÉPONSE (JSON)
═══════════════════════════════════════════════════════════════════════════════

{
  "totalExpected": ${expectedGraphics.length},
  "totalFound": [nombre],
  "allPresent": [true/false],
  "details": [
    {
      "graphicId": "[id]",
      "found": [true/false],
      "hasIntroduction": [true/false],
      "hasAnalysis": [true/false],
      "correctSection": [true/false],
      "issues": ["problème 1", "problème 2"],
      "suggestedFix": "[correction suggérée]"
    }
  ],
  "overallScore": [0-100],
  "criticalIssues": ["issue grave 1"],
  "recommendations": ["recommandation 1"]
}

═══════════════════════════════════════════════════════════════════════════════

Langue : ${languageName}

Retourne UNIQUEMENT le JSON.`;
}
