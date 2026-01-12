/**
 * Image Analysis with Vision APIs
 *
 * Analyzes pedagogical graphics (supply/demand curves, flowcharts, etc.)
 * and extracts structured metadata for interactive revision cards.
 *
 * Supports both OpenAI GPT-4o and Anthropic Claude Vision.
 */

import { openai } from './openai-vision';
import { anthropic, ANTHROPIC_VISION_MODELS } from './anthropic-vision';
import {
  withRetry,
  withCircuitBreaker,
  openaiVisionCircuitBreaker,
  llmLogger,
  LLM_CONFIG,
} from './llm';

/**
 * Types of pedagogical graphics (V2 - expanded types)
 */
export type GraphicType =
  // Economic graphs
  | 'supply_demand_curve'    // Supply/demand curves
  | 'equilibrium_graph'      // Market equilibrium diagrams
  | 'surplus_graph'          // Consumer/producer surplus
  | 'elasticity_graph'       // Elasticity illustrations
  | 'shift_graph'            // Supply/demand shifts
  // Charts and visualizations
  | 'histogram'              // Bar charts, histograms
  | 'pie_chart'              // Pie/donut charts
  | 'line_chart'             // Line graphs, time series
  | 'scatter_plot'           // Scatter plots
  // Diagrams
  | 'flow_diagram'           // Flowcharts, process diagrams
  | 'tree_diagram'           // Decision trees, hierarchies
  | 'venn_diagram'           // Venn diagrams, sets
  | 'table'                  // Tables, matrices
  | 'formula_visual'         // Mathematical formulas with visualization
  | 'concept_map'            // Concept maps, mind maps
  | 'timeline'               // Timelines, chronologies
  // Legacy types (backward compatibility)
  | 'courbe_offre_demande'   // Legacy: supply/demand
  | 'diagramme_flux'         // Legacy: flowchart
  | 'organigramme'           // Legacy: org chart
  | 'tableau'                // Legacy: table
  | 'autre';                 // Other

/**
 * Complete analysis result for a graphic (V2 - simplified for prompts)
 */
export interface GraphicAnalysis {
  type: GraphicType;
  confidence: number;              // 0.0-1.0
  description: string;             // Complete description (2-4 sentences)
  elements: string[];              // List of key visual elements to observe
  textContent?: string[];          // All visible text (labels, axes, annotations)
  suggestions?: string[];          // 2-4 pedagogical suggestions
  relatedConcepts?: string[];      // Related academic concepts
}

/**
 * Analysis prompt for Claude Vision (V2)
 */
