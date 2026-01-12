/**
 * SVG Generation Prompts (V2)
 *
 * Prompts for regenerating pedagogical graphics as clean, professional SVGs
 */

import { GraphicAnalysis } from '@/lib/image-analysis';
import { PersonnalisationConfig } from '@/types/personnalisation';

/**
 * Génère le prompt pour régénérer un graphique en SVG
 */
export function getSVGRegenerationPrompt(
  analysis: GraphicAnalysis,
  config: PersonnalisationConfig
): string {
  const elementsText = analysis.elements && analysis.elements.length > 0
    ? analysis.elements.map(e => `- ${e}`).join('\n')
    : '- Aucun élément spécifié';

  const textContentText = analysis.textContent && analysis.textContent.length > 0
    ? analysis.textContent.map(t => `- "${t}"`).join('\n')
    : '- Aucun texte spécifié';

  const relatedConceptsText = analysis.relatedConcepts && analysis.relatedConcepts.length > 0
    ? analysis.relatedConcepts.join(', ')
    : 'Non spécifiés';

  return `Tu es un expert en visualisation de données pédagogiques et en création SVG.

═══════════════════════════════════════════════════════════════════════════════
                              MISSION
═══════════════════════════════════════════════════════════════════════════════

Régénère ce graphique pédagogique en SVG propre, lisible et professionnel.
Le SVG sera affiché dans une fiche de révision pour étudiants universitaires.

═══════════════════════════════════════════════════════════════════════════════
                         ANALYSE DU GRAPHIQUE ORIGINAL
═══════════════════════════════════════════════════════════════════════════════

**Type** : ${analysis.type}
**Description** : ${analysis.description}

**Éléments à reproduire** :
${elementsText}

**Textes présents** :
${textContentText}

**Concepts liés** :
${relatedConceptsText}

═══════════════════════════════════════════════════════════════════════════════
                         SPÉCIFICATIONS SVG
═══════════════════════════════════════════════════════════════════════════════

### Dimensions
- Largeur : 600px
- Hauteur : 400px (ajustable selon le contenu)
- ViewBox : "0 0 600 400"

### Palette de couleurs (cohérente Nareo)
- Fond : #FFFFFF (blanc)
- Axes : #374151 (gris foncé)
- Grille : #E5E7EB (gris clair, optionnel)
- Courbe de demande : #3B82F6 (bleu)
- Courbe d'offre : #EF4444 (rouge)
- Surplus consommateur : #10B981 (vert) avec opacité 0.3
- Surplus producteur : #F59E0B (orange) avec opacité 0.3
- Points remarquables : #1F2937 (noir)
- Annotations : #6B7280 (gris)
- Couleur accent Nareo : #F97316 (orange Nareo)

### Typographie
- Police : system-ui, -apple-system, sans-serif
- Taille labels axes : 14px
- Taille annotations : 12px
- Taille titre : 16px, font-weight: 600
- Couleur texte : #1F2937

### Éléments obligatoires
1. **Axes** avec flèches aux extrémités
2. **Labels des axes** clairs et lisibles
3. **Titre** du graphique (si pertinent)
4. **Légende** si plusieurs courbes/zones
5. **Points remarquables** clairement marqués (cercles pleins)
6. **Annotations** pour les valeurs importantes

### Bonnes pratiques
- Lignes de 2px d'épaisseur pour les courbes principales
- Lignes pointillées (stroke-dasharray="5,5") pour les projections
- Marges internes de 60px (gauche/bas pour les axes)
- Pas d'éléments décoratifs inutiles
- Contraste suffisant pour impression N&B

═══════════════════════════════════════════════════════════════════════════════
                         TEMPLATES PAR TYPE
═══════════════════════════════════════════════════════════════════════════════

### supply_demand_curve / equilibrium_graph
- Axe X : Quantité (Q)
- Axe Y : Prix (P)
- Demande : courbe décroissante bleue
- Offre : courbe croissante rouge
- Équilibre : point noir avec label "E*" ou "(P*, Q*)"
- Projections : lignes pointillées vers les axes

### surplus_graph
- Même base que supply_demand
- Zone surplus conso : triangle/trapèze vert semi-transparent AU-DESSUS du prix
- Zone surplus prod : triangle/trapèze orange semi-transparent EN-DESSOUS du prix
- Annotations avec les calculs d'aire si fournis

### elasticity_graph
- 4 variantes possibles (forte/faible demande, forte/faible offre)
- Annoter ΔP et ΔQ avec des accolades ou flèches
- Montrer visuellement la pente (plate = élastique, verticale = inélastique)

### histogram
- Barres verticales avec espacement
- Couleurs distinctes par catégorie
- Labels sous chaque barre
- Valeurs au-dessus des barres

### shift_graph
- Courbe initiale en trait plein
- Courbe après choc en trait pointillé ou couleur différente
- Flèche indiquant le sens du déplacement
- Deux points d'équilibre : E1 et E2

═══════════════════════════════════════════════════════════════════════════════
                         FORMAT DE RÉPONSE
═══════════════════════════════════════════════════════════════════════════════

Retourne UNIQUEMENT le code SVG complet, sans explication.
Le SVG doit être valide et autosuffisant (pas de références externes).

Commence par : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
Termine par : </svg>

═══════════════════════════════════════════════════════════════════════════════
                              EXEMPLE
═══════════════════════════════════════════════════════════════════════════════

Pour un graphique offre/demande simple :

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
  <!-- Fond -->
  <rect width="600" height="400" fill="#FFFFFF"/>

  <!-- Axes -->
  <line x1="60" y1="340" x2="560" y2="340" stroke="#374151" stroke-width="2"/>
  <line x1="60" y1="340" x2="60" y2="40" stroke="#374151" stroke-width="2"/>

  <!-- Flèches des axes -->
  <polygon points="560,340 550,335 550,345" fill="#374151"/>
  <polygon points="60,40 55,50 65,50" fill="#374151"/>

  <!-- Labels axes -->
  <text x="540" y="370" font-family="system-ui" font-size="14" fill="#1F2937">Quantité (Q)</text>
  <text x="20" y="60" font-family="system-ui" font-size="14" fill="#1F2937" transform="rotate(-90, 20, 60)">Prix (P)</text>

  <!-- Courbe de demande (décroissante, bleue) -->
  <path d="M 80 80 L 500 300" stroke="#3B82F6" stroke-width="2" fill="none"/>
  <text x="490" y="320" font-family="system-ui" font-size="12" fill="#3B82F6">Demande</text>

  <!-- Courbe d'offre (croissante, rouge) -->
  <path d="M 80 300 L 500 80" stroke="#EF4444" stroke-width="2" fill="none"/>
  <text x="490" y="70" font-family="system-ui" font-size="12" fill="#EF4444">Offre</text>

  <!-- Point d'équilibre -->
  <circle cx="290" cy="190" r="6" fill="#1F2937"/>
  <text x="300" y="185" font-family="system-ui" font-size="12" fill="#1F2937">E* (Q*, P*)</text>

  <!-- Projections pointillées -->
  <line x1="290" y1="190" x2="290" y2="340" stroke="#6B7280" stroke-width="1" stroke-dasharray="5,5"/>
  <line x1="60" y1="190" x2="290" y2="190" stroke="#6B7280" stroke-width="1" stroke-dasharray="5,5"/>

  <!-- Valeurs sur les axes -->
  <text x="285" y="360" font-family="system-ui" font-size="11" fill="#6B7280">Q*</text>
  <text x="40" y="195" font-family="system-ui" font-size="11" fill="#6B7280">P*</text>
</svg>

═══════════════════════════════════════════════════════════════════════════════

Génère maintenant le SVG pour le graphique décrit ci-dessus.`;
}

