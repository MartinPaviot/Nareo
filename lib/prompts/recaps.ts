import { PersonnalisationConfig, RecapsConfig, NiveauDetail } from '@/types/personnalisation';

/**
 * Vérifie si des récaps additionnels sont demandés (hors glossaire)
 * Le glossaire est géré séparément via generateGlossary
 */
export function shouldGenerateRecaps(recaps: RecapsConfig): boolean {
  return recaps.formules || recaps.schemas;
}

/**
 * Header des récaps (à ajouter avant les blocs)
 */
export const RECAPS_HEADER = `

---
`;

// ============================================================================
// BLOCS INDIVIDUELS - Adaptés au niveau de détail
// ============================================================================

function getBlocFormules(niveau: NiveauDetail, languageName: string): string {
  const niveauInstructions: Record<NiveauDetail, string> = {
    synthetique: `
SYNTHETIC ADAPTATION:
- Variables: only essential ones (not obvious ones)
- No detailed application conditions
- Compact format`,

    standard: `
STANDARD ADAPTATION:
- All variables defined
- Application conditions if important
- Complete format`,

    explicatif: `
EXPLANATORY ADAPTATION:
- All variables with their meaning
- Complete application conditions
- Add "Use when..." if relevant`,
  };

  return `
## [Title meaning "Formula Summary" - translated to ${languageName}]

Extract ALL formulas present in the sheet.
Output a proper Markdown table with EACH ROW ON A NEW LINE:

| [Name in ${languageName}] | [Formula in ${languageName}] | [Variables in ${languageName}] |
|-----|---------|-----------|
| [Name 1] | $formula$ | $var1$ = ..., $var2$ = ... |
| [Name 2] | $formula$ | ... |

CRITICAL FORMATTING RULES:
- EACH table row MUST be on its own line (use newline characters between rows)
- The separator row |-----|---------|...| MUST be on its own line after the header
- Formulas in LaTeX format ($...$ for inline)
- Do not invent anything: only what is in the sheet
- ALL column headers and content must be in ${languageName}
${niveauInstructions[niveau]}`;
}

function getBlocSchemas(niveau: NiveauDetail, languageName: string): string {
  const niveauInstructions: Record<NiveauDetail, string> = {
    synthetique: `
SYNTHETIC ADAPTATION:
- Name + axes + key reading in 1 sentence
- No detailed description`,

    standard: `
STANDARD ADAPTATION:
- Name, axes, key reading
- Main interpretation`,

    explicatif: `
EXPLANATORY ADAPTATION:
- Name, axes, key reading
- Detailed interpretation
- Usage context if relevant`,
  };

  return `
## [Title meaning "Diagram/Chart Index" - translated to ${languageName}]

List ALL graphs and diagrams mentioned in the sheet.
Format (ALL in ${languageName}):

**1. [Graph/diagram name in ${languageName}]**
- [Axes label in ${languageName}]: X = [variable], Y = [variable]
- [Key reading label in ${languageName}]: [what to remember]

**2. [Graph/diagram name in ${languageName}]**
- ...

RULES:
- Number the diagrams
- For each diagram: name, axes (if applicable), key interpretation
- If the diagram has no axes (e.g., flowchart), describe its structure
- Do not invent anything: only what is in the sheet
- ALL labels and content must be in ${languageName}
${niveauInstructions[niveau]}`;
}

/**
 * Génère le prompt pour les récaps (hors glossaire)
 * Modèle : gpt-4o-mini
 * Temperature : 0.2
 * Max tokens : 3000
 *
 * Ce prompt s'exécute APRÈS la génération de la fiche complète.
 * Il génère uniquement les récaps formules et schémas.
 * Le glossaire est géré séparément.
 */
export function getRecapsPrompt(
  config: PersonnalisationConfig,
  languageName: string
): string {
  const blocksToGenerate: string[] = [];

  // Note: definitions n'est plus ici, c'est le glossaire (géré séparément)

  if (config.recaps.formules) {
    blocksToGenerate.push(getBlocFormules(config.niveau, languageName));
  }

  if (config.recaps.schemas) {
    blocksToGenerate.push(getBlocSchemas(config.niveau, languageName));
  }

  if (blocksToGenerate.length === 0) {
    return ''; // Ne devrait pas arriver car shouldGenerateRecaps vérifie en amont
  }

  return `From the revision sheet below, generate the requested summaries.

These recaps will be added AT THE END of the sheet for quick revision.
They must be exhaustive: extract ALL elements of the requested type present in the sheet.

=== RECAPS TO GENERATE ===

${blocksToGenerate.join('\n\n')}

OUTPUT FORMAT:

Start directly with the first requested block (no introduction).
Use the formats specified above.
Separate each block with a "---" line.
All text must be left-aligned (no centering).
No decorative separators or ASCII boxes.

CRITICAL: Generate EVERYTHING in ${languageName}. All titles, labels, and content must be in ${languageName}.`;
}
