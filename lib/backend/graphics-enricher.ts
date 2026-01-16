/**
 * Graphics Enricher - Inject graphics context into note generation
 *
 * Enriches the note generation prompt with information about available graphics
 * so Claude can intelligently place them in the revision sheet.
 */

import { getServiceSupabase } from '@/lib/supabase';

/**
 * Graphic summary for prompt injection
 */
export interface GraphicSummary {
  id: string;
  pageNumber: number;
  type: string;
  description: string;
  confidence: number;
  elements?: string[] | null;
  suggestions?: string[] | null;
  storagePath?: string; // Storage path for URL generation
}

/**
 * Graphic with resolved URL for direct use in markdown
 */
export interface GraphicWithUrl extends GraphicSummary {
  publicUrl: string;
}

// Adaptive limit on graphics per section
// Goal: Include most graphics but not overwhelm the LLM
const MIN_GRAPHICS_PER_SECTION = 2;
const MAX_GRAPHICS_PER_SECTION = 5;

/**
 * Calculate adaptive limit per section based on total graphics and sections
 * Goal: Include ~90% of graphics, distributed across sections
 */
function calculateAdaptiveLimit(totalGraphics: number, totalSections: number): number {
  if (totalSections === 0) return MAX_GRAPHICS_PER_SECTION;

  // Target: include ~90% of graphics (not 80%, to not miss important ones)
  const targetGraphics = Math.ceil(totalGraphics * 0.9);

  // Distribute across sections with 1.5x buffer for uneven distribution
  const perSection = Math.ceil((targetGraphics / totalSections) * 1.5);

  // Clamp between min and max
  return Math.max(MIN_GRAPHICS_PER_SECTION, Math.min(perSection, MAX_GRAPHICS_PER_SECTION));
}

// Graphic types that are typically MORE pedagogically valuable (universal across subjects)
// These show relationships, processes, or comparisons - not just static data
const HIGH_VALUE_GRAPHIC_PATTERNS = [
  // Relationship/process graphics (show HOW things work)
  'flow', 'cycle', 'process', 'diagram', 'schema', 'schéma',
  'relationship', 'relation', 'connection', 'lien',
  // Comparative graphics (show differences/similarities)
  'comparison', 'versus', 'vs', 'compare', 'comparaison',
  'before', 'after', 'avant', 'après',
  // Conceptual graphics (illustrate abstract ideas)
  'concept', 'model', 'modèle', 'framework', 'structure',
  'hierarchy', 'hiérarchie', 'tree', 'arbre',
  // Causal/analytical graphics
  'cause', 'effect', 'effet', 'impact', 'consequence',
  'equilibrium', 'équilibre', 'balance',
  // Visual explanations
  'illustrat', 'explain', 'expliqu', 'demonstrat', 'démontr', 'montr',
];

// Graphic types that are typically LESS pedagogically valuable
// Often redundant with text or decorative
const LOW_VALUE_GRAPHIC_PATTERNS = [
  // Simple data that's often in the text already
  'table', 'tableau', 'list', 'liste',
  // Decorative or contextual
  'photo', 'image', 'picture', 'logo', 'icon',
  'portrait', 'cover', 'couverture',
  // Too generic
  'example', 'exemple', 'sample', 'échantillon',
];

/**
 * Calculate pedagogical score for a graphic (GENERIC - works for any subject)
 *
 * Scoring philosophy:
 * - Graphics that EXPLAIN relationships/processes are most valuable
 * - Graphics with rich descriptions indicate the vision model found meaningful content
 * - Graphics with multiple elements show complexity worth visualizing
 * - Simple tables/lists are less valuable (often redundant with text)
 */
function calculatePedagogicalScore(graphic: GraphicSummary): number {
  let score = 0;
  const description = (graphic.description || '').toLowerCase();
  const type = (graphic.type || '').toLowerCase();

  // 1. BASE SCORE from confidence (0-5 points)
  // Confidence indicates clear, well-structured graphic
  score += graphic.confidence * 5;

  // 2. TYPE/DESCRIPTION ANALYSIS (0-5 points)
  // Check for high-value patterns in type or description
  const hasHighValuePattern = HIGH_VALUE_GRAPHIC_PATTERNS.some(
    pattern => type.includes(pattern) || description.includes(pattern)
  );
  const hasLowValuePattern = LOW_VALUE_GRAPHIC_PATTERNS.some(
    pattern => type.includes(pattern) || description.includes(pattern)
  );

  if (hasHighValuePattern && !hasLowValuePattern) {
    score += 5; // High value graphic
  } else if (hasHighValuePattern && hasLowValuePattern) {
    score += 2; // Mixed signals
  } else if (!hasLowValuePattern) {
    score += 3; // Neutral - give benefit of doubt
  }
  // Low value pattern only = no bonus

  // 3. COMPLEXITY INDICATORS (0-3 points)
  // Elements suggest the graphic has multiple components worth showing
  const elementsCount = graphic.elements?.length || 0;
  if (elementsCount >= 4) {
    score += 3; // Complex graphic with many elements
  } else if (elementsCount >= 2) {
    score += 2; // Moderate complexity
  } else if (elementsCount >= 1) {
    score += 1; // At least some structure
  }

  // 4. DESCRIPTION RICHNESS (0-2 points)
  // Longer descriptions indicate the vision model found meaningful content
  // But cap it - very long descriptions might indicate confusion
  const descLength = description.length;
  if (descLength >= 50 && descLength <= 200) {
    score += 2; // Good descriptive length
  } else if (descLength >= 30) {
    score += 1; // Acceptable
  }

  // 5. SUGGESTIONS PRESENT (0-1 point)
  // If the vision model suggested how to use this graphic, it's probably useful
  if (graphic.suggestions && graphic.suggestions.length > 0) {
    score += 1;
  }

  return score; // Max possible: ~16 points
}

