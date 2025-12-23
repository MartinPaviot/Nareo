import { PersonnalisationConfig, Matiere, NiveauDetail } from '@/types/personnalisation';

/**
 * Génère le prompt pour le glossaire
 * Modèle : gpt-4o-mini
 * Temperature : 0.2
 * Max tokens : 2000
 *
 * Le glossaire est généré UNIQUEMENT si l'utilisateur coche "Glossaire" dans les récaps.
 */
export function getGlossairePrompt(
  config: PersonnalisationConfig,
  languageName: string
): string {
  const matiereSpecifics = getMatiereGlossaireSpecifics(config.matiere);
  const niveauInstructions = getNiveauGlossaireInstructions(config.niveau);

  return `À partir de cette note de cours, génère un glossaire complet.

FORMAT (tableau Markdown) :
## Glossaire

| Terme | Définition |
|-------|------------|
| terme1 | définition |
| terme2 | définition |

RÈGLES :
- Inclus TOUS les termes techniques, acronymes, et concepts clés
- Ordonne alphabétiquement
- Minimum 10 termes, maximum 30

${niveauInstructions}

${matiereSpecifics}

Génère en ${languageName}.`;
}

function getNiveauGlossaireInstructions(niveau: NiveauDetail): string {
  const instructions: Record<NiveauDetail, string> = {
    synthetique: `ADAPTATION SYNTHÉTIQUE :
- Définitions ultra-courtes (max 10 mots)
- L'essentiel uniquement, pas de contexte
- Format : "Terme : définition minimale"`,

    standard: `ADAPTATION STANDARD :
- Définitions concises mais complètes (1-2 phrases)
- Inclure le contexte si nécessaire à la compréhension`,

    explicatif: `ADAPTATION EXPLICATIF :
- Définitions complètes avec contexte
- Ajouter l'étymologie si elle aide à retenir
- Faire des liens avec d'autres termes si pertinent`,
  };

  return instructions[niveau];
}

function getMatiereGlossaireSpecifics(matiere: Matiere): string {
  const specifics: Record<Matiere, string> = {
    droit: `SPÉCIFICITÉS DROIT :
- Inclure les articles de loi mentionnés comme entrées
- Définitions légales exactes entre guillemets`,

    economie: `SPÉCIFICITÉS ÉCONOMIE/FINANCE :
- Inclure les noms d'auteurs/théoriciens mentionnés avec leur théorie
- Acronymes financiers présents dans le document`,

    sciences: `SPÉCIFICITÉS SCIENCES :
- Inclure les constantes physiques importantes
- Mentionner les unités SI quand pertinent`,

    'histoire-geo': `SPÉCIFICITÉS HISTOIRE/GÉO :
- Les dates clés peuvent être des entrées
- Acteurs majeurs avec leur fonction principale`,

    langues: `SPÉCIFICITÉS LANGUES :
- Termes grammaticaux en français
- Règles grammaticales nommées dans le document`,

    informatique: `SPÉCIFICITÉS INFORMATIQUE :
- Complexités algorithmiques associées aux structures mentionnées
- Acronymes techniques présents dans le document`,

    medecine: `SPÉCIFICITÉS MÉDECINE :
- Valeurs normales pour les constantes biologiques clés
- Étymologie si elle aide à retenir le terme`,

    autre: '',
  };

  return specifics[matiere] || '';
}
