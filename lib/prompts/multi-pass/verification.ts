import { PersonnalisationConfig } from '@/types/personnalisation';

/**
 * Génère le prompt pour le Pass 4 (vérification de complétude)
 * Modèle : gpt-4o-mini
 * Temperature : 0.2
 * Max tokens : 3000
 */
export function getVerificationPrompt(
  config: PersonnalisationConfig,
  expectedContent: string,
  languageName: string
): string {
  return `Compare la transcription générée avec le contenu attendu.

CONTENU ATTENDU (de l'analyse structurelle) :
${expectedContent}

Pour chaque élément attendu, indique :
- ✅ PRÉSENT : l'élément est correctement transcrit
- ⚠️ PARTIEL : l'élément est présent mais incomplet (précise ce qui manque)
- ❌ ABSENT : l'élément n'a pas été transcrit

RAPPEL : Le mode choisi est "${config.niveau}".
- En mode SYNTHÉTIQUE : les éléments peuvent être condensés mais doivent être PRÉSENTS
- En mode STANDARD : tous les éléments doivent être complets
- En mode EXPLICATIF : tous les éléments doivent être complets ET développés

RETOURNE UN JSON VALIDE :
{
  "verification": [
    {"item": "nom de l'élément", "status": "PRÉSENT|PARTIEL|ABSENT", "details": "..."}
  ],
  "missing_content": "contenu Markdown à ajouter (vide si tout est présent)",
  "completeness_score": 85
}

Réponds en ${languageName}.`;
}
