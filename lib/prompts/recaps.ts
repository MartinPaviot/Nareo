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

function getBlocFormules(niveau: NiveauDetail): string {
  const niveauInstructions: Record<NiveauDetail, string> = {
    synthetique: `
ADAPTATION SYNTHÉTIQUE :
- Variables : uniquement les essentielles (pas les évidentes)
- Pas de conditions d'application détaillées
- Format compact`,

    standard: `
ADAPTATION STANDARD :
- Toutes les variables définies
- Conditions d'application si importantes
- Format complet`,

    explicatif: `
ADAPTATION EXPLICATIF :
- Toutes les variables avec leur signification
- Conditions d'application complètes
- Ajouter "À utiliser quand..." si pertinent`,
  };

  return `
## 🔢 Récap formules

Extrais TOUTES les formules présentes dans la fiche.
Format tableau Markdown :

| Nom | Formule | Variables |
|-----|---------|-----------|
| [Nom 1] | $formule$ | $var1$ = ..., $var2$ = ... |
| [Nom 2] | $formule$ | ... |
...

RÈGLES :
- Formules en LaTeX (format $...$ pour inline)
- Ne rien inventer : uniquement ce qui est dans la fiche
${niveauInstructions[niveau]}`;
}

function getBlocSchemas(niveau: NiveauDetail): string {
  const niveauInstructions: Record<NiveauDetail, string> = {
    synthetique: `
ADAPTATION SYNTHÉTIQUE :
- Nom + axes + lecture clé en 1 phrase
- Pas de description détaillée`,

    standard: `
ADAPTATION STANDARD :
- Nom, axes, lecture clé
- Interprétation principale`,

    explicatif: `
ADAPTATION EXPLICATIF :
- Nom, axes, lecture clé
- Interprétation détaillée
- Contexte d'utilisation si pertinent`,
  };

  return `
## 📊 Index des schémas

Liste TOUS les graphiques et schémas mentionnés dans la fiche.
Format :

**1. [Nom du graphique/schéma]**
- Axes : X = [variable], Y = [variable]
- Lecture clé : [ce qu'il faut retenir]

**2. [Nom du graphique/schéma]**
- ...

RÈGLES :
- Numéroter les schémas
- Pour chaque schéma : nom, axes (si applicable), interprétation clé
- Si le schéma n'a pas d'axes (ex: organigramme), décrire sa structure
- Ne rien inventer : uniquement ce qui est dans la fiche
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
    blocksToGenerate.push(getBlocFormules(config.niveau));
  }

  if (config.recaps.schemas) {
    blocksToGenerate.push(getBlocSchemas(config.niveau));
  }

  if (blocksToGenerate.length === 0) {
    return ''; // Ne devrait pas arriver car shouldGenerateRecaps vérifie en amont
  }

  return `À partir de la fiche de révision ci-dessous, génère les récapitulatifs demandés.

Ces récaps seront ajoutés À LA FIN de la fiche pour permettre une révision rapide.
Ils doivent être exhaustifs : extraire TOUS les éléments du type demandé présents dans la fiche.

=== RÉCAPS À GÉNÉRER ===

${blocksToGenerate.join('\n\n')}

FORMAT DE SORTIE:

Commence directement par le premier bloc demandé (pas d'introduction).
Utilise exactement les titres et formats spécifiés ci-dessus.
Sépare chaque bloc par une ligne "---".
Tout le texte doit être aligné à gauche (pas de centrage).
Pas de séparateurs décoratifs ou de boîtes ASCII.

Génère en ${languageName}.`;
}
