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
 * Types of pedagogical graphics (V3 - universal for all subjects)
 */
export type GraphicType =
  // Universal diagrams
  | 'flow_diagram'           // Flowcharts, process diagrams, algorithms
  | 'concept_map'            // Concept maps, mind maps
  | 'tree_diagram'           // Decision trees, hierarchies, taxonomies
  | 'venn_diagram'           // Venn diagrams, set relationships
  | 'timeline'               // Timelines, chronologies, historical sequences
  | 'cycle_diagram'          // Cycles (water, life, business, etc.)
  | 'comparison_chart'       // Side-by-side comparisons
  | 'organizational_chart'   // Org charts, hierarchical structures
  // Charts and data visualizations
  | 'histogram'              // Bar charts, histograms
  | 'pie_chart'              // Pie/donut charts
  | 'line_chart'             // Line graphs, time series, trends
  | 'scatter_plot'           // Scatter plots, correlation diagrams
  | 'table'                  // Data tables, matrices
  // Mathematics and formulas
  | 'formula_visual'         // Mathematical formulas with visualization
  | 'geometric_diagram'      // Geometric shapes, proofs
  | 'function_graph'         // Mathematical function graphs (f(x), derivatives)
  // Sciences
  | 'circuit_diagram'        // Electrical/electronic circuits
  | 'chemical_structure'     // Chemical formulas, molecular structures
  | 'molecular_diagram'      // 3D molecular representations
  | 'anatomical_diagram'     // Human/animal anatomy
  | 'biological_diagram'     // Cells, organisms, ecosystems
  | 'physics_diagram'        // Forces, motion, optics, waves
  // Economics
  | 'supply_demand_curve'    // Supply/demand curves
  | 'equilibrium_graph'      // Market equilibrium diagrams
  | 'surplus_graph'          // Consumer/producer surplus
  | 'elasticity_graph'       // Elasticity illustrations
  | 'shift_graph'            // Supply/demand shifts
  // Geography and history
  | 'map'                    // Maps (geographic, political, historical)
  | 'geographic_map'         // Physical geography maps
  | 'historical_map'         // Historical event maps
  // Legacy types (backward compatibility)
  | 'courbe_offre_demande'   // Legacy: supply/demand
  | 'diagramme_flux'         // Legacy: flowchart
  | 'organigramme'           // Legacy: org chart
  | 'tableau'                // Legacy: table
  | 'autre'                  // Legacy: other
  | 'other';                 // Other

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
 * Generate analysis prompt for Claude Vision (V5 - with language support)
 * Ensures descriptions are generated in the specified target language
 */
function getGraphicAnalysisPrompt(targetLanguage: string = 'English'): string {
  return `Analyze this educational graphic. Return JSON only.

⚠️ CRITICAL: If the graphic is EMPTY (just axes/grid with NO data/curves/content), return:
{"type":"other","confidence":0.0,"description":"Empty graphic - only axes/grid without data","elements":[],"textContent":[],"suggestions":[],"relatedConcepts":[]}

JSON FORMAT:
{
  "type": "TYPE",
  "confidence": 0.0-1.0,
  "description": "2-3 sentences describing what this graphic shows",
  "elements": ["specific visual element 1", "element 2", ...],
  "textContent": ["all visible text", "labels", "values"],
  "suggestions": ["pedagogical use 1", "use 2"],
  "relatedConcepts": ["concept 1", "concept 2"]
}

⚠️ CRITICAL LANGUAGE RULE:
- The "description" field MUST be written in ${targetLanguage}
- The "suggestions" field MUST be written in ${targetLanguage}
- The "relatedConcepts" field MUST be written in ${targetLanguage}
- Keep "textContent" in original language (copy exactly as seen on the graphic)

TYPES (pick one):
- flow_diagram, concept_map, tree_diagram, venn_diagram, timeline, cycle_diagram
- histogram, pie_chart, line_chart, scatter_plot, table
- function_graph, geometric_diagram, formula_visual
- circuit_diagram, chemical_structure, biological_diagram, anatomical_diagram, physics_diagram
- supply_demand_curve, equilibrium_graph, map, other

CONFIDENCE:
- 0.0 = empty/incomplete (NO actual data drawn)
- 0.3-0.5 = blurry/partial
- 0.6-0.8 = good with minor issues
- 0.9-1.0 = excellent/clear

Return ONLY valid JSON.`;
}

/**
 * Analyze a pedagogical graphic with Claude Vision
 *
 * @param imageDataUrl - Base64 data URL of the image
 * @param targetLanguage - Language for descriptions (default: 'English')
 * @returns Structured analysis with classification and extracted elements
 */
export async function analyzeGraphicWithClaude(
  imageDataUrl: string,
  targetLanguage: string = 'English'
): Promise<GraphicAnalysis | null> {
  const logContext = llmLogger.createContext('analyzeGraphicWithClaude', LLM_CONFIG.models.vision);
  console.log(`🔍 Analyzing graphic with Claude Vision (language: ${targetLanguage})...`);

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
                    text: getGraphicAnalysisPrompt(targetLanguage),
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageDataUrl,
                      detail: 'low', // Low detail for faster processing (still accurate for graphs)
                    },
                  },
                ],
              },
            ],
            temperature: 0.0, // Deterministic output for JSON
            max_tokens: 800, // Reduced from 2048 - JSON response is ~300-500 tokens
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
 * @param targetLanguage - Language for descriptions (default: 'English')
 * @returns Structured analysis with classification and extracted elements
 */
