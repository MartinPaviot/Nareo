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
 * Analysis prompt for Claude Vision (V2)
 */
const GRAPHIC_ANALYSIS_PROMPT = `You are an expert in analyzing educational documents and data visualizations across ALL academic subjects.

═══════════════════════════════════════════════════════════════════════════════
                              MISSION
═══════════════════════════════════════════════════════════════════════════════

Analyze this pedagogical graphic/diagram extracted from a university course.
Your analysis will help another model integrate this graphic into a revision sheet.

IMPORTANT: This graphic could be from ANY subject (economics, physics, chemistry, biology, history, mathematics, computer science, medicine, law, etc.). Analyze it based on what you see.

═══════════════════════════════════════════════════════════════════════════════
                         RESPONSE FORMAT (JSON)
═══════════════════════════════════════════════════════════════════════════════

Return ONLY a valid JSON object with this structure:

{
  "type": "[TYPE]",
  "confidence": [0.0-1.0],
  "description": "[DESCRIPTION]",
  "elements": ["[ELEMENT_1]", "[ELEMENT_2]", ...],
  "textContent": ["[TEXT_1]", "[TEXT_2]", ...],
  "suggestions": ["[SUGGESTION_1]", "[SUGGESTION_2]", ...],
  "relatedConcepts": ["[CONCEPT_1]", "[CONCEPT_2]", ...]
}

═══════════════════════════════════════════════════════════════════════════════
                         FIELD INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════════════

### type (string)
Categorize the graphic. Possible values:

UNIVERSAL DIAGRAMS:
- "flow_diagram" : Flowcharts, process diagrams, algorithms
- "concept_map" : Concept maps, mind maps
- "tree_diagram" : Decision trees, hierarchies, taxonomies, family trees
- "venn_diagram" : Venn diagrams, set relationships
- "timeline" : Timelines, chronologies, historical sequences
- "cycle_diagram" : Cycles (water cycle, life cycle, business cycle)
- "comparison_chart" : Side-by-side comparisons
- "organizational_chart" : Org charts, hierarchical structures

CHARTS & DATA:
- "histogram" : Histograms, bar charts
- "pie_chart" : Pie charts, donut charts
- "line_chart" : Line graphs, time series, trends
- "scatter_plot" : Scatter plots, correlation diagrams
- "table" : Data tables, matrices

MATHEMATICS & FORMULAS:
- "formula_visual" : Mathematical formulas with visualization
- "geometric_diagram" : Geometric shapes, proofs
- "function_graph" : Mathematical function graphs (f(x), derivatives)

SCIENCES:
- "circuit_diagram" : Electrical/electronic circuits
- "chemical_structure" : Chemical formulas, molecular structures
- "molecular_diagram" : 3D molecular representations
- "anatomical_diagram" : Human/animal anatomy
- "biological_diagram" : Cells, organisms, ecosystems
- "physics_diagram" : Forces, motion, optics, waves

ECONOMICS:
- "supply_demand_curve" : Supply/demand curves
- "equilibrium_graph" : Market equilibrium diagrams
- "surplus_graph" : Consumer/producer surplus
- "elasticity_graph" : Elasticity illustrations
- "shift_graph" : Supply/demand shifts

GEOGRAPHY & HISTORY:
- "map" : Maps (geographic, political, historical)
- "geographic_map" : Physical geography maps
- "historical_map" : Historical event maps

OTHER:
- "other" : Any other type of diagram

### confidence (number)
Your confidence in the analysis, from 0.0 to 1.0.
- 0.9-1.0 : Very confident, clear and standard graphic
- 0.7-0.9 : Fairly confident, minor ambiguities
- 0.5-0.7 : Moderately confident, average image quality or complex graphic
- < 0.5 : Low confidence, blurry image or unusual graphic

### description (string)
Complete description of the graphic in 2-4 sentences.
- What does it represent overall?
- What are the variables/axes/components?
- What is the main message or concept illustrated?

IMPORTANT: Write the description in the SAME LANGUAGE as the text visible in the graphic.

### elements (array of strings)
List ALL important visual elements that a student should observe.
Be SPECIFIC and CONCRETE. Examples across subjects:
- Physics: "Force vector F pointing downward at angle 30°"
- Chemistry: "Carbon atom bonded to 4 hydrogen atoms in tetrahedral structure"
- Biology: "Cell membrane shown as double phospholipid layer"
- Math: "Parabola y=x² with vertex at origin (0,0)"
- Economics: "Demand curve sloping downward from (0,15) to (8,7)"
- History: "Timeline showing events from 1914 to 1918"

### textContent (array of strings)
Transcribe ALL visible text on the graphic:
- Axis labels
- Titles and subtitles
- Annotations
- Numerical values
- Legends
- Names of curves/zones/regions

### suggestions (array of strings)
2-4 pedagogical suggestions for using this graphic:
- What concept does it best illustrate?
- What question could you ask a student?
- What exercise could accompany it?
- What connection to other course concepts?

### relatedConcepts (array of strings)
Theoretical concepts related to this graphic (from the relevant subject).
Examples by subject:
- Economics: "supply and demand", "market equilibrium"
- Physics: "Newton's laws", "conservation of energy"
- Chemistry: "covalent bonding", "molecular geometry"
- Biology: "cellular respiration", "DNA replication"
- Math: "quadratic functions", "derivatives"

═══════════════════════════════════════════════════════════════════════════════
                              EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

**Example 1: Physics - Force Diagram**
{
  "type": "physics_diagram",
  "confidence": 0.92,
  "description": "Free body diagram showing forces acting on an object on an inclined plane. The weight force is decomposed into components parallel and perpendicular to the surface.",
  "elements": [
    "Rectangular block on inclined plane at 30° angle",
    "Weight vector W pointing straight down (mg = 50N)",
    "Normal force N perpendicular to surface (43.3N)",
    "Parallel component W∥ along the slope (25N)",
    "Friction force f opposing motion direction",
    "Angle θ = 30° marked at base"
  ],
  "textContent": [
    "W = mg = 50N",
    "N = W cos(θ)",
    "W∥ = W sin(θ)",
    "θ = 30°",
    "f = μN"
  ],
  "suggestions": [
    "Calculate the acceleration if friction coefficient is μ = 0.2",
    "Determine the minimum angle for the block to start sliding",
    "Compare with a horizontal surface scenario",
    "Explain why N ≠ W on an inclined plane"
  ],
  "relatedConcepts": [
    "Newton's second law",
    "force decomposition",
    "static friction",
    "inclined plane mechanics"
  ]
}

**Example 2: Biology - Cell Structure**
{
  "type": "biological_diagram",
  "confidence": 0.89,
  "description": "Cross-section of an animal cell showing major organelles. Each structure is labeled with its function in cellular metabolism.",
  "elements": [
    "Cell membrane (outer boundary, phospholipid bilayer)",
    "Nucleus with nucleolus visible inside",
    "Mitochondria (oval shapes with inner folds)",
    "Endoplasmic reticulum (rough and smooth)",
    "Golgi apparatus (stacked membranes)",
    "Ribosomes (small dots on rough ER)",
    "Cytoplasm filling the cell"
  ],
  "textContent": [
    "Nucleus",
    "Mitochondria",
    "Rough ER",
    "Smooth ER",
    "Golgi apparatus",
    "Cell membrane",
    "Ribosomes",
    "Cytoplasm"
  ],
  "suggestions": [
    "Trace the path of a protein from synthesis to secretion",
    "Explain why mitochondria are called 'powerhouses'",
    "Compare with a plant cell structure",
    "Identify which organelles have their own DNA"
  ],
  "relatedConcepts": [
    "cell biology",
    "organelle function",
    "protein synthesis",
    "cellular respiration",
    "membrane transport"
  ]
}

**Example 3: Chemistry - Molecular Structure**
{
  "type": "chemical_structure",
  "confidence": 0.94,
  "description": "3D representation of a methane molecule (CH4) showing tetrahedral geometry with bond angles of 109.5°.",
  "elements": [
    "Central carbon atom (black sphere)",
    "Four hydrogen atoms (white spheres)",
    "Four C-H bonds of equal length",
    "Tetrahedral arrangement",
    "109.5° bond angle indicated"
  ],
  "textContent": [
    "CH₄",
    "C",
    "H",
    "109.5°",
    "Tetrahedral"
  ],
  "suggestions": [
    "Explain sp3 hybridization in this molecule",
    "Compare with ammonia (NH3) geometry",
    "Predict polarity based on symmetry",
    "Draw the Lewis structure"
  ],
  "relatedConcepts": [
    "VSEPR theory",
    "molecular geometry",
    "covalent bonding",
    "hybridization",
    "bond angles"
  ]
}

**Example 4: Mathematics - Function Graph**
{
  "type": "function_graph",
  "confidence": 0.91,
  "description": "Graph of a quadratic function f(x) = x² - 4x + 3 showing the parabola, vertex, roots, and axis of symmetry.",
  "elements": [
    "Parabola opening upward",
    "Vertex at point (2, -1)",
    "X-intercepts at x = 1 and x = 3",
    "Y-intercept at y = 3",
    "Axis of symmetry x = 2 (dashed line)",
    "Coordinate grid with labeled axes"
  ],
  "textContent": [
    "f(x) = x² - 4x + 3",
    "Vertex (2, -1)",
    "x = 1",
    "x = 3",
    "y = 3",
    "x = 2"
  ],
  "suggestions": [
    "Find the roots using the quadratic formula",
    "Determine the domain and range",
    "Calculate the derivative to verify the vertex",
    "Transform to vertex form f(x) = (x-2)² - 1"
  ],
  "relatedConcepts": [
    "quadratic functions",
    "parabola properties",
    "roots and zeros",
    "vertex form",
    "axis of symmetry"
  ]
}

**Example 5: History - Timeline**
{
  "type": "timeline",
  "confidence": 0.87,
  "description": "Timeline of major events during World War I (1914-1918), showing key battles and political turning points.",
  "elements": [
    "Horizontal timeline from 1914 to 1918",
    "Assassination of Archduke Franz Ferdinand (June 1914)",
    "Battle of the Marne (September 1914)",
    "Battle of Verdun (1916)",
    "US entry into war (April 1917)",
    "Armistice (November 11, 1918)"
  ],
  "textContent": [
    "1914",
    "1915",
    "1916",
    "1917",
    "1918",
    "Assassination of Franz Ferdinand",
    "Battle of the Marne",
    "Battle of Verdun",
    "US enters war",
    "Armistice"
  ],
  "suggestions": [
    "Analyze the turning points that changed the war's direction",
    "Explain why US entry was significant",
    "Compare the Western and Eastern fronts",
    "Discuss the impact on civilian populations"
  ],
  "relatedConcepts": [
    "World War I",
    "trench warfare",
    "alliances",
    "total war",
    "Treaty of Versailles"
  ]
}

═══════════════════════════════════════════════════════════════════════════════

Now analyze the provided graphic and return ONLY the JSON, no text before or after.`;

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
 * Batch analyze multiple graphics with parallel processing
 *
 * Uses the configured vision provider (OpenAI or Anthropic) and processes
 * images in parallel batches for faster throughput.
 *
 * @param images - Array of { pageNum, imageId, base64Data }
 * @param concurrency - Number of parallel requests (default: 10 for speed)
 * @returns Map of imageId -> GraphicAnalysis
 */
export async function analyzeGraphicsBatch(
  images: Array<{ pageNum: number; imageId: string; base64Data: string }>,
  concurrency: number = 10
): Promise<Map<string, GraphicAnalysis>> {
  const provider = LLM_CONFIG.models.visionProvider || 'openai';
  console.log(`\n🔍 Starting batch analysis of ${images.length} graphics (concurrency: ${concurrency}, provider: ${provider})...\n`);

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
      const analysis = await analyzeGraphic(img.base64Data);

      if (analysis) {
        console.log(`  [${globalIndex}/${images.length}] ✅ ${analysis.type} (${analysis.elements?.length || 0} elements)`);
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

    // Small delay between batches to avoid rate limiting (only if more batches remain)
    if (i + concurrency < images.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n✅ Batch analysis complete: ${results.size}/${images.length} graphics analyzed`);
  return results;
}
