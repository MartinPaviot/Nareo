# 🧪 Guide de Test - Upload Robuste

## 🎯 Objectif

Tester le système d'upload amélioré avec les 4 fichiers de test pour valider :
- La détection de type de fichier
- L'extraction de texte (PDF/DOCX)
- Le fallback OpenAI si nécessaire
- La validation de qualité du texte
- La génération de chapitres et questions

---

## 📋 Fichiers de Test

Les fichiers suivants doivent être dans `public/test_files/` :

1. ✅ **Beginner's guide - Cities_ Skylines Wiki.pdf**
2. ✅ **Projet bac à sable.pdf**
3. ✅ **Presentation Alter coloc Nov2024.docx**
4. ⏳ **Philosophy 101.pdf** (si disponible)

---

## 🚀 Méthode 1 : Test Automatisé (Recommandé)

### Étape 1 : Préparer l'environnement

```bash
# S'assurer que les dépendances sont installées
npm install

# Vérifier que les fichiers de test existent
ls public/test_files/
```

### Étape 2 : Exécuter le script de test

```bash
npx ts-node scripts/test-upload-robustness.ts
```

### Étape 3 : Analyser les résultats

Le script affichera pour chaque fichier :
- ✅ Succès ou ❌ Échec
- Temps d'extraction
- Nombre de caractères, mots, phrases
- Preview du texte extrait
- Raison de l'échec (si applicable)

**Résultat attendu :**
```
🚀 Starting Upload Robustness Tests

================================================================================
📄 Testing: Beginner's guide - Cities_ Skylines Wiki.pdf
================================================================================
✅ File loaded: 123456 bytes
⏱️  Parsing took: 2.34 seconds
📝 Extracted text length: 5432 characters
✅ Validation PASSED: 5432 characters

📊 Text Statistics:
   Characters: 5432
   Words: 987
   Sentences: 45
   Lines: 123

[... autres fichiers ...]

================================================================================
📊 TEST SUMMARY
================================================================================

✅ Successful: 4/4
❌ Failed: 0/4

🎉 All tests passed! The upload system is robust.
```

---

## 🖱️ Méthode 2 : Test Manuel via l'Interface

### Étape 1 : Démarrer l'application

```bash
npm run dev
```

Ouvrir http://localhost:3000

### Étape 2 : Se connecter

1. Créer un compte ou se connecter
2. Aller sur la page d'accueil

### Étape 3 : Tester chaque fichier

Pour chaque fichier de test :

#### A. Upload du fichier

1. Cliquer sur "Upload" ou glisser-déposer le fichier
2. Observer les logs dans la console du navigateur (F12)
3. Observer les logs dans le terminal du serveur

#### B. Vérifications

