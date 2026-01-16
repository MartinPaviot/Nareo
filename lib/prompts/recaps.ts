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

  // Headers based on language
  const headers: Record<string, { title: string; name: string; formula: string; variables: string }> = {
    French: { title: 'Formules', name: 'Nom', formula: 'Formule', variables: 'Variables' },
    English: { title: 'Formulas', name: 'Name', formula: 'Formula', variables: 'Variables' },
    German: { title: 'Formeln', name: 'Name', formula: 'Formel', variables: 'Variablen' },
    Spanish: { title: 'Fórmulas', name: 'Nombre', formula: 'Fórmula', variables: 'Variables' },
    Italian: { title: 'Formule', name: 'Nome', formula: 'Formula', variables: 'Variabili' },
    Portuguese: { title: 'Fórmulas', name: 'Nome', formula: 'Fórmula', variables: 'Variáveis' },
  };
  const h = headers[languageName] || headers.English;

  return `
FORMULAS BLOCK - Generate this EXACT structure:

## ${h.title}

| ${h.name} | ${h.formula} | ${h.variables} |
|-----|---------|-----------|
| [name] | $formula$ | $var1$ = ..., $var2$ = ... |
| [name] | $formula$ | $var1$ = ..., $var2$ = ... |

INSTRUCTIONS:
- The title "## ${h.title}" is MANDATORY - start with it
- Extract ALL formulas present in the sheet
- EACH table row MUST be on its own line
- Formulas in LaTeX format ($...$ for inline)
- Do not invent anything: only what is in the sheet
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

1. START with the section title (e.g., "## Formules") - this is MANDATORY
2. Then the table or list as specified
3. No introduction text before the title
4. Separate each block with a "---" line
5. All text must be left-aligned (no centering)
6. No decorative separators or ASCII boxes

CRITICAL: Generate EVERYTHING in ${languageName}. All titles, labels, and content must be in ${languageName}.`;
}
