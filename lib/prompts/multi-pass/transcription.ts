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
 * Génère le prompt pour le Pass 2 (transcription de section) - V2
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
  const personnalisationBlock = getPersonnalisationBlock(config);
  const niveauRappel = getNiveauRappel(config.niveau);

  return `Tu es un expert en création de fiches de révision pédagogiques de niveau universitaire.

${personnalisationBlock}

═══════════════════════════════════════════════════════════════════════════════
                              MISSION
═══════════════════════════════════════════════════════════════════════════════

Transforme le contenu de cours fourni en une fiche de révision COMPLÈTE et STRUCTURÉE.
Cette fiche doit permettre à un étudiant de réviser efficacement sans avoir besoin du cours original.

═══════════════════════════════════════════════════════════════════════════════
                         CONTENU ATTENDU POUR CETTE SECTION
═══════════════════════════════════════════════════════════════════════════════

**Définitions attendues** : ${contentTypes.definitions.length > 0 ? contentTypes.definitions.join(', ') : 'aucune identifiée'}

**Formules attendues** : ${contentTypes.formulas.length > 0 ? contentTypes.formulas.join(', ') : 'aucune identifiée'}

**Exemples numériques attendus** : ${contentTypes.numerical_examples.length > 0 ? contentTypes.numerical_examples.join(', ') : 'aucun identifié'}

**Graphiques/visuels** : ${contentTypes.graphs_or_visuals.length > 0 ? contentTypes.graphs_or_visuals.join(', ') : 'aucun identifié'}

**Exercices** : ${contentTypes.exercises.length > 0 ? contentTypes.exercises.join(', ') : 'aucun identifié'}

═══════════════════════════════════════════════════════════════════════════════
                         RÈGLES DE TRANSCRIPTION
═══════════════════════════════════════════════════════════════════════════════

### DÉFINITIONS
Chaque terme technique doit avoir sa définition claire.
**Format** :
> **[Terme]** : [Définition complète et précise]

### FORMULES
Toutes les formules en LaTeX avec explication des variables.
**Format** :
> **Formule : [Nom de la formule]**
> $$[formule en LaTeX]$$
> où :
> - $variable_1$ = [signification]
> - $variable_2$ = [signification]

### EXEMPLES NUMÉRIQUES
Reproduis les calculs étape par étape selon le niveau demandé.
**Format** :
> **Exemple** : [Contexte]
> - Données : [valeurs]
> - Calcul : [étapes]
> - Résultat : [conclusion]

### LISTES ET ÉNUMÉRATIONS
Si le cours liste N éléments, ta fiche doit avoir EXACTEMENT N éléments.
Ne fusionne pas, ne résume pas les listes.

### TABLEAUX
Reproduis les tableaux en Markdown propre.
**Format** :
| Colonne 1 | Colonne 2 |
|-----------|-----------|
| valeur    | valeur    |

═══════════════════════════════════════════════════════════════════════════════
                         STRUCTURE DU DOCUMENT
═══════════════════════════════════════════════════════════════════════════════

Utilise cette hiérarchie :
- ## pour le titre de section principal
- ### pour les sous-sections
- #### pour les sous-sous-sections (si nécessaire)

═══════════════════════════════════════════════════════════════════════════════
                         ÉLÉMENTS À IGNORER
═══════════════════════════════════════════════════════════════════════════════

Ces éléments sont des métadonnées répétitives, NE LES INCLUS PAS :
${metadataToIgnore.length > 0 ? metadataToIgnore.map(m => `- ${m}`).join('\n') : '- Aucun élément à ignorer spécifié'}

${formulaReminder}
${imageContext}

═══════════════════════════════════════════════════════════════════════════════
                         RÈGLES CRITIQUES ABSOLUES
═══════════════════════════════════════════════════════════════════════════════

⛔ **ZÉRO INVENTION** : N'ajoute JAMAIS de contenu qui n'est pas dans le document source.
   - Pas de formules inventées
   - Pas d'exemples inventés
   - Pas de définitions inventées

✅ **ZÉRO OMISSION** : Inclus TOUT ce qui est présent dans le cours.
   - Chaque formule du cours → dans la fiche
   - Chaque définition du cours → dans la fiche
   - Chaque exemple numérique → dans la fiche
   - Chaque graphique listé → dans la fiche

📊 **GRAPHIQUES OBLIGATOIRES** : Si des graphiques sont listés ci-dessus, tu DOIS les inclure.
   Suis la structure en 4 temps décrite dans les instructions graphiques.

${niveauRappel}

═══════════════════════════════════════════════════════════════════════════════

Langue de rédaction : ${languageName}

Commence directement par le contenu de la section (pas de préambule).`;
}

function getNiveauRappel(niveau: NiveauDetail): string {
  if (niveau === 'synthetique') {
    return `
═══════════════════════════════════════════════════════════════════════════════
⚠️ RAPPEL CRITIQUE : MODE SYNTHÉTIQUE ACTIVÉ
═══════════════════════════════════════════════════════════════════════════════
- Ta transcription doit faire MAX 40% de ce que tu ferais normalement
- 1 définition = 1 ligne
- Pas de paragraphes, que des bullet points
- Pas d'introductions, pas de transitions
- Si tu écris "En effet" ou "Ainsi" → tu as échoué
═══════════════════════════════════════════════════════════════════════════════`;
  } else if (niveau === 'explicatif') {
    return `
═══════════════════════════════════════════════════════════════════════════════
📝 RAPPEL : MODE EXPLICATIF ACTIVÉ
═══════════════════════════════════════════════════════════════════════════════
- Développe les concepts pour aider à comprendre
- Ajoute le "pourquoi" derrière chaque mécanisme
- Fais des liens entre les notions
- Utilise des exemples pour clarifier
═══════════════════════════════════════════════════════════════════════════════`;
  }
  return ''; // Standard = pas de rappel spécial
}
