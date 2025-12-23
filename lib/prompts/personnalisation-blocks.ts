import { PersonnalisationConfig, Matiere, NiveauDetail } from '@/types/personnalisation';

// ============================================================================
// BLOC NIVEAU DE DÉTAIL - INSTRUCTIONS STRICTES
// ============================================================================

export function getNiveauInstructions(niveau: NiveauDetail): string {
  const instructions: Record<NiveauDetail, string> = {

    synthetique: `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ⚡ MODE SYNTHÉTIQUE - ULTRA CONDENSÉ ⚡                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

🎯 OBJECTIF : Fiche COURTE avec uniquement les FAITS du cours. Maximum 40% du standard.

═══ CE QUE TU INCLUS ═══
✅ Définitions (1 ligne max chacune)
✅ Formules avec variables
✅ Mécanismes/chaînes causales
✅ Listes de conditions/critères
✅ Tableaux comparatifs (OBLIGATOIRE quand plusieurs éléments similaires)

═══ CE QUE TU EXCLUS TOTALEMENT ═══
⛔ Exercices et leurs corrections
⛔ Exemples numériques détaillés
⛔ Introductions de sections
⛔ Plans et structure du cours
⛔ Contexte historique
⛔ Transitions ("En effet", "Ainsi", "Par conséquent")

═══ RÈGLES DE FORMAT ═══

1. DÉFINITIONS = 1 LIGNE MAX
   **Terme** : définition ultra-courte

2. FORMULES = FORMULE + VARIABLES
   $$formule$$ où $x$ = ..., $y$ = ...

3. MÉCANISMES = CHAÎNE CAUSALE
   A ↑ → B ↓ → C ↑

4. ⚠️ COMPARAISONS = TABLEAU OBLIGATOIRE ⚠️
   Quand tu as plusieurs éléments similaires à distinguer, utilise TOUJOURS un tableau :

   | Cas | Condition | Impact |
   |-----|-----------|--------|
   | Cas 1 | ... | ... |
   | Cas 2 | ... | ... |

   JAMAIS une liste de bullet points qui se ressemblent !

5. STRUCTURE = BULLET POINTS COURTS
   - Phrases courtes
   - Pas de paragraphes`,

    standard: `
╔══════════════════════════════════════════════════════════════════════════════╗
║                      📋 MODE STANDARD - COMPLET                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

🎯 OBJECTIF : Fiche complète et structurée. Couverture exhaustive.

═══ CE QUE TU INCLUS ═══
- Définitions complètes (2-3 phrases si nécessaire)
- Formules avec toutes les variables définies + conditions d'application
- Exemples numériques avec étapes de calcul
- Mécanismes expliqués avec leurs implications
- Exercices et corrections si présents dans le cours
- Structure hiérarchique claire

C'est le mode de référence. Ni trop court, ni trop long.`,

    explicatif: `
╔══════════════════════════════════════════════════════════════════════════════╗
║                   💡 MODE EXPLICATIF - COMPRENDRE POUR RETENIR               ║
╚══════════════════════════════════════════════════════════════════════════════╝

🎯 OBJECTIF : Chaque concept avec son "pourquoi". ~130% du standard.

═══ CE QUE TU INCLUS ═══
- Définitions complètes + origine/contexte
- Formules avec démonstration si elle éclaire le concept
- Exemples détaillés + interprétation du résultat
- Mécanismes avec explication du POURQUOI
- Liens entre les concepts
- Exercices avec correction détaillée et méthodologie

Tu développes pour aider à COMPRENDRE, pas pour allonger artificiellement.`,
  };

  return instructions[niveau];
}

// ============================================================================
// BLOC MATIÈRE
// ============================================================================

