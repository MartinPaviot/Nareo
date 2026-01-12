import { PersonnalisationConfig } from '@/types/personnalisation';

/**
 * Génère le prompt pour le Pass 1 (extraction de structure) - V2
 * Modèle : gpt-4o-mini
 * Temperature : 0.2
 * Max tokens : 2000
 */
export function getStructurePrompt(
  config: PersonnalisationConfig,
  languageName: string
): string {
  return `Tu es un expert en analyse de documents pédagogiques universitaires.

═══════════════════════════════════════════════════════════════════════════════
                              MISSION
═══════════════════════════════════════════════════════════════════════════════

Analyse ce document de cours et identifie sa structure EXHAUSTIVE.
Cette analyse servira à segmenter le document pour une transcription fidèle.

L'objectif est de garantir qu'AUCUN concept, AUCUNE formule, AUCUN exemple, AUCUN graphique ne sera omis.

═══════════════════════════════════════════════════════════════════════════════
                         FORMAT DE RÉPONSE (JSON)
═══════════════════════════════════════════════════════════════════════════════

Retourne UNIQUEMENT un objet JSON valide :

{
  "title": "Titre complet du cours",
  "subject": "Matière (économie, mathématiques, physique, etc.)",
  "academicLevel": "Niveau (L1, L2, L3, M1, M2, etc.)",
  "metadata_to_ignore": [
    "éléments répétitifs à filtrer"
  ],
  "sections": [
    {
      "id": "section_1",
      "title": "Titre de la section",
      "startMarker": "15-25 premiers mots EXACTS du début de section",
      "endMarker": "15-25 derniers mots EXACTS de la fin de section",
      "pageRange": {
        "start": 1,
        "end": 5
      },
      "contentTypes": {
        "definitions": ["terme1", "terme2"],
        "formulas": ["nom_formule1", "nom_formule2"],
        "numerical_examples": ["description exemple1"],
        "graphs_or_visuals": [
          {
            "description": "Description du graphique",
            "pageNumber": 3,
            "figureReference": "figure 1"
          }
        ],
        "exercises": ["exercice 1", "exercice 2"],
        "tables": ["tableau des prix"]
      },
      "keyTopics": ["topic1", "topic2"],
      "prerequisiteSections": []
    }
  ],
  "graphicsSummary": {
    "totalCount": 12,
    "byType": {
      "supply_demand_curve": 4,
      "histogram": 2,
      "equilibrium_graph": 3,
      "other": 3
    },
    "pageDistribution": [
      {"page": 3, "count": 2},
      {"page": 7, "count": 1}
    ]
  },
  "exercisesSummary": {
    "totalCount": 5,
    "withSolutions": true,
    "types": ["QCM", "calcul", "graphique"]
  }
}

═══════════════════════════════════════════════════════════════════════════════
                         INSTRUCTIONS DÉTAILLÉES
═══════════════════════════════════════════════════════════════════════════════

### metadata_to_ignore
Liste les éléments qui se répètent sur plusieurs pages et ne doivent PAS être transcrits :
- Headers/footers répétitifs
- Numéros de page
- Logos institutionnels
- Plans de session répétés
- Informations de contact répétées

### sections
Identifie entre 5 et 20 sections selon la longueur du document.
Plus le document est long, plus tu dois être granulaire.

**RÈGLE CRITIQUE** : Chaque graphique doit être assigné à UNE section précise.
Si un graphique illustre un concept, il appartient à la section de ce concept.

### startMarker / endMarker
- Utilise des extraits EXACTS et UNIQUES du texte
- 15-25 mots pour garantir l'unicité
- Ne pas utiliser des phrases qui se répètent

### pageRange
- Estime les pages couvertes par chaque section
- Permet de corréler avec les graphiques extraits

### graphs_or_visuals
Pour CHAQUE graphique/schéma/figure visible :
- Description claire de ce qu'il représente
- Numéro de page où il apparaît
- Référence textuelle si mentionnée ("voir figure 2", "graphique ci-dessous")

### graphicsSummary
Résumé global des graphiques pour validation :
- Compte total
- Répartition par type (supply_demand_curve, histogram, equilibrium_graph, etc.)
- Distribution par page

═══════════════════════════════════════════════════════════════════════════════
                         EXEMPLES DE DÉTECTION
═══════════════════════════════════════════════════════════════════════════════

**Graphique à détecter** :
- "Courbe d'offre et de demande avec équilibre" → supply_demand_curve
- "Histogramme des DMP par consommateur" → histogram
- "Schéma du surplus du consommateur (aire colorée)" → surplus_graph
- "Graphique montrant l'effet d'un choc d'offre" → shift_graph
- "Tableau des élasticités par produit" → table

**Références textuelles à repérer** :
- "comme le montre le graphique ci-dessous"
- "voir figure 3"
- "le schéma suivant illustre"
- "représenté graphiquement par"

═══════════════════════════════════════════════════════════════════════════════
                              VALIDATION
═══════════════════════════════════════════════════════════════════════════════

Avant de répondre, vérifie :
☐ Chaque section a des markers uniques et trouvables
☐ Tous les graphiques visibles sont listés
☐ Les pageRange sont cohérents et sans chevauchement
☐ Le compte total de graphiques dans graphicsSummary correspond aux détails

═══════════════════════════════════════════════════════════════════════════════

Langue d'analyse : ${languageName}

Retourne UNIQUEMENT le JSON, sans texte avant ou après.`;
}
