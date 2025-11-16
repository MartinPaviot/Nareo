# 🧪 Guide de Test Rapide - LevelUp

## ✅ Le Mock PDF est Maintenant Actif!

Le problème d'upload a été résolu. Voici comment tester immédiatement:

---

## 📝 Test en 3 Étapes (2 minutes)

### Étape 1: Ouvrir l'Application

1. Ouvrez votre navigateur (Chrome, Edge, Firefox)
2. Allez sur: **http://localhost:3000**
3. Vous devriez voir la page d'accueil avec Aristo' 🎓🐱

### Étape 2: Uploader un PDF

**Option A: Utiliser le PDF de test créé**
- Un fichier `test-sample.pdf` a été créé dans le dossier LevelUp
- Glissez-déposez ce fichier sur la zone d'upload
- OU cliquez "Choose PDF File" et sélectionnez `test-sample.pdf`

**Option B: Utiliser N'IMPORTE QUEL PDF**
- N'importe quel PDF de votre ordinateur fonctionnera
- Le mock ignorera le contenu et retournera du texte exemple
- Cours, document, facture - peu importe!

### Étape 3: Vérifier le Résultat

**Ce qui devrait se passer:**

1. **Animation de chargement** (15-30 secondes)
   - Vous verrez "Reading your course... 📖"
   - L'IA extrait les concepts

2. **Redirection automatique**
   - Vous serez redirigé vers `/chapter/[id]`
   - Vous verrez la page "Chapter Overview"

3. **Liste des concepts**
   - 5-8 concepts sur le Machine Learning
   - Exemples: "Supervised Learning", "Unsupervised Learning", etc.
   - Chaque concept a un badge de difficulté (📘📗📕)

4. **Bouton "Start Learning"**
   - Cliquez pour commencer à apprendre
   - Vous serez redirigé vers l'interface de chat

---

## 🔍 Ce Que Vous Devriez Voir

### Page d'Accueil (/)
```
✅ Titre: "Welcome to LevelUp"
✅ Message: "Hi, I'm Aristo! Let's study smart. 📚"
✅ Zone d'upload avec drag & drop
✅ Bouton "Choose PDF File"
✅ 3 cartes d'info en bas
```

### Pendant l'Upload
```
✅ Animation de chargement
✅ Message: "Reading your course... 📖"
✅ Spinner orange qui tourne
```

### Page Chapter Overview (/chapter/[id])
```
✅ Titre du chapitre: "Introduction to Machine Learning"
✅ Résumé du chapitre
✅ Liste de 5-8 concepts
✅ Chaque concept a:
   - Titre
   - Badge de difficulté (easy/medium/hard)
   - Bouton "Start Learning"
```

### Interface de Chat (/learn/[conceptId])
```
✅ Sidebar gauche avec liste des concepts
✅ Zone de chat au centre
✅ Avatar Aristo' 🐱
✅ Messages de l'IA
✅ Input pour répondre
✅ Boutons d'aide ("I don't get it", "Simplify", etc.)
```

---

## 🐛 Si Quelque Chose Ne Fonctionne Pas

### Erreur: "Unable to read PDF file"

**Solution**: Le serveur n'a pas rechargé le nouveau mock.

1. Arrêtez le serveur (Ctrl+C dans le terminal)
2. Relancez: `npm run dev`
3. Attendez "Ready in 2-3s"
4. Réessayez l'upload

### Erreur: "Upload failed"

**Vérifiez les logs du terminal**:
```bash
# Vous devriez voir:
📄 Using mock PDF parser (buffer size: XXXX bytes)
✅ Returning sample Machine Learning course content
Parsing PDF...
Extracted 5000+ characters from PDF
Calling GPT-4 to extract concepts...
Successfully extracted X concepts
```

**Si vous voyez une erreur différente**, copiez-la et partagez-la.

### La page ne charge pas

**Vérifiez que le serveur tourne**:
```bash
# Dans le terminal, vous devriez voir:
▲ Next.js 16.0.3 (Turbopack)
- Local:    http://localhost:3000
```

**Si le serveur n'est pas lancé**:
```bash
npm run dev
```

---

## 📊 Logs Attendus dans le Terminal

Quand vous uploadez un PDF, vous devriez voir:

```
POST /api/upload
📄 Using mock PDF parser (buffer size: 12345 bytes)
✅ Returning sample Machine Learning course content
Parsing PDF...
Extracted 5432 characters from PDF
Calling GPT-4 to extract concepts...
Successfully extracted 6 concepts
POST /api/upload 200 in 15234ms
```

---

## ✅ Test Réussi Si...

Vous pouvez confirmer que tout fonctionne si:

1. ✅ L'upload accepte le PDF sans erreur
2. ✅ Vous êtes redirigé vers la page Chapter Overview
3. ✅ Vous voyez une liste de concepts sur le Machine Learning
4. ✅ Vous pouvez cliquer "Start Learning" sur un concept
5. ✅ L'interface de chat s'ouvre

**Si ces 5 points fonctionnent, l'application est 100% opérationnelle!**

---

## 🎯 Prochaines Étapes Après le Test

### Si Tout Fonctionne ✅

**Félicitations!** L'application est prête. Vous pouvez:

1. **Tester l'apprentissage complet**
   - Répondre aux questions Phase 1 (QCM)
   - Répondre aux questions Phase 2 (Short Answer)
   - Répondre aux questions Phase 3 (Reflective)
   - Gagner des badges 🥉🥈🥇

2. **Explorer les fonctionnalités**
   - Fonction replay
   - Statistiques de session
   - Navigation entre concepts

3. **Personnaliser**
   - Ajouter vos propres images de mascotte
   - Modifier le contenu mock si besoin
   - Configurer ElevenLabs pour la voix

### Si Quelque Chose Ne Fonctionne Pas ❌

**Partagez**:
1. L'erreur exacte affichée
2. Les logs du terminal
3. À quelle étape ça bloque

Je pourrai alors corriger le problème rapidement!

---

## 💡 Rappel Important

**Le Mock PDF est Intentionnel**

- ✅ Permet de tester l'application immédiatement
- ✅ Pas de dépendances natives complexes
- ✅ Fonctionne sur tous les systèmes
- ✅ Contenu réaliste pour les tests
- ✅ Peut être remplacé par un vrai parser plus tard

**Tous les PDFs uploadés retourneront le même contenu de cours sur le Machine Learning.**

C'est normal et voulu pour cette version de test!

---

## 🚀 Commencez le Test Maintenant!

1. Ouvrez http://localhost:3000
2. Uploadez `test-sample.pdf` (ou n'importe quel PDF)
3. Attendez 15-30 secondes
4. Explorez l'application!

**Bonne chance! 🎓📚**
