# 🔄 Refonte du Système d'Upload - Progression

## ✅ Tâches Complétées

### ✅ Tâche 2: Normalisation Avancée du Texte PDF
**Fichier:** `lib/pdf-parser.ts`

**Implémenté:**
- ✅ Fonction `cleanAndNormalizePdfText()` créée
- ✅ Suppression des caractères de contrôle
- ✅ Détection et fusion des lettres espacées:
  - "C  O  U  R  S" → "COURS"
  - "I n f o g r a p h i e" → "Infographie"
- ✅ Compression des espaces multiples
- ✅ Normalisation des retours à la ligne
- ✅ Nettoyage des lignes vides
- ✅ Logs détaillés pour le debugging

**Regex utilisées:**
```typescript
// Majuscules espacées: "C  O  U  R  S" → "COURS"
text.replace(/([A-ZÀ-ÿ])(\s{1,3})(?=[A-ZÀ-ÿ](\s{1,3}|[A-ZÀ-ÿ]|$))/g, '$1');

// Minuscules espacées: "i n f o" → "info"
text.replace(/\b([a-zà-ÿ])(\s{1,2})(?=[a-zà-ÿ](\s{1,2}|$))/g, '$1');
```

---

### ✅ Tâche 3: Nouvelle Logique de Détection d'Illisibilité
**Fichier:** `lib/pdf-parser.ts`

**Implémenté:**
- ✅ Fonction `isTextUnreadable()` créée
- ✅ Logique simplifiée avec seuils clairs:
  - `length < 300` → illisible
  - `readableCharsRatio < 0.7` → illisible
  - `readableWordsRatio < 0.5` → illisible
- ✅ Suppression du système de score complexe
- ✅ Messages de log clairs et informatifs

**Seuils:**
| Critère | Seuil | Action |
|---------|-------|--------|
| Longueur | < 300 chars | ❌ Illisible |
| Ratio caractères lisibles | < 0.7 (70%) | ❌ Illisible |
| Ratio mots lisibles | < 0.5 (50%) | ❌ Illisible |
| Sinon | - | ✅ Lisible |

**Avantages:**
- ✅ Plus permissif que l'ancien système (score < 0.6)
- ✅ Ne pénalise plus la longueur moyenne des mots
- ✅ Ne pénalise plus les caractères spéciaux modérés
- ✅ Textes avec lettres espacées normalisés AVANT le test

---

## 🔄 Tâches en Cours / À Faire

### ⏳ Tâche 1: Améliorer la Détection de Type de Fichier
**Fichier:** `app/api/upload/route.ts`

**À implémenter:**
```typescript
let fileType = file.type;

if (!fileType || fileType === 'application/octet-stream') {
  const extension = file.name.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'pdf':
      fileType = 'application/pdf';
      break;
    case 'docx':
      fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      break;
    // etc.
  }
}
```

---

### ⏳ Tâche 4: Supprimer la Tentative PDF Direct vers Vision
**Fichier:** `lib/openai-fallback.ts`

**À faire:**
- ❌ Supprimer `extractTextWithOpenAIFromPdfDirect()` avec `image_url` PDF
- ❌ Supprimer l'envoi de `data:application/pdf;base64,...` à Vision API
- ✅ Garder uniquement l'approche page-par-page avec images

**Raison:** Vision API n'accepte QUE des images, pas des PDF

---

### ⏳ Tâche 5: Implémenter OCR avec pdfjs-dist + canvas
**Nouveau fichier:** `lib/pdf-ocr-server.ts`

**À créer:**
```typescript
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';
import { extractTextFromImage } from './openai-vision';

export async function extractTextFromPdfWithOCR(buffer: Buffer): Promise<string> {
  // 1. Charger le PDF avec pdfjs-dist
  // 2. Pour chaque page:
  //    - Rendre la page sur un canvas
  //    - Convertir le canvas en image PNG
  //    - Envoyer à Vision OCR
  //    - Collecter le texte
  // 3. Concaténer tous les textes
  // 4. Retourner le résultat
}
```

---

## 🧪 Tests à Effectuer

### Test 1: PDF avec Lettres Espacées (PDF JO)
**Fichier:** `public/test_files/[PDF JO]`

**Texte original:**
```
C  O  U  R  S   I  A  G  G  G  G  G  G  G  G  À  G  G  G  G  G
L é n a ï d e    C  a r c e l
I n f o g r a p h i e
```

**Résultat attendu après normalisation:**
```
COURS IAGGGGGGGGÀGGGGG
Lénaïde Carcel
Infographie
```

**Test:**
```bash
# Uploader le PDF JO
# Vérifier les logs:
# - "🧹 Starting advanced PDF text normalization..."
# - "✅ Normalized length: ..."
# - "📊 Readability check: ✅ READABLE"
# - Pas de fallback Vision activé
```

