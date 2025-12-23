import { PersonnalisationConfig, NiveauDetail } from '@/types/personnalisation';
import { getPersonnalisationBlock } from '../personnalisation-blocks';

interface ContentTypes {
  definitions: string[];
  formulas: string[];
  numerical_examples: string[];
  graphs_or_visuals: string[];
  exercises: string[];
}

/**
 * Génère le prompt pour le Pass 2 (transcription de section)
 * Modèle : gpt-4o
 * Temperature : 0.3
 * Max tokens : 4000
 */
export function getTranscriptionPrompt(
  config: PersonnalisationConfig,
  contentTypes: ContentTypes,
  metadataToIgnore: string[],
  languageName: string,
  formulaReminder: string,
  imageContext: string
): string {
  const niveauRappel = getNiveauRappel(config.niveau);

  return `Tu es un transcripteur expert pour fiches de révision.

${getPersonnalisationBlock(config)}

=== RÈGLES DE TRANSCRIPTION ===

**DÉFINITIONS** : Chaque terme technique = une définition
Format : **[Terme]** : [définition]

**FORMULES** : En LaTeX avec explication des variables
Format :
> **Formule : [Nom]**
> $$formule$$
> où $variable_1$ = ..., $variable_2$ = ...

**EXEMPLES NUMÉRIQUES** : Reproduis les calculs selon le niveau demandé

**LISTES NUMÉROTÉES** : Si le cours liste N éléments, tu dois avoir exactement N points.

=== STRUCTURE ===
- Utilise ## pour le titre de section
- Utilise ### pour les sous-sections

=== CONTENU ATTENDU POUR CETTE SECTION ===

- Définitions attendues : ${contentTypes.definitions.join(', ') || 'aucune identifiée'}
- Formules attendues : ${contentTypes.formulas.join(', ') || 'aucune identifiée'}
- Exemples numériques attendus : ${contentTypes.numerical_examples.join(', ') || 'aucun identifié'}
- Graphiques/visuels à décrire : ${contentTypes.graphs_or_visuals.join(', ') || 'aucun identifié'}
- Exercices : ${contentTypes.exercises.join(', ') || 'aucun identifié'}

=== ÉLÉMENTS À IGNORER (métadonnées répétitives) ===
${metadataToIgnore.join(', ') || 'aucun'}

=== RÈGLES CRITIQUES ===

⛔ ZÉRO INVENTION : N'ajoute JAMAIS de contenu absent du document source
✅ ZÉRO OMISSION : Inclus TOUT ce qui est présent dans le cours

Si une formule/concept/exemple est dans le cours → INCLUS-LE
Si une formule/concept/exemple n'est PAS dans le cours → NE L'INVENTE PAS

${formulaReminder}
${imageContext}

${niveauRappel}

Retranscris en ${languageName}.`;
}

function getNiveauRappel(niveau: NiveauDetail): string {
  if (niveau === 'synthetique') {
    return `
═══════════════════════════════════════════════════════════════
⚠️ RAPPEL CRITIQUE : MODE SYNTHÉTIQUE ACTIVÉ
═══════════════════════════════════════════════════════════════
- Ta transcription doit faire MAX 40% de ce que tu ferais normalement
- 1 définition = 1 ligne
- Pas de paragraphes, que des bullet points
- Pas d'introductions, pas de transitions
- Si tu écris "En effet" ou "Ainsi" → tu as échoué
═══════════════════════════════════════════════════════════════`;
  } else if (niveau === 'explicatif') {
    return `
═══════════════════════════════════════════════════════════════
📝 RAPPEL : MODE EXPLICATIF ACTIVÉ
═══════════════════════════════════════════════════════════════
- Développe les concepts pour aider à comprendre
- Ajoute le "pourquoi" derrière chaque mécanisme
- Fais des liens entre les notions
═══════════════════════════════════════════════════════════════`;
  }
  return ''; // Standard = pas de rappel spécial
}
