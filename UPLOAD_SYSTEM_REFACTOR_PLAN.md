# 🔧 Refonte Complète du Système d'Upload - Plan d'Action

## 🎯 Objectif

Créer un système d'upload robuste et simple qui :
- ✅ Traite correctement tous les fichiers de test
- ✅ Utilise pdf2json comme parseur principal
- ✅ Active le fallback OCR Vision uniquement pour les vrais PDF scannés
- ✅ Normalise les textes avec lettres espacées (ex: "C  O  U  R  S")
- ✅ Ne casse pas les PDF qui fonctionnaient avant

---

## 🐛 Problèmes Identifiés

### 1. **Score de lisibilité trop strict**
- Texte avec lettres espacées "C  O  U  R  S" marqué comme illisible
- Score 0.58 déclenche le fallback alors que le texte est exploitable
- Longueur moyenne des mots < 4 pénalise trop

### 2. **Fallback Vision cassé**
- Tentative d'envoyer `data:application/pdf` à Vision API → **IMPOSSIBLE**
- Vision API accepte uniquement des images
- pdf-to-img échoue avec "DOMMatrix is not defined"

### 3. **Normalisation insuffisante**
- Textes avec lettres espacées non regroupés
- Espaces multiples non compressés correctement
- Caractères de contrôle non supprimés

### 4. **Détection de type fragile**
- Certains fichiers ont `file.type` vide ou "application/octet-stream"
- Pas de fallback sur l'extension du fichier

---

## 📋 Tâches à Réaliser

### ✅ Tâche 1: Améliorer la détection de type de fichier

**Fichier:** `app/api/upload/route.ts`

**Changements:**
```typescript
// Si file.type est vide ou générique, déduire du nom de fichier
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
    case 'doc':
      fileType = 'application/msword';
      break;
    case 'jpg':
    case 'jpeg':
      fileType = 'image/jpeg';
      break;
    case 'png':
      fileType = 'image/png';
      break;
    // etc.
  }
}
```

---

### ✅ Tâche 2: Normalisation avancée du texte PDF

**Fichier:** `lib/pdf-parser.ts`

**Nouvelle fonction:** `cleanAndNormalizePdfText(text: string): string`

**Étapes:**

1. **Supprimer les caractères de contrôle**
   ```typescript
   text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
   ```

2. **Détecter et regrouper les lettres espacées**
   ```typescript
   // Détecter "C  O  U  R  S" → "COURS"
   // Pattern: lettre + espaces + lettre + espaces...
   text = text.replace(/([A-ZÀ-Ÿ])\s+(?=[A-ZÀ-Ÿ](\s|$))/g, '$1');
   text = text.replace(/([a-zà-ÿ])\s+(?=[a-zà-ÿ](\s|$))/g, '$1');
   ```

3. **Compresser les espaces multiples**
   ```typescript
   text = text.replace(/[ \t]+/g, ' ');
   ```

4. **Normaliser les retours à la ligne**
   ```typescript
   text = text.replace(/\n{3,}/g, '\n\n');
   ```

5. **Nettoyer les lignes vides**
   ```typescript
   const lines = text.split('\n')
     .map(line => line.trim())
     .filter(line => line.length > 0);
   text = lines.join('\n');
   ```

---

### ✅ Tâche 3: Redéfinir la logique de détection d'illisibilité

**Fichier:** `lib/pdf-parser.ts`

**Nouvelle logique:**

```typescript
function isTextUnreadable(text: string): boolean {
  const length = text.length;
  
  // 1. Texte trop court
  if (length < 300) {
    return true;
  }
  
  // 2. Calculer les ratios
  const readableCharsRatio = calculateReadableCharsRatio(text);
  const readableWordsRatio = calculateReadableWordsRatio(text);
  
  // 3. Texte clairement corrompu
  if (readableCharsRatio < 0.7) {
    return true;
  }
  
  if (readableWordsRatio < 0.5) {
    return true;
  }
  
  // 4. Sinon, considérer comme lisible
  return false;
}
```

**Seuils:**
- `length < 300` → illisible
- `readableCharsRatio < 0.7` → illisible
- `readableWordsRatio < 0.5` → illisible
- Sinon → **lisible** (même si score global ~0.5-0.6)

---

### ✅ Tâche 4: Supprimer la tentative PDF direct vers Vision

**Fichier:** `lib/openai-fallback.ts`

**Supprimer:**
- Tout le code qui envoie `data:application/pdf;base64,...` à Vision API
- La fonction `extractTextWithOpenAIFromPdfDirect()` avec image_url

**Raison:** Vision API n'accepte QUE des images, pas des PDF

---

### ✅ Tâche 5: Implémenter un vrai fallback OCR avec pdfjs-dist

**Nouveau fichier:** `lib/pdf-ocr-server.ts`

**Approche:**

1. **Utiliser pdfjs-dist en mode legacy pour Node.js**
   ```typescript
   import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
   ```

2. **Configurer le worker correctement**
   ```typescript
   pdfjsLib.GlobalWorkerOptions.workerSrc = 
     'pdfjs-dist/legacy/build/pdf.worker.mjs';
   ```

