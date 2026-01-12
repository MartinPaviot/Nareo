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

// Priority graphic types that should have a lower confidence threshold
const PRIORITY_GRAPHIC_TYPES = [
  'supply_demand_curve',
  'equilibrium_graph',
  'surplus_graph',
  'elasticity_graph',
  'shift_graph',
  'flow_diagram',
  'formula_visual',
  'concept_map',
  'courbe_offre_demande',
  'diagramme_flux',
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

  // Sort by page number first, then deduplicate
  mapped.sort((a, b) => a.pageNumber - b.pageNumber);

  const deduplicated = deduplicateGraphics(mapped);

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
    supply_demand_curve: 'Supply/Demand Curve',
    equilibrium_graph: 'Equilibrium Graph',
    surplus_graph: 'Surplus Graph',
    elasticity_graph: 'Elasticity Graph',
    shift_graph: 'Shift/Shock Graph',
    histogram: 'Histogram',
    pie_chart: 'Pie Chart',
    line_chart: 'Line Chart',
    scatter_plot: 'Scatter Plot',
    flow_diagram: 'Flow Diagram',
    tree_diagram: 'Tree Diagram',
    venn_diagram: 'Venn Diagram',
    table: 'Table/Matrix',
    formula_visual: 'Formula Visualization',
    concept_map: 'Concept Map',
    timeline: 'Timeline',
    courbe_offre_demande: 'Supply/Demand Curve',
    diagramme_flux: 'Flow Diagram',
    organigramme: 'Organizational Chart',
    tableau: 'Table',
    autre: 'Diagram/Visual',
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
  // Example: ![desc](https://xxx.supabase.co/storage/v1/object/public/course-graphics/courseId/graphicId.png)
  const urlRegex = /!\[[^\]]*\]\(https?:\/\/[^)]*\/course-graphics\/[^/]+\/([a-f0-9-]+)\.[a-z]+\)/gi;
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