**Pendant l'upload :**
- ✅ Le fichier est accepté (pas d'erreur de type)
- ✅ Un spinner/loader s'affiche
- ✅ Pas d'erreur dans la console

**Après l'upload :**
- ✅ Redirection vers la page de quiz
- ✅ 3 chapitres créés (Easy, Medium, Hard)
- ✅ 5 questions par chapitre
- ✅ Le contenu est pertinent par rapport au fichier

#### C. Logs à vérifier

**Dans le terminal du serveur :**

```
📄 Processing file upload: test.pdf (123456 bytes) Type: application/pdf
📄 Parsing PDF document (buffer size: 123456 bytes)
✅ pdf2json extraction successful: 5432 characters
✅ Text validation passed: 5432 characters
🤖 Analyzing document text with AI...
✅ Successfully extracted 5 concepts from document
📚 Creating 3 chapters with 5 questions each...
🎉 Successfully created 3 chapters with questions!
```

**Si fallback OpenAI utilisé :**

```
⚠️ pdf2json extracted insufficient text: Text too short: 45 characters
🔄 Attempting OpenAI fallback...
🤖 Using OpenAI to extract text from PDF...
✅ OpenAI fallback successful: 3456 characters
```

---

## 📊 Checklist de Test

### Test 1 : Beginner's guide - Cities_ Skylines Wiki.pdf

- [ ] Fichier accepté
- [ ] Extraction réussie (pdf2json ou OpenAI)
- [ ] Texte > 300 caractères
- [ ] 3 chapitres créés
- [ ] 15 questions générées (5 par chapitre)
- [ ] Contenu pertinent sur Cities: Skylines
- [ ] Temps d'extraction < 10 secondes

**Notes :**
```
Résultat : ✅ / ❌
Méthode d'extraction : pdf2json / OpenAI
Caractères extraits : _____
Temps : _____ secondes
Problèmes rencontrés : _____
```

---

### Test 2 : Projet bac à sable.pdf

- [ ] Fichier accepté
- [ ] Extraction réussie (pdf2json ou OpenAI)
- [ ] Texte > 300 caractères
- [ ] Support du français
- [ ] 3 chapitres créés
- [ ] 15 questions générées
- [ ] Contenu pertinent
- [ ] Temps d'extraction < 10 secondes

**Notes :**
```
Résultat : ✅ / ❌
Méthode d'extraction : pdf2json / OpenAI
Caractères extraits : _____
Temps : _____ secondes
Problèmes rencontrés : _____
```

---

### Test 3 : Presentation Alter coloc Nov2024.docx

- [ ] Fichier accepté
- [ ] Extraction réussie (mammoth ou OpenAI)
- [ ] Texte > 300 caractères
- [ ] Support du français
- [ ] 3 chapitres créés
- [ ] 15 questions générées
- [ ] Contenu pertinent
- [ ] Temps d'extraction < 10 secondes

**Notes :**
```
Résultat : ✅ / ❌
Méthode d'extraction : mammoth / OpenAI
Caractères extraits : _____
Temps : _____ secondes
Problèmes rencontrés : _____
```

---

### Test 4 : Philosophy 101.pdf (si disponible)

- [ ] Fichier accepté
- [ ] Extraction réussie (pdf2json ou OpenAI)
- [ ] Texte > 300 caractères
- [ ] 3 chapitres créés
- [ ] 15 questions générées
- [ ] Contenu pertinent sur la philosophie
- [ ] Temps d'extraction < 15 secondes (fichier plus long)

**Notes :**
```
Résultat : ✅ / ❌
Méthode d'extraction : pdf2json / OpenAI
Caractères extraits : _____
Temps : _____ secondes
Problèmes rencontrés : _____
```

---

## 🔍 Tests de Cas Limites

### Test 5 : Fichier avec type MIME manquant

**Objectif :** Vérifier la détection par extension

**Procédure :**
1. Renommer un fichier PDF en .pdf.txt puis en .pdf
2. L'uploader
3. Vérifier que le type est détecté correctement

**Logs attendus :**
```
⚠️ File type is empty or generic, detecting from extension...
✅ Detected file type from extension: application/pdf
```

- [ ] Type détecté correctement
- [ ] Extraction réussie

---

### Test 6 : Fichier non supporté

**Objectif :** Vérifier le rejet des types non supportés

**Procédure :**
1. Essayer d'uploader un fichier .txt, .zip, ou .exe
2. Vérifier l'erreur

**Erreur attendue :**
```
Unsupported file type: application/zip
Please upload an image (JPG, PNG, GIF, WebP) or document (PDF, DOCX)
```

- [ ] Fichier rejeté
- [ ] Message d'erreur clair

---

### Test 7 : PDF vide ou corrompu

**Objectif :** Vérifier la gestion des fichiers invalides

**Procédure :**
1. Créer un fichier PDF vide ou corrompu
2. L'uploader
3. Vérifier l'erreur

**Erreur attendue :**
```
Insufficient text extracted from document
Text too short: 0 characters (minimum: 300)
The document may be empty, image-based, or encrypted.
```

- [ ] Erreur détectée
- [ ] Message d'erreur explicite avec suggestion

---

## 📈 Critères de Succès

### ✅ Succès Total

- Tous les fichiers de test passent
- Extraction de texte réussie (pdf2json/mammoth ou OpenAI)
- Validation de texte réussie (>300 chars, >3 phrases, >50 mots)
- 3 chapitres créés pour chaque fichier
- 15 questions générées (5 par chapitre)
- Contenu pertinent et cohérent
- Temps d'extraction raisonnable (<10s par fichier)

### ⚠️ Succès Partiel

- 3/4 fichiers passent
- Fallback OpenAI utilisé fréquemment
- Temps d'extraction long (>15s)
- Quelques erreurs de validation

**Action :** Ajuster les seuils de validation ou améliorer les parseurs

### ❌ Échec

- Moins de 2/4 fichiers passent
- Erreurs fréquentes
- Fallback OpenAI échoue
- Contenu non pertinent

**Action :** Débugger les parseurs et le fallback OpenAI

---

## 🐛 Debugging

### Si un test échoue

1. **Vérifier les logs du serveur**
   - Quelle méthode d'extraction a été utilisée ?
   - Quel est le message d'erreur exact ?
   - Combien de caractères ont été extraits ?

2. **Vérifier le fichier**
   - Le fichier est-il corrompu ?
   - Le fichier contient-il du texte extractible ?
   - Le fichier est-il trop court ?

3. **Tester manuellement l'extraction**
   ```bash
   # Tester l'extraction PDF
   npx ts-node -e "
   import { parsePDF } from './lib/pdf-parser';
   import * as fs from 'fs';
   const buffer = fs.readFileSync('public/test_files/test.pdf');
   parsePDF(buffer).then(text => console.log(text));
   "
   ```

4. **Vérifier la clé API OpenAI**
   ```bash
   # Vérifier que la clé est définie
   echo $OPENAI_API_KEY
   ```

5. **Consulter les logs détaillés**
   - Activer le mode debug si nécessaire
   - Vérifier les erreurs dans la console du navigateur

---

## 📝 Rapport de Test

### Résumé

Date : ___________
Testeur : ___________

**Résultats :**
- Fichiers testés : _____ / 4
- Succès : _____ / _____
- Échecs : _____ / _____
- Taux de réussite : _____%

**Méthodes d'extraction utilisées :**
- pdf2json : _____ fois
- mammoth : _____ fois
- OpenAI fallback : _____ fois

**Temps moyen d'extraction :**
- PDF : _____ secondes
- DOCX : _____ secondes

**Problèmes rencontrés :**
```
1. _____
2. _____
3. _____
```

**Recommandations :**
```
1. _____
2. _____
3. _____
```

---

## ✅ Validation Finale

- [ ] Tous les tests passent
- [ ] Les logs sont clairs et informatifs
- [ ] Les erreurs sont bien gérées
- [ ] Les messages d'erreur sont explicites
- [ ] Le fallback OpenAI fonctionne
- [ ] La validation de texte est efficace
- [ ] Les performances sont acceptables
- [ ] Le système est prêt pour la production

**Signature :** ___________
**Date :** ___________

---

## 🚀 Prochaines Étapes

Après validation des tests :

1. [ ] Déployer en staging
2. [ ] Tester en staging avec de vrais utilisateurs
3. [ ] Monitorer les logs et les erreurs
4. [ ] Ajuster les seuils si nécessaire
5. [ ] Déployer en production
6. [ ] Monitorer les métriques de succès

---

## 📚 Ressources

- **Documentation complète :** `UPLOAD_ROBUSTNESS_IMPLEMENTATION_COMPLETE.md`
- **Architecture technique :** `ARCHITECTURE_UPLOAD_EXTRACTION_COMPLETE.md`
- **Script de test :** `scripts/test-upload-robustness.ts`
- **Code source :**
  - `lib/openai-fallback.ts`
  - `lib/pdf-parser.ts`
  - `lib/document-parser.ts`
  - `app/api/upload/route.ts`
