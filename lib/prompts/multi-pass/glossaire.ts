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

  // Headers based on language
  const headers: Record<string, { title: string; term: string; definition: string }> = {
    French: { title: 'Glossaire', term: 'Terme', definition: 'Définition' },
    English: { title: 'Glossary', term: 'Term', definition: 'Definition' },
    German: { title: 'Glossar', term: 'Begriff', definition: 'Definition' },
    Spanish: { title: 'Glosario', term: 'Término', definition: 'Definición' },
    Italian: { title: 'Glossario', term: 'Termine', definition: 'Definizione' },
    Portuguese: { title: 'Glossário', term: 'Termo', definition: 'Definição' },
  };
  const h = headers[languageName] || headers.English;

  return `Generate a comprehensive glossary from this course note.

FORMAT (Markdown table with EACH ROW ON A NEW LINE):
## ${h.title}

| ${h.term} | ${h.definition} |
|-------|------------|
| term1 | definition |
| term2 | definition |

CRITICAL FORMATTING RULES:
- EACH table row MUST be on its own line (newline between each row)
- The separator row |-------|------------| MUST be on its own line after the header
- Include ALL technical terms, acronyms, and key concepts
- Order alphabetically
- Minimum 10 terms, maximum 30

${niveauInstructions}

${matiereSpecifics}

Generate in ${languageName}.`;
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
