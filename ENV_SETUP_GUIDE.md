# 🔐 Configuration .env.local - Guide Complet

## ⚠️ Problème Actuel

L'erreur "Error processing PDF content" indique probablement que:
1. L'API Blackbox AI n'est pas configurée correctement
2. OU la clé API est manquante/invalide
3. OU le baseURL n'est pas correct

---

## ✅ Configuration Requise

Votre fichier `.env.local` doit contenir:

```bash
# OpenAI / Blackbox AI Configuration
OPENAI_API_KEY=votre_cle_blackbox_ici

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🔍 Comment Vérifier Votre Configuration

### Étape 1: Ouvrez `.env.local`

Le fichier est à la racine du projet: `c:/Users/marti/LevelUp/.env.local`

### Étape 2: Vérifiez la Clé API

**Option A: Vous utilisez Blackbox AI**
```bash
OPENAI_API_KEY=votre_cle_blackbox
```

**Option B: Vous utilisez OpenAI directement**
```bash
OPENAI_API_KEY=sk-...votre_cle_openai...
```

**Option C: Pas de clé API (Mode Fallback)**
```bash
# Laissez vide ou commentez
# OPENAI_API_KEY=
```

### Étape 3: Vérifiez que le serveur a rechargé

Après modification du `.env.local`:
1. Arrêtez le serveur (Ctrl+C)
2. Relancez: `npm run dev`
3. Attendez "Ready in X.Xs"

---

## 🎯 Solutions Selon Votre Situation

### Situation 1: Vous AVEZ une clé Blackbox AI ✅

**Configuration recommandée**:
```bash
OPENAI_API_KEY=votre_cle_blackbox_reelle
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Fichier `lib/openai.ts` doit avoir**:
```typescript
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'blackbox-api-key',
  baseURL: 'https://api.blackbox.ai/v1',
});
```

**Test**: L'API devrait fonctionner et extraire les concepts intelligemment.

---

### Situation 2: Vous N'AVEZ PAS de clé API (Mode Fallback) ✅

**Configuration**:
```bash
# Pas de clé API - le fallback s'activera automatiquement
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Ce qui se passe**:
1. L'API Blackbox échouera (normal)
2. Le système de fallback s'activera automatiquement
3. Les concepts seront extraits du texte ou générés par défaut
4. L'application fonctionnera quand même!

**Logs attendus**:
```
📡 Calling GPT-4 to extract concepts...
❌ Error calling GPT-4 API: [erreur réseau/auth]
⚠️ Using fallback concept extraction...
📝 Extracting concepts from text structure (fallback mode)
✅ Extracted 5 concepts using fallback method
```

---

### Situation 3: Vous utilisez OpenAI directement

**Configuration**:
```bash
OPENAI_API_KEY=sk-proj-...votre_cle_openai...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Modification requise dans `lib/openai.ts`**:
```typescript
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Supprimez ou commentez la ligne baseURL
  // baseURL: 'https://api.blackbox.ai/v1',
});
```

---

## 🔧 Correction Rapide - 3 Options

### Option A: Mode Fallback (Recommandé pour tester)

**Avantages**:
- ✅ Fonctionne immédiatement
- ✅ Pas besoin de clé API
- ✅ Concepts ML réalistes générés
- ✅ Permet de tester toute l'app

**Action**:
1. Ouvrez `.env.local`
2. Commentez ou supprimez la ligne `OPENAI_API_KEY`
3. Sauvegardez
4. Redémarrez le serveur: `npm run dev`
5. Retestez l'upload

**Résultat**: Le fallback s'activera et retournera 5 concepts ML par défaut.

---

### Option B: Utiliser Blackbox AI (Si vous avez la clé)

**Action**:
1. Ouvrez `.env.local`
2. Ajoutez: `OPENAI_API_KEY=votre_cle_blackbox`
3. Sauvegardez
4. Redémarrez: `npm run dev`
5. Retestez

**Résultat**: L'API Blackbox extraira les concepts intelligemment.

---

### Option C: Utiliser OpenAI directement

**Action**:
1. Ouvrez `.env.local`
2. Ajoutez: `OPENAI_API_KEY=sk-...`
3. Modifiez `lib/openai.ts` (supprimez baseURL)
4. Redémarrez: `npm run dev`
5. Retestez

---

## 🧪 Test de Diagnostic

Pour vérifier quelle configuration vous avez:

### Test 1: Vérifier si la clé existe

Ouvrez le terminal et tapez:
```bash
echo %OPENAI_API_KEY%
```

**Si vide**: Pas de clé configurée → Mode fallback s'activera
**Si "blackbox-api-key"**: Clé par défaut → API échouera, fallback s'activera
**Si commence par "sk-"**: Clé OpenAI → Devrait fonctionner si baseURL est supprimé
**Si autre chose**: Clé Blackbox → Devrait fonctionner

### Test 2: Vérifier les logs du serveur

Quand vous uploadez un PDF, regardez le terminal:

**Logs avec API qui fonctionne**:
```
📡 Calling GPT-4 to extract concepts...
✅ Successfully extracted 6 concepts
```

**Logs avec fallback (normal si pas de clé)**:
```
📡 Calling GPT-4 to extract concepts...
❌ Error calling GPT-4 API: ...
⚠️ Using fallback concept extraction...
✅ Extracted 5 concepts using fallback method
```

---

## 💡 Recommandation

**Pour tester l'application MAINTENANT**:

1. **Utilisez le mode fallback** (pas besoin de clé API)
2. Le système est conçu pour fonctionner avec ou sans API
3. Vous aurez 5 concepts ML réalistes
4. Toute l'application sera testable

**Configuration minimale**:
```bash
# .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

C'est tout! Le fallback fera le reste.

---

## 🚀 Actions Immédiates

### Si vous voulez tester MAINTENANT avec le fallback:

```bash
# 1. Arrêtez le serveur
Ctrl+C

# 2. Vérifiez que .env.local existe
dir .env.local

# 3. Si pas de clé API, c'est parfait! Relancez:
npm run dev

# 4. Attendez "Ready"
# 5. Uploadez un PDF à http://localhost:3000
```

Le fallback s'activera automatiquement et l'application fonctionnera!

---

## ❓ Questions Fréquentes

**Q: Le fallback est-il suffisant pour tester?**
R: Oui! Il génère 5 concepts ML réalistes avec définitions et key ideas.

**Q: Puis-je passer au vrai API plus tard?**
R: Oui, ajoutez juste la clé dans .env.local et redémarrez.

**Q: Pourquoi l'API échoue?**
R: Plusieurs raisons possibles:
- Pas de clé configurée
- Clé invalide
- Problème réseau
- baseURL incorrect pour OpenAI

**Q: Le fallback affecte-t-il les autres fonctionnalités?**
R: Non, seule l'extraction de concepts utilise le fallback. Le chat et les questions ont aussi leurs propres fallbacks.

---

## 📞 Besoin d'Aide?

Partagez-moi:
1. Le contenu de votre `.env.local` (sans la clé complète, juste les 5 premiers caractères)
2. Les logs du terminal quand vous uploadez un PDF
3. L'erreur exacte affichée dans le navigateur

Je pourrai alors vous aider précisément!