// Priority graphic types that should have a lower confidence threshold
// These are pedagogically valuable across ALL subjects (V3 - universal)
const PRIORITY_GRAPHIC_TYPES = [
  // Universal diagrams (all subjects)
  'flow_diagram',           // Process flows, algorithms, workflows
  'concept_map',            // Concept maps, mind maps
  'tree_diagram',           // Decision trees, hierarchies, taxonomies
  'venn_diagram',           // Set relationships, comparisons
  'timeline',               // Historical events, processes over time
  'formula_visual',         // Mathematical formulas with visualization
  'cycle_diagram',          // Water cycle, life cycle, business cycle
  'comparison_chart',       // Side-by-side comparisons
  'organizational_chart',   // Org charts, hierarchical structures
  // Charts and data visualization
  'histogram',              // Statistical distributions
  'line_chart',             // Trends, time series
  'scatter_plot',           // Correlations, relationships
  'pie_chart',              // Proportions, percentages
  'table',                  // Data tables, matrices
  // Mathematics
  'geometric_diagram',      // Geometric shapes, proofs
  'function_graph',         // Mathematical function graphs (f(x))
  // Sciences
  'circuit_diagram',        // Physics, electronics
  'chemical_structure',     // Chemistry, biology
  'molecular_diagram',      // 3D molecular representations
  'anatomical_diagram',     // Biology, medicine
  'biological_diagram',     // Cells, organisms, ecosystems
  'physics_diagram',        // Forces, motion, optics, waves
  // Economics
  'supply_demand_curve',    // Supply/demand curves
  'equilibrium_graph',      // Market equilibrium
  'surplus_graph',          // Consumer/producer surplus
  'elasticity_graph',       // Elasticity illustrations
  'shift_graph',            // Supply/demand shifts
  // Geography and history
  'map',                    // General maps
  'geographic_map',         // Physical geography maps
  'historical_map',         // Historical event maps
  // Legacy types (backward compatibility)
  'courbe_offre_demande',
  'diagramme_flux',
  'organigramme',
  'tableau',
];

/**
 * Normalize a description for comparison (lowercase, remove punctuation, trim)
 */
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity between two descriptions (Jaccard index on words)
 */