const GRAPHIC_ANALYSIS_PROMPT = `Tu es un expert en analyse de documents pédagogiques et de visualisations de données.

═══════════════════════════════════════════════════════════════════════════════
                              MISSION
═══════════════════════════════════════════════════════════════════════════════

Analyse ce graphique/schéma pédagogique extrait d'un cours universitaire.
Ton analyse sera utilisée pour aider un autre modèle à intégrer ce graphique dans une fiche de révision.

═══════════════════════════════════════════════════════════════════════════════
                         FORMAT DE RÉPONSE (JSON)
═══════════════════════════════════════════════════════════════════════════════

Retourne UNIQUEMENT un objet JSON valide avec cette structure :

{
  "type": "[TYPE]",
  "confidence": [0.0-1.0],
  "description": "[DESCRIPTION]",
  "elements": ["[ELEMENT_1]", "[ELEMENT_2]", ...],
  "textContent": ["[TEXTE_1]", "[TEXTE_2]", ...],
  "suggestions": ["[SUGGESTION_1]", "[SUGGESTION_2]", ...],
  "relatedConcepts": ["[CONCEPT_1]", "[CONCEPT_2]", ...]
}

═══════════════════════════════════════════════════════════════════════════════
                         INSTRUCTIONS PAR CHAMP
═══════════════════════════════════════════════════════════════════════════════

### type (string)
Catégorise le graphique. Valeurs possibles :
- "supply_demand_curve" : Courbes offre/demande
- "equilibrium_graph" : Graphique d'équilibre de marché
- "surplus_graph" : Graphique montrant surplus consommateur/producteur
- "elasticity_graph" : Graphique illustrant l'élasticité
- "shift_graph" : Graphique de déplacement de courbes (chocs)
- "histogram" : Histogramme / diagramme en barres
- "pie_chart" : Diagramme circulaire
- "line_chart" : Graphique en lignes (évolution temporelle)
- "scatter_plot" : Nuage de points
- "flow_diagram" : Diagramme de flux / processus
- "tree_diagram" : Arbre de décision / organigramme
- "venn_diagram" : Diagramme de Venn
- "table" : Tableau de données
- "formula_visual" : Formule mathématique illustrée
- "concept_map" : Carte conceptuelle
- "timeline" : Frise chronologique
- "other" : Autre type

### confidence (number)
Ta confiance dans l'analyse, de 0.0 à 1.0.
- 0.9-1.0 : Très sûr, graphique clair et standard
- 0.7-0.9 : Assez sûr, quelques ambiguïtés mineures
- 0.5-0.7 : Moyennement sûr, qualité d'image moyenne ou graphique complexe
- < 0.5 : Peu sûr, image floue ou graphique inhabituel

### description (string)
Description complète du graphique en 2-4 phrases.
- Que représente-t-il globalement ?
- Quelles sont les variables/axes ?
- Quel est le message principal ?

### elements (array of strings)
Liste TOUS les éléments visuels importants que l'étudiant doit observer.
Sois SPÉCIFIQUE et CONCRET. Exemples :
- "Courbe de demande décroissante (bleue) de (0,15) à (8,7)"
- "Point d'équilibre E* à l'intersection (Q*=4, P*=10)"
- "Zone colorée en vert représentant le surplus du consommateur"
- "Axe horizontal : Quantité (Q) de 0 à 10"
- "Axe vertical : Prix (P) de 0 à 20"
- "Flèche indiquant le déplacement de D vers D'"
- "Légende : bleu = demande, rouge = offre"

### textContent (array of strings)
Retranscris TOUS les textes visibles sur le graphique :
- Labels des axes
- Titres et sous-titres
- Annotations
- Valeurs numériques
- Légendes
- Noms des courbes/zones

### suggestions (array of strings)
2-4 suggestions pédagogiques pour exploiter ce graphique :
- Quel concept illustre-t-il le mieux ?
- Quelle question poser à l'étudiant ?
- Quel exercice pourrait l'accompagner ?
- Quel lien avec d'autres concepts du cours ?

### relatedConcepts (array of strings)
Concepts économiques/théoriques liés à ce graphique.
Exemples : "loi de l'offre et de la demande", "élasticité-prix", "surplus collectif", "équilibre de marché"

═══════════════════════════════════════════════════════════════════════════════
                              EXEMPLES
═══════════════════════════════════════════════════════════════════════════════

**Exemple 1 : Graphique offre/demande simple**
{
  "type": "supply_demand_curve",
  "confidence": 0.95,
  "description": "Graphique représentant l'équilibre d'un marché idéal-typique avec une courbe de demande décroissante et une courbe d'offre croissante. Le point d'intersection détermine le prix et la quantité d'équilibre.",
  "elements": [
    "Courbe de demande décroissante (bleue) partant de P=15 pour Q=0",
    "Courbe d'offre croissante (rouge) partant de P=5 pour Q=0",
    "Point d'équilibre E* marqué à l'intersection (Q*=4, P*=10)",
    "Axe horizontal labellisé 'Quantité (Q)'",
    "Axe vertical labellisé 'Prix (P)'",
    "Lignes pointillées reliant E* aux axes"
  ],
  "textContent": [
    "Prix (P)",
    "Quantité (Q)",
    "Offre",
    "Demande",
    "E*",
    "P* = 10",
    "Q* = 4"
  ],
  "suggestions": [
    "Demander à l'étudiant d'identifier les coordonnées du point d'équilibre",
    "Faire tracer l'effet d'un choc de demande positif",
    "Calculer le surplus du consommateur à partir des aires",
    "Comparer avec un cas d'élasticité différente"
  ],
  "relatedConcepts": [
    "équilibre de marché",
    "loi de l'offre et de la demande",
    "prix d'équilibre",
    "quantité d'équilibre"
  ]
}

**Exemple 2 : Histogramme DMP**
{
  "type": "histogram",
  "confidence": 0.88,
  "description": "Histogramme en escalier montrant la disposition marginale à payer (DMP) de 4 consommateurs pour des unités successives d'un bien. Chaque couleur représente un consommateur différent.",
  "elements": [
    "Barre violette (Zyad) : DMP = 15€ pour unité 1, 13€ pour unité 2",
    "Barre verte (Irène) : DMP = 12€ pour unité 1, 10€ pour unité 2",
    "Barre rouge (Pamela) : DMP = 9€",
    "Barre orange (Marcel) : DMP = 8€",
    "Axe horizontal : unités achetées (1 à 6)",
    "Axe vertical : disposition marginale à payer (€)",
    "Barres ordonnées par DMP décroissante"
  ],
  "textContent": [
    "Disposition marginale à payer (€)",
    "Unités",
    "Z1 = 15",
    "Z2 = 13",
    "I1 = 12",
    "I2 = 10",
    "P1 = 9",
    "M1 = 8"
  ],
  "suggestions": [
    "Expliquer pourquoi la DMP décroît pour chaque consommateur",
    "Faire calculer le surplus de chaque consommateur à un prix donné",
    "Montrer comment ce graphique se transforme en courbe de demande",
    "Identifier qui achète à quel prix"
  ],
  "relatedConcepts": [
    "disposition marginale à payer",
    "utilité marginale décroissante",
    "surplus du consommateur",
    "courbe de demande agrégée"
  ]
}

═══════════════════════════════════════════════════════════════════════════════

Analyse maintenant le graphique fourni et retourne UNIQUEMENT le JSON, sans texte avant ou après.`;