/**
 * Génère le prompt pour valider un SVG généré
 */
export function getSVGValidationPrompt(
  svgCode: string,
  originalAnalysis: GraphicAnalysis
): string {
  const elementsText = originalAnalysis.elements && originalAnalysis.elements.length > 0
    ? originalAnalysis.elements.join(', ')
    : 'Non spécifiés';

  return `Vérifie la qualité de ce SVG pédagogique.

═══════════════════════════════════════════════════════════════════════════════
                              SVG À VÉRIFIER
═══════════════════════════════════════════════════════════════════════════════

${svgCode}

═══════════════════════════════════════════════════════════════════════════════
                         ÉLÉMENTS ATTENDUS
═══════════════════════════════════════════════════════════════════════════════

Type : ${originalAnalysis.type}
Description : ${originalAnalysis.description}
Éléments requis : ${elementsText}

═══════════════════════════════════════════════════════════════════════════════
                         CRITÈRES DE VALIDATION
═══════════════════════════════════════════════════════════════════════════════

1. **Syntaxe SVG** : Le code est-il valide ?
2. **Éléments présents** : Tous les éléments requis sont-ils là ?
3. **Lisibilité** : Les textes sont-ils assez grands (min 12px) ?
4. **Couleurs** : Le contraste est-il suffisant ?
5. **Proportions** : Le graphique utilise-t-il bien l'espace disponible ?
6. **Axes** : Sont-ils labellisés correctement ?
7. **Légende** : Est-elle présente si nécessaire ?

═══════════════════════════════════════════════════════════════════════════════
                         FORMAT DE RÉPONSE (JSON)
═══════════════════════════════════════════════════════════════════════════════

{
  "valid": [true/false],
  "score": [0-100],
  "issues": [
    {
      "severity": "critical|major|minor",
      "description": "[description du problème]",
      "fix": "[correction suggérée]"
    }
  ],
  "missingElements": ["élément 1", "élément 2"],
  "approved": [true/false]
}

Si approved=false, liste les corrections à apporter.
Retourne UNIQUEMENT le JSON.`;
}