export async function analyzeGraphicWithAnthropicVision(
  imageDataUrl: string,
  model: keyof typeof ANTHROPIC_VISION_MODELS = 'haiku',
  targetLanguage: string = 'English'
): Promise<GraphicAnalysis | null> {
  const modelId = ANTHROPIC_VISION_MODELS[model];
  const logContext = llmLogger.createContext('analyzeGraphicWithAnthropicVision', modelId);
  console.log(`🔍 Analyzing graphic with Claude Vision (${model}, language: ${targetLanguage})...`);

  try {
    // Extract base64 data and media type from data URL
    const [header, base64Data] = imageDataUrl.split(',');
    const mediaTypeMatch = header.match(/data:(.*?);/);
    const mediaType = (mediaTypeMatch?.[1] || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const response = await withRetry(
      async () => {
        const result = await anthropic.messages.create({
          model: modelId,
          max_tokens: 800, // Reduced from 2048 - JSON response is ~300-500 tokens
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: getGraphicAnalysisPrompt(targetLanguage),
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
 * @param targetLanguage - Language for descriptions (default: 'English')
 * @returns Structured analysis with classification and extracted elements
 */
export async function analyzeGraphic(
  imageDataUrl: string,
  targetLanguage: string = 'English'
): Promise<GraphicAnalysis | null> {
  const provider = LLM_CONFIG.models.visionProvider || 'openai';

  if (provider === 'anthropic') {
    return analyzeGraphicWithAnthropicVision(imageDataUrl, 'haiku', targetLanguage);
  }

  // Default to OpenAI (existing behavior)
  return analyzeGraphicWithClaude(imageDataUrl, targetLanguage);
}

/**
 * Batch analyze multiple graphics with parallel processing
 *
 * Uses the configured vision provider (OpenAI or Anthropic) and processes
 * images in parallel batches for faster throughput.
 *
 * @param images - Array of { pageNum, imageId, base64Data }
 * @param concurrency - Number of parallel requests (default: 20 for max speed with Haiku)
 * @param targetLanguage - Language for descriptions (default: 'English')
 * @returns Map of imageId -> GraphicAnalysis
 */
export async function analyzeGraphicsBatch(
  images: Array<{ pageNum: number; imageId: string; base64Data: string }>,
  concurrency: number = 20,
  targetLanguage: string = 'English'
): Promise<Map<string, GraphicAnalysis>> {
  const provider = LLM_CONFIG.models.visionProvider || 'openai';
  console.log(`\n🔍 Starting batch analysis of ${images.length} graphics (concurrency: ${concurrency}, provider: ${provider}, language: ${targetLanguage})...\n`);

  const results = new Map<string, GraphicAnalysis>();

  // Process in parallel batches
  for (let i = 0; i < images.length; i += concurrency) {
    const batch = images.slice(i, i + concurrency);
    const batchNum = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(images.length / concurrency);

    console.log(`[Batch ${batchNum}/${totalBatches}] Processing ${batch.length} graphics in parallel...`);

    const batchPromises = batch.map(async (img, batchIndex) => {
      const globalIndex = i + batchIndex + 1;
      console.log(`  [${globalIndex}/${images.length}] Analyzing ${img.imageId} (page ${img.pageNum})...`);

      // Use the configured vision provider (respects LLM_CONFIG.models.visionProvider)
      const analysis = await analyzeGraphic(img.base64Data, targetLanguage);

      if (analysis) {
        // Reject graphics with very low confidence (empty/incomplete)
        if (analysis.confidence < 0.3) {
          console.log(`  [${globalIndex}/${images.length}] ❌ REJECTED: Low confidence ${(analysis.confidence * 100).toFixed(0)}% - "${analysis.description?.substring(0, 50)}..."`);
          return { imageId: img.imageId, analysis: null };
        }

        // Reject graphics with empty elements array (no actual content detected)
        if (!analysis.elements || analysis.elements.length === 0) {
          console.log(`  [${globalIndex}/${images.length}] ❌ REJECTED: No elements detected - likely empty graphic`);
          return { imageId: img.imageId, analysis: null };
        }

        console.log(`  [${globalIndex}/${images.length}] ✅ ${analysis.type} (${analysis.confidence * 100}% conf, ${analysis.elements.length} elements)`);
        return { imageId: img.imageId, analysis };
      } else {
        console.log(`  [${globalIndex}/${images.length}] ⚠️ Analysis failed or skipped`);
        return { imageId: img.imageId, analysis: null };
      }
    });

    // Wait for all in batch to complete
    const batchResults = await Promise.all(batchPromises);

    // Store results
    for (const { imageId, analysis } of batchResults) {
      if (analysis) {
        results.set(imageId, analysis);
      }
    }

    // Minimal delay between batches (Haiku has high rate limits)
    if (i + concurrency < images.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\n✅ Batch analysis complete: ${results.size}/${images.length} graphics analyzed`);
  return results;
}
