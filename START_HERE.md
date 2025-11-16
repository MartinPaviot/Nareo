# 🚀 START HERE - LevelUp Quick Start

## ⚡ Prêt à Utiliser Immédiatement!

### ✅ Configuration Automatique avec Blackbox AI

L'application est **déjà configurée** pour utiliser l'API Blackbox AI! Aucune clé API supplémentaire n'est nécessaire.

Le fichier `.env.local` a été créé automatiquement avec la configuration Blackbox.

### 🎯 Démarrage en 2 Étapes

#### Étape 1: Le Serveur Tourne Déjà! ✅

Votre serveur de développement est actif sur: **http://localhost:3000**

Ouvrez simplement votre navigateur et allez-y!

#### Étape 2: Uploadez un PDF et Commencez à Apprendre

1. **Ouvrez** http://localhost:3000
2. **Uploadez** un fichier PDF de cours (glissez-déposez ou cliquez pour sélectionner)
3. **Attendez** 15-30 secondes que l'IA extraie les concepts
4. **Commencez à apprendre** avec Aristo', votre tuteur IA!

---

## 📚 Ce Que Vous Pouvez Faire

### ✅ Fonctionnalités Actives

- **Upload de cours PDF** - N'importe quel PDF éducatif
- **Extraction de concepts par IA** - GPT-4 via Blackbox identifie les concepts clés
- **Apprentissage interactif** - Chattez avec Aristo' à travers 3 phases:
  - Phase 1: Questions à Choix Multiples (+10 pts)
  - Phase 2: Questions à Réponse Courte (+30 pts)
  - Phase 3: Questions Réflexives (+60 pts)
- **Système de scoring** - Gagnez jusqu'à 100 points par concept
- **Badges** - 🥉 Bronze (60+), 🥈 Argent (80+), 🥇 Or (100)
- **Suivi de progression** - Voyez vos scores en temps réel
- **Rejouez les concepts** - Réessayez pour améliorer votre score

### ⚠️ Limitations (Version Démo)

- **Pas de persistance** - Les données sont réinitialisées au redémarrage du serveur
- **Pas d'authentification** - Un seul utilisateur
- **Pas de voix** - Texte uniquement (la voix nécessite des clés API supplémentaires)
- **Images de mascotte** - Affiche des emojis en attendant que vous ajoutiez des fichiers PNG

---

## 🎯 Testez le Flux Complet

### Test Rapide (5 minutes)

1. Uploadez un PDF court (2-3 pages)
2. Complétez un concept à travers les 3 phases
3. Vérifiez votre score et badge

### Test Complet (20 minutes)

1. Uploadez un chapitre complet en PDF
2. Complétez 3 concepts différents
3. Essayez la fonction de rejeu
4. Consultez le récapitulatif de session

---

## 🐛 Dépannage

### "Failed to parse PDF"
- Assurez-vous que le PDF contient du texte extractible (pas des images scannées)
- Essayez un autre fichier PDF

### "API Error" ou "Network Error"
- Vérifiez que le serveur tourne (terminal doit afficher "Ready")
- Rafraîchissez la page du navigateur
- Vérifiez la console du navigateur (F12) pour plus de détails

### "404 for mascot images"
- C'est normal! L'application utilise des emojis de remplacement
- Pour ajouter de vraies images, voir `public/mascot/README.md`

### Le serveur ne répond pas
- Vérifiez le terminal pour les erreurs
- Redémarrez avec: `npm run dev`

---

## 📖 Documentation

- **QUICK_START_NO_DB.md** - Guide de configuration détaillé
- **TESTING_CHECKLIST.md** - Guide de test complet
- **CHANGES_SUMMARY.md** - Ce qui a été construit et pourquoi
- **README_SIMPLIFIED.md** - Documentation complète du projet

---

## 🎓 Exemples de PDFs à Essayer

Les bons PDFs de test doivent avoir:
- Structure claire de chapitre/section
- Contenu éducatif
- 2-10 pages (pour des tests rapides)
- Basé sur du texte (pas des images scannées)

Exemples:
- Notes de cours
- Chapitres de manuels
- Guides d'étude
- Documents de tutoriels

---

## 💡 Conseils pour de Meilleurs Résultats

1. **Utilisez des PDFs bien structurés** - Titres et sections clairs
2. **Commencez petit** - Testez d'abord avec des documents de 2-3 pages
3. **Soyez précis dans vos réponses** - L'IA évalue en fonction de la compréhension
4. **Essayez différentes approches** - Rejouez les concepts pour voir les variations
5. **Vérifiez la console** - Ouvrez les DevTools du navigateur (F12) pour voir les logs

---

## 🎉 Vous Êtes Prêt!

L'application est **entièrement fonctionnelle** et prête à être testée!

**État Actuel:**
- ✅ Serveur en cours d'exécution sur http://localhost:3000
- ✅ Toutes les APIs fonctionnent
- ✅ Frontend responsive
- ✅ Configuration Blackbox AI active

**Prochaine Étape:** Commencez à uploader des PDFs et à apprendre!

---

## 🔧 Configuration Technique

### API Blackbox AI
L'application utilise l'API Blackbox AI comme proxy pour OpenAI GPT-4:
- **Base URL**: https://api.blackbox.ai/v1
- **Modèle**: gpt-4o
- **Configuration**: Automatique via `.env.local`

### Pas Besoin de:
- ❌ Clé API OpenAI personnelle
- ❌ Configuration de base de données
- ❌ Compte Supabase
- ❌ Clés API supplémentaires (sauf pour la voix)

---

## 🆘 Besoin d'Aide?

1. Vérifiez le terminal pour les messages d'erreur
2. Ouvrez la console du navigateur (F12) pour les erreurs frontend
3. Consultez les fichiers de documentation listés ci-dessus
4. Vérifiez que votre fichier `.env.local` existe

**Bon Apprentissage! 🚀**