---

### Test 2: PDF Corrompu (philosophie dragged)
**Fichier:** `public/test_files/philosophie (dragged).pdf`

**Texte extrait (corrompu):**
```
aÈ tÉ )t qdxîé;éqdx. .;, xgqéq-îtxê.N...
```

**Résultat attendu:**
- ❌ Détecté comme illisible
- ✅ Fallback Vision OCR activé
- ✅ Texte correct extrait via OCR

**Test:**
```bash
# Uploader philosophie (dragged).pdf
# Vérifier les logs:
# - "📊 Readability check: ❌ UNREADABLE"
# - "🔄 Activating Vision OCR fallback..."
# - "✅ Vision OCR fallback successful"
```

---

### Test 3: PDF Normal
**Fichiers:**
- `Beginner's guide - Cities_ Skylines Wiki.pdf`
- `Projet bac à sable.pdf`
- `Philosophy 101.pdf`

**Résultat attendu:**
- ✅ Extraction pdf2json réussie
- ✅ Texte lisible
- ❌ Pas de fallback activé

---

## 📊 Comparaison Avant/Après

### Avant la Refonte

| PDF | Méthode | Résultat |
|-----|---------|----------|
| PDF JO (lettres espacées) | pdf2json → score 0.58 → fallback | ❌ Échec fallback |
| philosophie (dragged) | pdf2json → score 0.94 | ❌ Pas détecté comme corrompu |
| PDF normal | pdf2json → score > 0.6 | ✅ OK |

**Problèmes:**
- ❌ PDF JO déclenche fallback inutilement
- ❌ philosophie (dragged) pas détecté comme corrompu
- ❌ Fallback Vision ne fonctionne pas

---

### Après la Refonte (Attendu)

| PDF | Méthode | Résultat |
|-----|---------|----------|
| PDF JO (lettres espacées) | pdf2json + normalisation | ✅ "COURS IAG..." |
| philosophie (dragged) | pdf2json → illisible → OCR | ✅ Texte correct via OCR |
| PDF normal | pdf2json | ✅ OK |

**Améliorations:**
- ✅ PDF JO normalisé, pas de fallback
- ✅ philosophie (dragged) détecté et traité par OCR
- ✅ PDF normaux non affectés

---

## 🚀 Prochaines Étapes

1. **Tester la normalisation actuelle**
   - Uploader le PDF JO
   - Vérifier que "C  O  U  R  S" devient "COURS"
   - Vérifier qu'aucun fallback n'est déclenché

2. **Implémenter Tâche 5 (OCR avec pdfjs-dist)**
   - Créer `lib/pdf-ocr-server.ts`
   - Implémenter le rendu page-par-page
   - Tester avec philosophie (dragged).pdf

3. **Implémenter Tâche 1 (Détection de type)**
   - Modifier `app/api/upload/route.ts`
   - Ajouter fallback sur extension de fichier

4. **Nettoyer Tâche 4**
   - Supprimer le code PDF direct vers Vision
   - Simplifier `lib/openai-fallback.ts`

5. **Tests complets**
   - Tester tous les fichiers de `public/test_files/`
   - Vérifier les logs
   - Documenter les résultats

---

## 📝 Notes Importantes

### Normalisation des Lettres Espacées

**Pattern détecté:**
```
C  O  U  R  S  → COURS (espaces entre majuscules)
i n f o → info (espaces entre minuscules)
L é n a ï d e → Lénaïde (espaces + accents)
```

**Regex utilisée:**
```typescript
// Majuscules: capture lettre + espaces + lookahead autre lettre
/([A-ZÀ-ÿ])(\s{1,3})(?=[A-ZÀ-ÿ](\s{1,3}|[A-ZÀ-ÿ]|$))/g

// Minuscules: même principe avec word boundary
/\b([a-zà-ÿ])(\s{1,2})(?=[a-zà-ÿ](\s{1,2}|$))/g
```

### Seuils de Lisibilité

**Anciens seuils (trop stricts):**
- Score global < 0.6 → illisible
- Pénalités multiples (caractères spéciaux, longueur mots, etc.)

**Nouveaux seuils (plus permissifs):**
- Longueur < 300 → illisible
- Ratio caractères < 0.7 → illisible
- Ratio mots < 0.5 → illisible
- **Pas de pénalités cumulatives**

---

## ✅ Critères de Succès

- [ ] PDF JO ne déclenche plus de fallback
- [ ] PDF JO produit "COURS IAG..." au lieu de "C  O  U  R  S  I  A  G..."
- [ ] philosophie (dragged).pdf déclenche le fallback OCR
- [ ] philosophie (dragged).pdf extrait du texte correct via OCR
- [ ] Tous les PDF normaux fonctionnent sans régression
- [ ] Messages d'erreur clairs pour fichiers inexploitables