function descriptionSimilarity(desc1: string, desc2: string): number {
  const words1 = new Set(normalizeDescription(desc1).split(' '));
  const words2 = new Set(normalizeDescription(desc2).split(' '));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Deduplicate graphics by type + description similarity
 * Keeps the one with highest confidence when duplicates are found
 */
function deduplicateGraphics(graphics: GraphicSummary[]): GraphicSummary[] {
  if (graphics.length <= 1) return graphics;

  const deduplicated: GraphicSummary[] = [];
  const used = new Set<number>();

  for (let i = 0; i < graphics.length; i++) {
    if (used.has(i)) continue;

    const current = graphics[i];
    let best = current;

    // Find all duplicates of this graphic
    for (let j = i + 1; j < graphics.length; j++) {
      if (used.has(j)) continue;

      const candidate = graphics[j];

      // Check if same type
      if (current.type !== candidate.type) continue;

      // Check description similarity (threshold: 70%)
      const similarity = descriptionSimilarity(current.description, candidate.description);

      if (similarity >= 0.7) {
        // Mark as duplicate
        used.add(j);

        // Keep the one with higher confidence
        if (candidate.confidence > best.confidence) {
          best = candidate;
        }
      }
    }

    deduplicated.push(best);
  }

  console.log(`[graphics-enricher] Deduplication: ${graphics.length} -> ${deduplicated.length} graphics`);
  return deduplicated;
}

/**
 * Fetch graphics summaries for a course
 *
 * @param courseId - Course UUID
 * @returns Array of deduplicated graphic summaries sorted by page number
 */
export async function getCourseGraphicsSummaries(
  courseId: string
): Promise<GraphicSummary[]> {
  const admin = getServiceSupabase();

  // First, fetch priority graphics with lower threshold (0.5)
  const { data: priorityGraphics, error: priorityError } = await admin
    .from('course_graphics')
    .select('id, page_number, graphic_type, description, confidence, elements, suggestions, storage_path')
    .eq('course_id', courseId)
    .not('graphic_type', 'is', null)
    .not('description', 'is', null)
    .in('graphic_type', PRIORITY_GRAPHIC_TYPES)
    .gte('confidence', 0.5)
    .order('page_number', { ascending: true });

  // Then fetch other graphics with standard threshold (0.7)
  // Filter out priority types using proper Supabase syntax
  const { data: otherGraphics, error: otherError } = await admin
    .from('course_graphics')
    .select('id, page_number, graphic_type, description, confidence, elements, suggestions, storage_path')
    .eq('course_id', courseId)
    .not('graphic_type', 'is', null)
    .not('description', 'is', null)
    .gte('confidence', 0.7)
    .order('page_number', { ascending: true });

  if ((priorityError && otherError) || (!priorityGraphics && !otherGraphics)) {
    console.warn('[graphics-enricher] Failed to fetch graphics:', priorityError?.message || otherError?.message);
    return [];
  }

  // Combine results, filtering out duplicates from otherGraphics that are already in priorityGraphics
  const priorityIds = new Set((priorityGraphics || []).map(g => g.id));
  const filteredOther = (otherGraphics || []).filter(g => !priorityIds.has(g.id));
  const allGraphics = [...(priorityGraphics || []), ...filteredOther];

  console.log(`[graphics-enricher] Raw graphics count: ${allGraphics.length} (${priorityGraphics?.length || 0} priority, ${otherGraphics?.length || 0} other)`);

  const mapped = allGraphics.map(g => ({
    id: g.id,
    pageNumber: g.page_number,
    type: g.graphic_type,
    description: g.description,
    confidence: g.confidence,
    elements: g.elements,
    suggestions: g.suggestions,
    storagePath: g.storage_path,
  }));

  // Filter out empty/incomplete graphics based on description patterns
  const validGraphics = mapped.filter(g => {
    const desc = (g.description || '').toLowerCase();

    // Reject graphics with descriptions indicating empty/incomplete content
    const emptyPatterns = [
      'empty',
      'incomplete',
      'no data',
      'no content',
      'without actual data',
      'without data',
      'just axes',
      'just axis',
      'only axes',
      'only axis',
      'template',
      'placeholder',
      'blank',
      'no curves',
      'no curve',
      'nothing plotted',
      'nothing drawn',
      'grille vide',     // French: empty grid
      'sans données',    // French: without data
      'sans courbe',     // French: without curve
      'axe seul',        // French: axis only
    ];

    const isEmptyGraphic = emptyPatterns.some(pattern => desc.includes(pattern));

    if (isEmptyGraphic) {
      console.log(`[graphics-enricher] Rejecting empty graphic: ${g.id} - "${g.description?.substring(0, 60)}..."`);
      return false;
    }

    return true;
  });

  console.log(`[graphics-enricher] After empty filter: ${validGraphics.length} graphics (rejected ${mapped.length - validGraphics.length} empty)`);

  // Sort by page number first, then deduplicate
  validGraphics.sort((a, b) => a.pageNumber - b.pageNumber);

  const deduplicated = deduplicateGraphics(validGraphics);

  console.log(`[graphics-enricher] Final: ${deduplicated.length} unique graphics for course ${courseId}`);

  return deduplicated;
}

/**
 * Resolve public URLs for graphics and return enriched array
 *
 * @param graphics - Array of graphic summaries with storage paths
 * @returns Array of graphics with resolved public URLs
 */
export function resolveGraphicsUrls(graphics: GraphicSummary[]): GraphicWithUrl[] {
  const admin = getServiceSupabase();

  return graphics.map(g => {
    let publicUrl = '';

    if (g.storagePath) {
      const { data: urlData } = admin.storage
        .from('course-graphics')
        .getPublicUrl(g.storagePath);
      publicUrl = urlData.publicUrl;
    }

    return {
      ...g,
      publicUrl,
    };
  });
}

/**
 * Generate graphics context string for prompt injection (V2)
 * Now uses real URLs directly instead of #loading placeholders
 *
 * @param graphics - Array of graphic summaries (with or without URLs)
 * @param excludeIds - Optional set of graphic IDs to exclude (already placed in previous sections)
 * @returns Formatted string for prompt with 4-step integration structure
 */
export function formatGraphicsContext(graphics: GraphicSummary[], excludeIds?: Set<string>): string {
  // Filter out already-placed graphics to prevent duplicates across sections
  const availableGraphics = excludeIds
    ? graphics.filter(g => !excludeIds.has(g.id))
    : graphics;

  if (availableGraphics.length === 0) {
    return '';
  }

  // Resolve URLs for all graphics upfront so they can be used directly in markdown
  const graphicsWithUrls = resolveGraphicsUrls(availableGraphics);

  // Replace 'graphics' with 'graphicsWithUrls' for the rest of the function
  const graphicsToProcess = graphicsWithUrls;

  const typeLabels: Record<string, string> = {
    // Universal diagrams
    flow_diagram: 'Flow Diagram',
    concept_map: 'Concept Map',
    tree_diagram: 'Tree/Hierarchy Diagram',
    venn_diagram: 'Venn Diagram',
    timeline: 'Timeline',
    formula_visual: 'Formula Visualization',
    cycle_diagram: 'Cycle Diagram',
    comparison_chart: 'Comparison Chart',
    organizational_chart: 'Organizational Chart',
    // Charts and data
    histogram: 'Histogram/Bar Chart',
    pie_chart: 'Pie Chart',
    line_chart: 'Line Chart',
    scatter_plot: 'Scatter Plot',
    table: 'Table/Matrix',
    // Mathematics
    geometric_diagram: 'Geometric Diagram',
    function_graph: 'Function Graph',
    // Economics
    supply_demand_curve: 'Supply/Demand Curve',
    equilibrium_graph: 'Equilibrium Graph',
    surplus_graph: 'Surplus Graph',
    elasticity_graph: 'Elasticity Graph',
    shift_graph: 'Shift/Shock Graph',
    // Sciences
    circuit_diagram: 'Circuit Diagram',
    chemical_structure: 'Chemical Structure',
    molecular_diagram: 'Molecular Diagram',
    anatomical_diagram: 'Anatomical Diagram',
    biological_diagram: 'Biological Diagram',
    physics_diagram: 'Physics Diagram',
    // Geography/History
    map: 'Map',
    geographic_map: 'Geographic Map',
    historical_map: 'Historical Map',
    // Other
    process_diagram: 'Process Diagram',
    // Legacy (backward compatibility)
    courbe_offre_demande: 'Supply/Demand Curve',
    diagramme_flux: 'Flow Diagram',
    organigramme: 'Organizational Chart',
    tableau: 'Table',
    autre: 'Diagram/Visual',
    other: 'Diagram/Visual',
  };

  // Build individual graphic blocks
  const graphicsList = graphicsToProcess
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((g, index) => {
      const typeLabel = typeLabels[g.type] || g.type;

      // Format elements list
      const elements = g.elements && g.elements.length > 0
        ? g.elements.map(e => `  - ${e}`).join('\n')
        : '  - No specific elements extracted';

      // Format suggestions list
      const suggestions = g.suggestions && g.suggestions.length > 0
        ? g.suggestions.map(s => `  - ${s}`).join('\n')
        : '  - Describe the main concept illustrated';

      // Build the actual markdown image syntax with real URL
      const imageMarkdown = g.publicUrl
        ? `![${g.description || 'Figure'}](${g.publicUrl})`
        : `![GRAPHIC-${g.id}](#loading)`; // Fallback if no URL

      return `
### GRAPHIQUE ${index + 1} : [GRAPHIC-${g.id}]
**Localisation** : Page ${g.pageNumber} of source document
**Type** : ${typeLabel}
**Confidence** : ${Math.round(g.confidence * 100)}%

**DESCRIPTION (USE THIS EXACT TEXT IN YOUR INTRODUCTION)** :
"${g.description || 'No description available'}"

⚠️ When placing this graphic, your introduction MUST contain: "${g.description}"

**Key elements to mention in your explanation** :
${elements}

**Image markdown to use** : \`${imageMarkdown}\`
`;
    })
    .join('\n---\n');

  // Build complete context with instructions
  const lines = [
    '',
    '═══════════════════════════════════════════════════════════════════════════════',
    '                         PEDAGOGICAL GRAPHICS AVAILABLE',
    '═══════════════════════════════════════════════════════════════════════════════',
    '',
    `${graphicsToProcess.length} graphic(s) available for placement in this section.`,
    '',
    graphicsList,
    '',
    '═══════════════════════════════════════════════════════════════════════════════',
    '                    CRITICAL GRAPHIC PLACEMENT RULES',
    '═══════════════════════════════════════════════════════════════════════════════',
    '',
    '⚠️ SURGICAL PRECISION REQUIRED - READ CAREFULLY ⚠️',
    '',
    '**RULE 1: STRICT SEMANTIC MATCHING**',
    'A graphic MUST ONLY be placed where its DESCRIPTION EXACTLY matches the concept being discussed.',
    '',
    'MATCHING PROCESS:',
    '1. Read the graphic DESCRIPTION field carefully',
    '2. Identify the MAIN SUBJECT of the graphic (what does it show?)',
    '3. Find the section that discusses THIS EXACT SUBJECT',
    '4. Place the graphic ONLY in that section',
    '',
    'EXAMPLES OF CORRECT MATCHING:',
    '- Graphic description: "Two curves intersecting at point E" → Place when discussing INTERSECTION/EQUILIBRIUM, NOT when discussing a single curve',
    '- Graphic description: "Diagram showing process A → B → C" → Place when discussing the COMPLETE PROCESS, NOT when discussing only step A',
    '- Graphic description: "Chart comparing X and Y" → Place when discussing BOTH X AND Y together, NOT when discussing only X',
    '- Graphic description: "Timeline of events 1900-1950" → Place when discussing that TIME PERIOD, NOT another period',
    '- Graphic description: "Anatomical view of the heart" → Place when discussing THE HEART, NOT the lungs',
    '- Graphic description: "Chemical reaction between A and B" → Place when discussing THIS REACTION, NOT a different reaction',
    '',
    '**RULE 2: DO NOT FORCE PLACEMENT**',
    'If NO section matches the graphic description, DO NOT INCLUDE IT.',
    'It is BETTER to omit a graphic than to place it in the wrong context.',
    'A misplaced graphic CONFUSES students and damages learning.',
    '',
    '**RULE 3: ONE GRAPHIC = ONE PLACEMENT**',
    'Each graphic can only appear ONCE in the entire document.',
    'Never reuse the same placeholder twice.',
    '',
    '**RULE 3b: CHOOSE THE BEST MATCH, NOT THE FIRST**',
    'When multiple graphics are available, DO NOT just pick the first one.',
    'Read ALL graphic descriptions and choose the ONE that BEST matches your current topic.',
    'Example: If discussing "market equilibrium" and you have:',
    '  - Graphic 1: "shows supply curve alone"',
    '  - Graphic 2: "shows equilibrium point where supply meets demand"',
    '→ Choose Graphic 2, NOT Graphic 1 (even though 1 appears first).',
    '',
    '**RULE 4: VERIFY BEFORE PLACING**',
    'Before inserting ANY graphic, answer these THREE questions:',
    '',
    'Q1: Does the graphic DESCRIPTION match my current paragraph topic?',
    '    - If the description says "X and Y" but I am only discussing X → NO MATCH',
    '    - If the description says "process A" but I am discussing process B → NO MATCH',
    '',
    'Q2: Would a student be CONFUSED seeing this graphic here?',
    '    - If the graphic shows something DIFFERENT from what the text says → CONFUSION',
    '    - If the graphic is MORE SPECIFIC or MORE GENERAL than the text → CONFUSION',
    '',
    'Q3: Is this the BEST section for this graphic in the ENTIRE document?',
    '    - Maybe another section matches better → CHECK FIRST',
    '',
    'If ANY answer raises doubt → DO NOT PLACE THE GRAPHIC HERE.',
    '',
    '═══════════════════════════════════════════════════════════════════════════════',
    '                         PLACEMENT FORMAT (when appropriate)',
    '═══════════════════════════════════════════════════════════════════════════════',
    '',
    '⚠️ CRITICAL: USE THE EXACT DESCRIPTION PROVIDED ⚠️',
    '',
    '**STEP 1 — Introduction using EXACT description**',
    'You MUST use the description from the graphic metadata. DO NOT paraphrase or simplify.',
    '',
    'CORRECT FORMAT:',
    '  "Le graphique suivant [EXACT DESCRIPTION FROM METADATA]."',
    '',
    'EXAMPLE:',
    '  If description = "illustre le déplacement des courbes d\'offre et de demande"',
    '  Write: "Le graphique suivant illustre le déplacement des courbes d\'offre et de demande."',
    '  NOT: "Le graphique suivant illustre la courbe d\'offre." (WRONG - incomplete)',
    '  NOT: "Le graphique montre l\'équilibre." (WRONG - rephrased)',
    '',
    '**STEP 2 — Insert the image**',
    'Copy and paste the EXACT "Image markdown to use" provided above for each graphic.',
    'The format is: ![description](url)',
    '',
    '**STEP 3 — Brief analysis (1-2 sentences)**',
    'Explain what to observe using the "Key elements" list provided.',
    '',
    '',
    '═══════════════════════════════════════════════════════════════════════════════',
    '                              FINAL VALIDATION',
    '═══════════════════════════════════════════════════════════════════════════════',
    '',
    'Before finishing, verify EACH graphic placement:',
    '☐ Does the graphic description MATCH the surrounding text topic?',
    '☐ Would placing this graphic HERE confuse a student? If yes, REMOVE IT.',
    '☐ Is each image markdown copied EXACTLY as provided (including full URL)?',
    '',
    '⚠️ REMEMBER: It is acceptable to NOT include a graphic if no section matches it perfectly.',
    `Out of ${graphicsToProcess.length} graphics available, you may include FEWER if semantic matching requires it.`,
    '',
  ];

  return lines.join('\n');
}

/**
 * Extract graphic IDs from generated markdown content
 * Supports multiple formats:
 * - Old placeholder: ![GRAPHIC-id](#loading) or ![GRAPHIC-id](graphic)
 * - New direct URL: ![description](https://...supabase.co/.../graphics/courseId/id.png)
 *
 * @param markdown - Generated note content
 * @returns Array of graphic IDs referenced in the content
 */
export function extractGraphicReferences(markdown: string): string[] {
  const ids: string[] = [];

  // Pattern 1: Old placeholder format ![GRAPHIC-{uuid}](#loading) or ![GRAPHIC-{uuid}](graphic)
  const placeholderRegex = /!\[GRAPHIC-([a-f0-9-]+)\]\((?:#loading|graphic)\)/gi;
  for (const match of markdown.matchAll(placeholderRegex)) {
    ids.push(match[1]);
  }

  // Pattern 2: Real URL format - extract UUID from Supabase storage path
  // Storage path format: {userId}/{courseId}/{graphicId} (NO extension)
  // Example: ![desc](https://xxx.supabase.co/storage/v1/object/public/course-graphics/userId/courseId/graphicId)
  // The graphicId is a UUID at the end of the path (with or without extension)
  const urlRegex = /!\[[^\]]*\]\(https?:\/\/[^)]*\/course-graphics\/[^/]+\/[^/]+\/([a-f0-9-]{36})(?:\.[a-z]+)?\)/gi;
  for (const match of markdown.matchAll(urlRegex)) {
    if (!ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }

  return ids;
}

/**
 * Replace graphic placeholders with actual image markdown
 *
 * @param markdown - Content with placeholders
 * @param courseId - Course UUID for building URLs
 * @returns Content with actual image tags
 */
export async function replaceGraphicPlaceholders(
  markdown: string,
  courseId: string
): Promise<string> {
  const graphicIds = extractGraphicReferences(markdown);

  if (graphicIds.length === 0) {
    return markdown;
  }

  const admin = getServiceSupabase();

  // Fetch graphic metadata
  const { data: graphics, error } = await admin
    .from('course_graphics')
    .select('id, storage_path, description, graphic_type')
    .in('id', graphicIds);

  if (error || !graphics) {
    console.error('[graphics-enricher] Failed to fetch graphics for replacement:', error?.message);
    return markdown;
  }

  // Build ID → URL map
  const graphicMap = new Map<string, { url: string; alt: string }>();

  for (const g of graphics) {
    const { data: urlData } = admin.storage
      .from('course-graphics')
      .getPublicUrl(g.storage_path);

    graphicMap.set(g.id, {
      url: urlData.publicUrl,
      alt: g.description || g.graphic_type,
    });
  }

  // Replace placeholders
  let result = markdown;

  for (const id of graphicIds) {
    const graphic = graphicMap.get(id);

    if (graphic) {
      const replacement = `![${graphic.alt}](${graphic.url})`;

      // Try both placeholder formats (new and old)
      const newPlaceholder = `![GRAPHIC-${id}](#loading)`;
      const oldPlaceholder = `![GRAPHIC-${id}](graphic)`;

      // Use split/join instead of regex to avoid escaping issues
      result = result.split(newPlaceholder).join(replacement);
      result = result.split(oldPlaceholder).join(replacement);
    }
  }

  return result;
}

/**
 * Enrich note generation prompt with graphics context
 *
 * @param basePrompt - Original prompt
 * @param courseId - Course UUID
 * @returns Enhanced prompt with graphics information
 */
export async function enrichPromptWithGraphics(
  basePrompt: string,
  courseId: string
): Promise<string> {
  const graphics = await getCourseGraphicsSummaries(courseId);

  if (graphics.length === 0) {
    return basePrompt;
  }

  const graphicsContext = formatGraphicsContext(graphics);

  // Insert graphics context before the main instructions
  // Find a good insertion point (before "Your task" or at the end of context section)
  const insertionMarkers = [
    '## YOUR TASK',
    '## TASK',
    '# INSTRUCTIONS',
    '## INSTRUCTIONS',
  ];

  for (const marker of insertionMarkers) {
    if (basePrompt.includes(marker)) {
      return basePrompt.replace(marker, `${graphicsContext}\n${marker}`);
    }
  }

  // If no marker found, append at the end
  return `${basePrompt}\n\n${graphicsContext}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//                    NEW: STRUCTURE-PHASE GRAPHIC ASSIGNMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Interface for graphic assignment to sections
 */
export interface GraphicAssignment {
  graphicId: string;
  matchReason: string;
}

/**
 * Format graphics for structure analysis phase (compact format)
 *
 * This is used during the structure analysis phase to let the LLM assign
 * each graphic to the most appropriate section based on semantic matching.
 *
 * @param graphics - Array of graphic summaries
 * @returns Formatted string for structure analysis prompt
 */
export function formatGraphicsForStructureAnalysis(graphics: GraphicSummary[]): string {
  if (graphics.length === 0) return '';

  const graphicsList = graphics.map((g, i) => {
    return `[${i + 1}] ID: "${g.id}"
    Page: ${g.pageNumber}
    Type: ${g.type}
    Description: "${g.description}"`;
  }).join('\n\n');

  return `
═══════════════════════════════════════════════════════════════════════════════
                    GRAPHICS TO ASSIGN TO SECTIONS
═══════════════════════════════════════════════════════════════════════════════

${graphics.length} graphic(s) available for assignment:

${graphicsList}

GRAPHIC ASSIGNMENT INSTRUCTIONS:
For each section in your JSON output, include an "assignedGraphics" array.
Each assignment should contain:
- graphicId: The exact ID string from above (e.g., "${graphics[0]?.id || 'uuid-here'}")
- matchReason: Brief explanation of why this graphic belongs in this section

RULES:
1. Assign a graphic ONLY if its description EXACTLY matches the section topic
2. Each graphic should be assigned to AT MOST ONE section
3. It is OK to leave graphics unassigned if no section matches semantically
4. Do NOT force assignments - precision is more important than coverage
5. Read the description carefully before assigning

EXAMPLES:
- Graphic "supply and demand curves intersecting" → Assign to section about market equilibrium
- Graphic "cell division stages" → Assign to section about mitosis/meiosis
- Graphic "timeline of French Revolution" → Assign to section about French Revolution
- Graphic "general axes without data" → Do NOT assign (empty graphic)
`;
}

/**
 * Filter graphics for a specific section based on assigned IDs
 *
 * @param allGraphics - Array of all graphics with URLs
 * @param assignedIds - Array of graphic IDs assigned to this section
 * @returns Filtered array of graphics for this section only
 */
export function getGraphicsForSection(
  allGraphics: GraphicWithUrl[],
  assignedIds: string[]
): GraphicWithUrl[] {
  if (assignedIds.length === 0) return [];

  const idSet = new Set(assignedIds);
  return allGraphics.filter(g => idSet.has(g.id));
}

/**
 * Format graphics context for section transcription (simplified format)
 *
 * This is a much shorter format than formatGraphicsContext because the graphics
 * have already been pre-filtered to only include those relevant to this section.
 * The LLM no longer needs to choose among many options.
 *
 * @param graphics - Array of graphics assigned to this section (typically 1-3)
 * @returns Formatted string for transcription prompt
 */
export function formatGraphicsContextForSection(graphics: GraphicWithUrl[]): string {
  if (graphics.length === 0) {
    return '';
  }

  const graphicsList = graphics.map((g, index) => {
    const elements = g.elements && g.elements.length > 0
      ? g.elements.slice(0, 4).join(', ')
      : 'N/A';

    return `
**Graphic ${index + 1}: ${g.description}**
- Type: ${g.type}
- Key elements: ${elements}
- Image: \`![${g.description}](${g.publicUrl})\``;
  }).join('\n');

  return `
═══════════════════════════════════════════════════════════════════════════════
               GRAPHICS FOR THIS SECTION (${graphics.length})
═══════════════════════════════════════════════════════════════════════════════
${graphicsList}

PLACEMENT RULES:
1. Include ALL graphics listed above - they were pre-selected as relevant
2. Place each graphic where the topic matches in your text
3. Use the EXACT markdown syntax provided

FORMAT (NO REPETITION):
![description](url)
[1-2 sentences explaining what to observe]

EXAMPLE:
![Ce graphique illustre l'équilibre du marché](url)
On observe que le point E représente le prix et la quantité où l'offre égale la demande.
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//                    V7: SEMANTIC-ONLY GRAPHIC ASSIGNMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * French stopwords for tokenization
 */
const STOPWORDS_FR = new Set([
  'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'à', 'en',
  'pour', 'avec', 'sur', 'par', 'dans', 'qui', 'que', 'ce', 'cette', 'ces',
  'son', 'sa', 'ses', 'leur', 'leurs', 'au', 'aux', 'est', 'sont', 'être',
  'avoir', 'fait', 'faire', 'peut', 'plus', 'moins', 'très', 'bien', 'aussi',
  'comme', 'tout', 'tous', 'toute', 'toutes', 'autre', 'autres', 'même',
  'ici', 'donc', 'encore', 'entre', 'vers', 'chez', 'sans', 'sous', 'dont'
]);

/**
 * English stopwords for tokenization
 */
const STOPWORDS_EN = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'this', 'that',
  'these', 'those', 'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either',
  'neither', 'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just',
  'also', 'now', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'any'
]);

/**
 * Minimum semantic score required for graphic assignment
 * Below this threshold, the graphic is NOT assigned (better to skip than misplace)
 */
const MIN_SEMANTIC_SCORE = 0.10;

/**
 * Tokenize text for semantic comparison
 * - Lowercases
 * - Removes accents
 * - Removes punctuation
 * - Filters stopwords
 * - Keeps only words with 2+ chars
 *
 * @param text - Text to tokenize
 * @returns Array of normalized tokens
 */
function tokenize(text: string): string[] {
  if (!text) return [];

  return text
    .toLowerCase()
    // Remove accents (normalize to NFD, then strip combining marks)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace non-alphanumeric with space (keep letters, numbers)
    .replace(/[^a-z0-9\s]/g, ' ')
    // Split on whitespace
    .split(/\s+/)
    // Filter: min length 2, not a stopword
    .filter(w => w.length >= 2 && !STOPWORDS_FR.has(w) && !STOPWORDS_EN.has(w));
}

/**
 * Calculate semantic similarity between a graphic and a section
 * Uses Jaccard similarity on tokenized content
 *
 * @param graphic - Graphic with description, type, elements
 * @param section - Section with title and semanticKeywords
 * @returns Similarity score between 0 and 1
 */
function calculateSemanticScore(
  graphic: GraphicSummary,
  section: { title: string; semanticKeywords?: string[] }
): number {
  // Build graphic tokens from all available text
  const graphicText = [
    graphic.description || '',
    graphic.type || '',
    ...(graphic.elements || [])
  ].join(' ');

  const graphicTokens = new Set(tokenize(graphicText));

  // Build section tokens from title and semantic keywords
  const sectionText = [
    section.title,
    ...(section.semanticKeywords || [])
  ].join(' ');

  const sectionTokens = new Set(tokenize(sectionText));

  // Edge cases
  if (graphicTokens.size === 0 || sectionTokens.size === 0) return 0;

  // Calculate Jaccard similarity: |intersection| / |union|
  const intersection = [...graphicTokens].filter(t => sectionTokens.has(t));
  const unionSize = new Set([...graphicTokens, ...sectionTokens]).size;

  const jaccardScore = intersection.length / unionSize;

  // Bonus: if intersection has 3+ tokens, add bonus (strong match)
  const bonusMultiplier = intersection.length >= 3 ? 1.3 : 1.0;

  return Math.min(jaccardScore * bonusMultiplier, 1.0);
}

/**
 * Section interface for V7 assignment
 */
export interface SectionForV7 {
  title: string;
  semanticKeywords?: string[];
  pageRange?: { start: number; end: number };
}

/**
 * Build section graphics map using SEMANTIC-ONLY assignment (V7)
 *
 * This is the new approach that ignores page numbers entirely.
 * Each graphic is assigned to the section with the highest semantic match.
 * If no section matches above the threshold, the graphic is NOT assigned.
 *
 * Benefits:
 * - No more misplaced graphics due to page proximity
 * - Graphics only appear where they semantically belong
 * - Better user experience (fewer confusing placements)
 *
 * @param structure - Document structure with sections containing semanticKeywords
 * @param graphics - Array of available graphics
 * @returns Map of sectionIndex -> array of graphic IDs
 */
export function buildSectionGraphicsMapV7(
  structure: { sections: SectionForV7[] },
  graphics: GraphicSummary[]
): Map<number, string[]> {
  const assignments = new Map<number, string[]>();

  // Initialize empty arrays for each section
  structure.sections.forEach((_, idx) => assignments.set(idx, []));

  let totalAssigned = 0;
  let totalSkipped = 0;

  for (const graphic of graphics) {
    let bestSectionIndex = -1;
    let bestScore = 0;
    let allScores: Array<{ idx: number; title: string; score: number }> = [];

    // Calculate score against each section
    for (let i = 0; i < structure.sections.length; i++) {
      const section = structure.sections[i];
      const score = calculateSemanticScore(graphic, section);

      allScores.push({ idx: i, title: section.title, score });

      if (score > bestScore) {
        bestScore = score;
        bestSectionIndex = i;
      }
    }

    // Only assign if score meets minimum threshold
    if (bestSectionIndex >= 0 && bestScore >= MIN_SEMANTIC_SCORE) {
      assignments.get(bestSectionIndex)!.push(graphic.id);
      totalAssigned++;

      const sectionTitle = structure.sections[bestSectionIndex].title;
      console.log(
        `[V7] ✓ Graphic "${graphic.id.substring(0, 8)}..." → "${sectionTitle}" ` +
        `(score: ${bestScore.toFixed(3)}, desc: "${(graphic.description || '').substring(0, 40)}...")`
      );
    } else {
      totalSkipped++;
      console.log(
        `[V7] ✗ Graphic "${graphic.id.substring(0, 8)}..." SKIPPED - no semantic match ` +
        `(best: ${bestScore.toFixed(3)}, threshold: ${MIN_SEMANTIC_SCORE}, ` +
        `desc: "${(graphic.description || '').substring(0, 40)}...")`
      );
    }
  }

  // Log summary
  console.log(
    `[V7] FINAL: ${totalAssigned}/${graphics.length} assigned, ` +
    `${totalSkipped} skipped (semantic-only, threshold: ${MIN_SEMANTIC_SCORE})`
  );

  // Log distribution per section
  assignments.forEach((ids, idx) => {
    if (ids.length > 0) {
      const sectionTitle = structure.sections[idx]?.title || `Section ${idx}`;
      console.log(`[V7]   - "${sectionTitle}": ${ids.length} graphic(s)`);
    }
  });

  return assignments;
}

// ═══════════════════════════════════════════════════════════════════════════════
//                    V5: HYBRID PAGE-BASED GRAPHIC ASSIGNMENT (LEGACY)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Section with page range for hybrid assignment
 */
export interface SectionWithPageRange {
  index: number;
  title: string;
  pageRange?: {
    start: number;
    end: number;
  };
}

/**
 * Assign graphics to sections based on page proximity (HYBRID V5 + Scoring)
 *
 * This is a DETERMINISTIC assignment based on page numbers + pedagogical scoring:
 * - A graphic from page N is assigned to the section that covers page N
 * - If no exact match, assigns to the nearest section (with tolerance)
 * - Graphics are scored by pedagogical value and only top N per section are kept
 * - The LLM then decides WHERE in the section to place it (semantic part)
 *
 * @param graphics - Array of graphics with page numbers
 * @param sections - Array of sections with page ranges
 * @param tolerance - Pages of tolerance for edge cases (default: 1)
 * @returns Map of sectionIndex -> array of graphic IDs (limited to MAX_GRAPHICS_PER_SECTION)
 */
export function assignGraphicsByPageRange(
  graphics: GraphicSummary[],
  sections: SectionWithPageRange[],
  tolerance: number = 1
): Map<number, string[]> {
  // Temporary map to hold all candidates per section (with scores)
  const candidates = new Map<number, Array<{ id: string; score: number; page: number }>>();

  // Initialize empty arrays for each section
  sections.forEach((_, idx) => candidates.set(idx, []));

  // Build a map of graphic ID to graphic for quick lookup
  const graphicMap = new Map<string, GraphicSummary>();
  for (const g of graphics) {
    graphicMap.set(g.id, g);
  }

  for (const graphic of graphics) {
    const graphicPage = graphic.pageNumber;
    let bestSectionIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const range = section.pageRange;

      if (!range) continue;

      // Check if graphic page is within section range (with tolerance)
      const rangeStart = range.start - tolerance;
      const rangeEnd = range.end + tolerance;

      if (graphicPage >= rangeStart && graphicPage <= rangeEnd) {
        // Within range - calculate distance to center for tie-breaking
        const sectionCenter = (range.start + range.end) / 2;
        const distance = Math.abs(graphicPage - sectionCenter);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestSectionIndex = i;
        }
      }
    }

    // Add to candidates for best matching section
    if (bestSectionIndex >= 0) {
      const score = calculatePedagogicalScore(graphic);
      candidates.get(bestSectionIndex)!.push({
        id: graphic.id,
        score,
        page: graphicPage
      });
      console.log(`[V5+Score] Graphic "${graphic.id.substring(0, 8)}..." (page ${graphicPage}, type: ${graphic.type}, score: ${score.toFixed(1)}) → Section ${bestSectionIndex}`);
    } else {
      console.log(`[V5+Score] ⚠️ Graphic "${graphic.id.substring(0, 8)}..." (page ${graphicPage}) - no matching section found`);
    }
  }

  // Calculate adaptive limit based on total graphics and sections
  const adaptiveLimit = calculateAdaptiveLimit(graphics.length, sections.length);
  console.log(`[V5] Adaptive limit: ${adaptiveLimit} graphics/section (${graphics.length} total, ${sections.length} sections)`);

  // Select top N graphics per section based on score
  const assignments = new Map<number, string[]>();
  let totalAssigned = 0;
  let totalDropped = 0;

  candidates.forEach((sectionCandidates, sectionIdx) => {
    if (sectionCandidates.length === 0) {
      assignments.set(sectionIdx, []);
      return;
    }

    // Sort by score (descending), then by page number (ascending) for tie-breaking
    sectionCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.page - b.page;
    });

    // Take top N using adaptive limit
    const selected = sectionCandidates.slice(0, adaptiveLimit);
    const dropped = sectionCandidates.slice(adaptiveLimit);

    assignments.set(sectionIdx, selected.map(c => c.id));
    totalAssigned += selected.length;
    totalDropped += dropped.length;

    if (sectionCandidates.length > 0) {
      const sectionTitle = sections[sectionIdx]?.title || `Section ${sectionIdx}`;
      console.log(`[V5] Section "${sectionTitle}": ${selected.length} selected, ${dropped.length} dropped`);
    }
  });

  console.log(`[V5] FINAL: ${totalAssigned}/${graphics.length} graphics assigned (${totalDropped} dropped, limit: ${adaptiveLimit}/section)`);

  return assignments;
}

/**
 * Build section graphics map from structure (HYBRID V5)
 *
 * Replaces the LLM-based assignedGraphics with deterministic page-based assignment.
 *
 * @param structure - Document structure with sections containing pageRange
 * @param graphics - Array of available graphics
 * @returns Map of sectionIndex -> array of graphic IDs
 */
export function buildSectionGraphicsMapV5(
  structure: { sections: Array<{ title: string; pageRange?: { start: number; end: number } }> },
  graphics: GraphicSummary[]
): Map<number, string[]> {
  // Convert structure sections to SectionWithPageRange format
  const sectionsWithRange: SectionWithPageRange[] = structure.sections.map((s, idx) => ({
    index: idx,
    title: s.title,
    pageRange: s.pageRange
  }));

  // Use page-based assignment
  return assignGraphicsByPageRange(graphics, sectionsWithRange);
}
