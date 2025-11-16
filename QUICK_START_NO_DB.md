# 🚀 Démarrage Rapide - LevelUp (Sans Base de Données)

Cette version utilise un stockage en mémoire au lieu de Supabase, ce qui vous permet de tester l'application immédiatement!

## ✅ Prérequis

Vous avez seulement besoin de:
- **Node.js** (v18 ou supérieur)
- **Une clé API OpenAI** (pour l'extraction de concepts et le chat AI)

## 📝 Configuration en 3 Étapes

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configurer la clé API OpenAI

Créez un fichier `.env.local` à la racine du projet:

```env
OPENAI_API_KEY=votre_clé_api_openai_ici
```

**Comment obtenir une clé OpenAI:**
1. Allez sur https://platform.openai.com/api-keys
2. Créez un compte ou connectez-vous
3. Cliquez sur "Create new secret key"
4. Copiez la clé et collez-la dans `.env.local`

### 3. Lancer l'application

```bash
npm run dev
```

Ouvrez http://localhost:3000 dans votre navigateur! 🎉

## 🎯 Comment Tester

### Test 1: Upload d'un PDF
1. Préparez un PDF de cours (n'importe quel document éducatif)
2. Sur la page d'accueil, cliquez sur "Choose PDF File" ou glissez-déposez votre PDF
3. Attendez que l'AI analyse le document (15-30 secondes)
4. Vous serez redirigé vers la page de vue d'ensemble du chapitre

### Test 2: Apprentissage Interactif
1. Cliquez sur "Start Learning Now"
2. Répondez aux questions de la Phase 1 (QCM)
3. Passez à la Phase 2 (Réponse courte)
4. Terminez avec la Phase 3 (Réflexion)
5. Gagnez des badges selon vos scores! 🏆

### Test 3: Fonctionnalités du Chat
- Utilisez les boutons rapides: "I don't get it", "Simplify", "Give example"
- Observez Aristo' (le chat mascotte) changer d'expression
- Suivez votre progression en temps réel

## 📊 Système de Scoring

- **Phase 1 (QCM)**: +10 points
- **Phase 2 (Réponse courte)**: +30 points  
- **Phase 3 (Réflexion)**: +60 points
- **Total maximum**: 100 points par concept

### Badges
- 🥉 **Bronze**: ≥60 points
- 🥈 **Silver**: ≥80 points
- 🥇 **Gold**: 100 points

## ⚠️ Limitations de la Version en Mémoire

Cette version utilise un stockage temporaire en mémoire, ce qui signifie:

- ✅ **Fonctionne**: Toutes les fonctionnalités principales
- ❌ **Ne persiste pas**: Les données sont perdues au redémarrage du serveur
- ❌ **Pas de multi-utilisateurs**: Une seule session à la fois
- ❌ **Pas de voix**: Les fonctionnalités vocales nécessitent des clés API supplémentaires

## 🔧 Dépannage

### Erreur: "Failed to process PDF"
- Vérifiez que votre clé OpenAI est correcte dans `.env.local`
- Assurez-vous que le PDF n'est pas trop volumineux (< 10 MB recommandé)
- Vérifiez que le PDF contient du texte (pas juste des images)

### Erreur: "Module not found"
```bash
npm install
```

### Le serveur ne démarre pas
```bash
# Supprimez node_modules et réinstallez
rm -rf node_modules
npm install
npm run dev
```

### Les styles ne s'affichent pas correctement
```bash
# Reconstruisez les styles Tailwind
npm run dev
```

## 🎨 Images de la Mascotte (Optionnel)

Pour voir Aristo' avec des animations:

1. Créez le dossier `public/mascot/`
2. Ajoutez ces images (format PNG recommandé):
   - `mascotte.png` - État par défaut
   - `Processing.png` - En train de réfléchir
   - `Talking.png` - En train de parler
   - `Happy.png` - Réponse correcte
   - `Disappointed.png` - Besoin d'aide
   - `adcdebda.png` - Succès/Trophée

Si vous n'avez pas les images, l'application utilisera des emojis à la place! 🎓🐱

## 📚 Prochaines Étapes

Une fois que vous avez testé l'application:

1. **Pour la production**: Configurez Supabase pour la persistance des données
2. **Pour la voix**: Ajoutez les clés API Whisper et ElevenLabs
3. **Pour le déploiement**: Suivez `DEPLOYMENT_CHECKLIST.md`

## 💡 Conseils

- **Testez avec différents types de PDFs**: cours de maths, histoire, sciences, etc.
- **Essayez différentes réponses**: L'AI s'adapte à votre niveau
- **Explorez les phases**: Chaque phase teste différentes compétences
- **Regardez les badges**: Motivez-vous à obtenir l'or! 🥇

## 🆘 Besoin d'Aide?

Si vous rencontrez des problèmes:
1. Vérifiez la console du navigateur (F12)
2. Vérifiez les logs du terminal
3. Assurez-vous que `.env.local` est correctement configuré
4. Redémarrez le serveur de développement

---

**Bon apprentissage avec LevelUp! 🚀📚**