3. **Utiliser canvas pour Node.js**
   ```bash
   npm install canvas
   ```

4. **Rendre chaque page en image**
   ```typescript
   const canvas = createCanvas(viewport.width, viewport.height);
   const context = canvas.getContext('2d');
   await page.render({ canvasContext: context, viewport }).promise;
   const imageBuffer = canvas.toBuffer('image/png');
   ```

5. **Envoyer chaque image à Vision OCR**
   ```typescript
   const base64Image = imageBuffer.toString('base64');
   const imageDataUrl = `data:image/png;base64,${base64Image}`;
   const text = await extractTextFromImage(imageDataUrl);
   ```

---

## 🔄 Flux de Traitement Révisé

```
┌─────────────────────────────────────────────────────────────┐
│                    Upload PDF                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Détection de type améliorée                     │
│  • Vérifier file.type                                        │
│  • Si vide/générique → déduire de l'extension               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Extraction avec pdf2json                           │
│  • Extraction brute du texte                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│      Normalisation avancée du texte                          │
│  • Supprimer caractères de contrôle                          │
│  • Regrouper lettres espacées "C O U R S" → "COURS"        │
│  • Compresser espaces multiples                              │
│  • Normaliser retours à la ligne                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         Test d'illisibilité (logique simplifiée)             │
│  • length < 300 ? → illisible                                │
│  • readableCharsRatio < 0.7 ? → illisible                   │
│  • readableWordsRatio < 0.5 ? → illisible                   │
│  • Sinon → LISIBLE                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    │ Lisible?│
                    └────┬────┘
                         │
        ┌────────────────┼────────────────┐
        │                                 │
    ✅ LISIBLE                      ❌ ILLISIBLE
        │                                 │
        ▼                                 ▼
┌──────────────┐              ┌──────────────────────┐
│ Retour texte │              │  Fallback OCR Vision │
│  normalisé   │              │  (pdfjs-dist+canvas) │
└──────────────┘              └──────────┬───────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │ Rendu page → image   │
                              │ Vision OCR → texte   │
                              │ Concaténation pages  │
                              └──────────┬───────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │   Validation texte   │
                              │   (≥ 300 chars)      │
                              └──────────────────────┘
```

---

## 📦 Dépendances Nécessaires

```bash
npm install canvas pdfjs-dist
```

**Packages:**
- `canvas`: Rendu Canvas côté serveur pour Node.js
- `pdfjs-dist`: Bibliothèque PDF.js de Mozilla

---

## 🧪 Tests Attendus

### Fichiers de Test:

1. ✅ **Beginner's guide - Cities_ Skylines Wiki.pdf**
   - Texte normal
   - Doit passer avec pdf2json uniquement

2. ✅ **Philosophy 101.pdf**
   - Texte normal
   - Doit passer avec pdf2json uniquement

3. ✅ **Projet bac à sable.pdf**
   - Texte normal
   - Doit passer avec pdf2json uniquement

4. ✅ **PDF JO (cours avec lettres espacées)**
   - Texte: "C  O  U  R  S  I  A  G..."
   - Doit être normalisé en "COURS IAG..."
   - Doit passer avec pdf2json uniquement (pas de fallback)

5. ✅ **philosophie (dragged).pdf**
   - Texte corrompu: "aÈ tÉ )t qdxîé;éqdx..."
   - Doit déclencher le fallback OCR Vision
   - Doit extraire le texte correct via OCR

6. ✅ **Presentation Alter coloc Nov2024.docx**
   - Document Word
   - Doit passer avec mammoth

---

## 📝 Résultats Attendus

| Fichier | Méthode | Résultat |
|---------|---------|----------|
| Cities Skylines PDF | pdf2json | ✅ Texte extrait |
| Philosophy 101 PDF | pdf2json | ✅ Texte extrait |
| Projet bac à sable PDF | pdf2json | ✅ Texte extrait |
| PDF JO (lettres espacées) | pdf2json + normalisation | ✅ "COURS IAG..." |
| philosophie (dragged).pdf | OCR Vision fallback | ✅ Texte correct via OCR |
| Alter coloc DOCX | mammoth | ✅ Texte extrait |

---

## 🚀 Ordre d'Implémentation

1. ✅ Tâche 1: Détection de type améliorée
2. ✅ Tâche 2: Normalisation avancée du texte
3. ✅ Tâche 3: Nouvelle logique d'illisibilité
4. ✅ Tâche 4: Supprimer PDF direct vers Vision
5. ✅ Tâche 5: Implémenter OCR avec pdfjs-dist + canvas
6. ✅ Tests complets avec tous les fichiers

---

## ✅ Critères de Succès

- [ ] Tous les fichiers de test s'uploadent sans erreur
- [ ] PDF JO ne déclenche plus de fallback inutile
- [ ] philosophie (dragged).pdf utilise le fallback OCR et extrait du texte correct
- [ ] Aucun PDF fonctionnel n'est cassé
- [ ] Messages d'erreur clairs pour les fichiers réellement inexploitables