export function getMatiereInstructions(matiere: Matiere): string {
  const instructions: Record<Matiere, string> = {

    droit: `
=== SPÉCIFICITÉS DROIT ===

FORMAT OBLIGATOIRE :
- Articles de loi : [Art. X Code Y]
- Jurisprudences : "Arrêt [Nom], [Juridiction], [Date]"
- Définitions légales : entre guillemets « »

ÉLÉMENTS À PRIORISER :
- Articles fondamentaux
- Jurisprudences de principe
- Distinctions clés (utilise des TABLEAUX pour comparer)`,

    economie: `
=== SPÉCIFICITÉS ÉCONOMIE / FINANCE / GESTION ===

FORMAT OBLIGATOIRE :
- Formules en LaTeX avec variables définies
- Mécanismes en chaîne causale → (A ↑ → B ↓ → C ↑)

⚠️ IMPORTANT POUR LES COMPARAISONS :
Quand tu présentes plusieurs cas/scénarios similaires (ex: différents types d'élasticité, différents chocs), utilise OBLIGATOIREMENT un TABLEAU :

| Type | Formule | Interprétation |
|------|---------|----------------|
| ... | ... | ... |

JAMAIS des listes qui se ressemblent !`,

    sciences: `
=== SPÉCIFICITÉS SCIENCES ===

FORMAT OBLIGATOIRE :
- Formules en LaTeX avec unités SI
- Constantes avec valeur + unité
- Théorèmes avec conditions d'application

Utilise des TABLEAUX pour comparer formules similaires.`,

    'histoire-geo': `
=== SPÉCIFICITÉS HISTOIRE / GÉOGRAPHIE ===

FORMAT OBLIGATOIRE :
- Dates : [JJ mois AAAA]
- Acteurs : [Nom] (fonction)

ÉLÉMENTS À PRIORISER :
- Dates charnières
- Causalités (utilise des chaînes →)`,

    langues: `
=== SPÉCIFICITÉS LANGUES ===

FORMAT OBLIGATOIRE :
- Règles avec exemples
- Exceptions listées après la règle

Utilise des TABLEAUX pour les conjugaisons et comparaisons.`,

    informatique: `
=== SPÉCIFICITÉS INFORMATIQUE ===

FORMAT OBLIGATOIRE :
- Code dans des blocs \`\`\`langage\`\`\`
- Complexité : O(...)

Utilise des TABLEAUX pour comparer algorithmes/structures.`,

    medecine: `
=== SPÉCIFICITÉS MÉDECINE / SANTÉ ===

FORMAT OBLIGATOIRE :
- Valeurs normales avec unités
- Médicaments en DCI

Utilise des TABLEAUX pour les diagnostics différentiels.`,

    autre: `
=== FORMAT GÉNÉRAL ===

- Prioriser définitions et concepts
- Utiliser des TABLEAUX pour comparer éléments similaires
- Hiérarchie visuelle claire`,
  };

  return instructions[matiere];
}

// ============================================================================
// RÈGLE ANTI-HALLUCINATION (incluse dans tous les prompts)
// ============================================================================

const ANTI_HALLUCINATION_RULE = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    🚫 RÈGLE #1 : ZÉRO INVENTION 🚫                           ║
╚══════════════════════════════════════════════════════════════════════════════╝

⛔ INTERDICTION ABSOLUE D'INVENTER DU CONTENU ⛔

Tu retranscris UNIQUEMENT ce qui est EXPLICITEMENT dans le document source.

CE QUE TU FAIS :
✅ Inclure TOUT ce qui est dans le cours (formules, définitions, exemples)
✅ Si un concept est dans le document → tu l'inclus
✅ Si le cours a des exemples numériques → tu les reproduis

CE QUE TU NE FAIS JAMAIS :
❌ Ajouter des formules QUI NE SONT PAS dans le cours
❌ Inventer des exemples numériques absents du document
❌ Ajouter des concepts "connexes" non mentionnés
❌ Compléter une liste avec des éléments non mentionnés
❌ Ajouter du contexte ou des définitions "de culture générale"

👉 RÈGLE ABSOLUE : SI CE N'EST PAS ÉCRIT DANS LE DOCUMENT SOURCE → TU NE L'INCLUS PAS
`;

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

export function getPersonnalisationBlock(config: PersonnalisationConfig): string {
  return `
${ANTI_HALLUCINATION_RULE}

${getNiveauInstructions(config.niveau)}

${getMatiereInstructions(config.matiere)}
`;
}