/**
 * Analyze a pedagogical graphic with Claude Vision
 *
 * @param imageDataUrl - Base64 data URL of the image
 * @returns Structured analysis with classification and extracted elements
 */
export async function analyzeGraphicWithClaude(
  imageDataUrl: string
): Promise<GraphicAnalysis | null> {
  const logContext = llmLogger.createContext('analyzeGraphicWithClaude', LLM_CONFIG.models.vision);
  console.log('🔍 Analyzing graphic with Claude Vision...');

  try {
    const response = await withCircuitBreaker(
      openaiVisionCircuitBreaker,
      () => withRetry(
        async () => {
          const result = await openai.chat.completions.create({
            model: LLM_CONFIG.models.vision,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: GRAPHIC_ANALYSIS_PROMPT,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageDataUrl,
                      detail: 'high', // High detail for accurate coordinate extraction
                    },
                  },
                ],
              },
            ],
            temperature: 0.0, // Deterministic output for JSON
            max_tokens: 2048,
          });
          return result;
        },
        { maxRetries: 2 }
      ),
      async () => {
        logContext.setFallbackUsed();
        return null;
      }
    );

    if (!response) {
      console.log('⚠️ Circuit breaker open for vision, skipping analysis');
      logContext.setFallbackUsed().success();
      return null;
    }

    const content = response.choices[0].message.content || '';

    if (response.usage) {
      logContext.setTokens(response.usage);
    }

    // Parse JSON response
    try {
      // Extract JSON from response (in case Claude adds markdown formatting)
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      const analysis: GraphicAnalysis = JSON.parse(jsonStr);

      console.log(`✅ Graphic analyzed: ${analysis.type} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`);
      console.log(`   - ${analysis.elements?.length || 0} elements extracted`);
      console.log(`   - ${analysis.textContent?.length || 0} text items extracted`);
      logContext.success();

      return analysis;
    } catch (parseError: any) {
      console.error('❌ Failed to parse Claude response as JSON:', parseError.message);
      console.error('   Raw response:', content.substring(0, 500));
      logContext.failure(parseError, 0);
      return null;
    }

  } catch (error: any) {
    console.error('❌ Error in graphic analysis:', error.message);
    console.error('   Error details:', {
      status: error?.status,
      code: error?.code,
      type: error?.type,
      stack: error?.stack?.split('\n')[0]
    });
    logContext.failure(error, error?.status);
    return null;
  }
}

/**
 * Analyze a pedagogical graphic with Anthropic Claude Vision
 *
 * @param imageDataUrl - Base64 data URL of the image
 * @param model - Claude model to use ('sonnet' or 'haiku')
 * @returns Structured analysis with classification and extracted elements
 */
