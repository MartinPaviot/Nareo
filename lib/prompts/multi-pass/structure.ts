import { PersonnalisationConfig } from '@/types/personnalisation';

/**
 * Génère le prompt pour le Pass 1 (extraction de structure)
 * Modèle : gpt-4o-mini
 * Temperature : 0.2
 * Max tokens : 2000
 */
export function getStructurePrompt(
  config: PersonnalisationConfig,
  languageName: string
): string {
  return `Tu es un expert en analyse de documents pédagogiques.

OBJECTIF : Identifier la structure EXHAUSTIVE du cours pour garantir qu'aucun concept ne sera omis lors de la transcription.

RETOURNE UN JSON VALIDE :
{
  "title": "Titre du cours",
  "metadata_to_ignore": ["éléments répétitifs à filtrer : headers, footers, numéros de page, plans répétés..."],
  "sections": [
    {
      "title": "Titre de la section",
      "startMarker": "10-20 premiers mots EXACTS",
      "endMarker": "10-20 derniers mots EXACTS",
      "contentTypes": {
        "definitions": ["liste des termes définis"],
        "formulas": ["liste des formules présentes"],
        "numerical_examples": ["liste des exemples chiffrés"],
        "graphs_or_visuals": ["description de chaque graphique/schéma"],
        "exercises": ["liste des exercices avec numéros"]
      },
      "keyTopics": ["topic1", "topic2"]
    }
  ]
}

RÈGLES :
- Identifie 5 à 15 sections (plus granulaire = moins d'omissions)
- CHAQUE graphique doit être listé dans graphs_or_visuals
- CHAQUE exemple numérique avec calculs doit être listé
- metadata_to_ignore : liste les éléments qui se répètent sur plusieurs pages (headers, "Plan de la session", etc.)

Analyse en ${languageName}.`;
}