export async function analyzeGraphicWithAnthropicVision(
  imageDataUrl: string,
  model: keyof typeof ANTHROPIC_VISION_MODELS = 'haiku'
): Promise<GraphicAnalysis | null> {
  const modelId = ANTHROPIC_VISION_MODELS[model];
  const logContext = llmLogger.createContext('analyzeGraphicWithAnthropicVision', modelId);
  console.log(`🔍 Analyzing graphic with Claude Vision (${model})...`);

  try {
    // Extract base64 data and media type from data URL
    const [header, base64Data] = imageDataUrl.split(',');
    const mediaTypeMatch = header.match(/data:(.*?);/);
    const mediaType = (mediaTypeMatch?.[1] || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const response = await withRetry(
      async () => {
        const result = await anthropic.messages.create({
          model: modelId,
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: GRAPHIC_ANALYSIS_PROMPT,
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              },
            ],
          }],
        });
        return result;
      },
      { maxRetries: 2 }
    );

    if (!response) {
      console.log('⚠️ Claude Vision request failed');
      logContext.setFallbackUsed().success();
      return null;
    }

    // Extract text content from response
    const textBlock = response.content.find(block => block.type === 'text');
    const content = textBlock?.type === 'text' ? textBlock.text : '';

    if (response.usage) {
      logContext.setTokens({
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      });
    }

    // Parse JSON response
    try {
      // Extract JSON from response (in case Claude adds markdown formatting)
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      const analysis: GraphicAnalysis = JSON.parse(jsonStr);

      console.log(`✅ Graphic analyzed (Claude ${model}): ${analysis.type} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`);
      console.log(`   - ${analysis.elements?.length || 0} elements extracted`);
      console.log(`   - ${analysis.textContent?.length || 0} text items extracted`);
      logContext.success();

      return analysis;
    } catch (parseError: any) {
      console.error('❌ Failed to parse Claude response as JSON:', parseError.message);
      console.error('   Raw response:', content.substring(0, 500));
      logContext.failure(parseError, 0);
      return null;
    }

  } catch (error: any) {
    console.error('❌ Error in Claude Vision analysis:', error.message);
    console.error('   Error details:', {
      status: error?.status,
      code: error?.code,
      type: error?.type,
    });
    logContext.failure(error, error?.status);
    return null;
  }
}

/**
 * Analyze a graphic using the configured vision provider
 *
 * Routes to either OpenAI GPT-4o or Anthropic Claude based on config
 *
 * @param imageDataUrl - Base64 data URL of the image
 * @returns Structured analysis with classification and extracted elements
 */
export async function analyzeGraphic(
  imageDataUrl: string
): Promise<GraphicAnalysis | null> {
  const provider = LLM_CONFIG.models.visionProvider || 'openai';

  if (provider === 'anthropic') {
    return analyzeGraphicWithAnthropicVision(imageDataUrl, 'haiku');
  }

  // Default to OpenAI (existing behavior)
  return analyzeGraphicWithClaude(imageDataUrl);
}

/**
 * Batch analyze multiple graphics
 *
 * @param images - Array of { pageNum, imageId, base64Data }
 * @returns Map of imageId -> GraphicAnalysis
 */
export async function analyzeGraphicsBatch(
  images: Array<{ pageNum: number; imageId: string; base64Data: string }>
): Promise<Map<string, GraphicAnalysis>> {
  console.log(`\n🔍 Starting batch analysis of ${images.length} graphics...\n`);

  const results = new Map<string, GraphicAnalysis>();

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    console.log(`[${i + 1}/${images.length}] Analyzing ${img.imageId} (page ${img.pageNum})...`);

    const analysis = await analyzeGraphicWithClaude(img.base64Data);

    if (analysis) {
      results.set(img.imageId, analysis);
      console.log(`   ✅ ${analysis.type} (${analysis.elements.length} elements)\n`);
    } else {
      console.log(`   ⚠️ Analysis failed or skipped\n`);
    }

    // Small delay to avoid rate limiting
    if (i < images.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`✅ Batch analysis complete: ${results.size}/${images.length} graphics analyzed`);
  return results;
}
