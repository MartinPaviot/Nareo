# 🔧 Fix: Environment Variables Error

## ❌ Problème Identifié

L'erreur `supabaseUrl is required` apparaît car vos variables d'environnement dans `.env.local` n'ont pas le bon préfixe pour Next.js.

## 📝 Solution

### Étape 1: Ouvrir `.env.local`

Ouvrez votre fichier `.env.local` et modifiez les noms des variables.

### Étape 2: Renommer les Variables

**❌ AVANT (Incorrect):**
```env
SUPABASE_URL=https://iilvyfdhsbsnsmubpsn.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

**✅ APRÈS (Correct):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://iilvyfdhsbsnsmubpsn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

### Étape 3: Fichier .env.local Complet

Votre fichier `.env.local` devrait ressembler à ceci:

```env
# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: ElevenLabs (for voice synthesis - not required for basic functionality)
# ELEVENLABS_API_KEY=your_elevenlabs_api_key
# ELEVENLABS_VOICE_ID=your_voice_id_for_aristo

#SUPABASE
NEXT_PUBLIC_SUPABASE_URL=https://iilvyfdhsbsnsmubpsn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbHZ5ZmRoc2JzbnNtdWJwc24iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNzU2NzI5NiwiZXhwIjoyMDUzMTQzMjk2fQ.evJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbHZ5ZmRoc2JzbnNtdWJwc24iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNzU2NzI5NiwiZXhwIjoyMDUzMTQzMjk2fQ
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbHZ5ZmRoc2JzbnNtdWJwc24iLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzM3NTY3Mjk2LCJleHAiOjIwNTMxNDMyOTZ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbHZ5ZmRoc2JzbnNtdWJwc24iLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzM3NTY3Mjk2LCJleHAiOjIwNTMxNDMyOTZ9
```

### Étape 4: Redémarrer le Serveur

Après avoir modifié `.env.local`, vous DEVEZ redémarrer le serveur de développement:

```bash
# Arrêter le serveur (Ctrl+C dans le terminal)
# Puis redémarrer:
npm run dev
```

## 🔍 Pourquoi ce Changement?

Dans Next.js:
- **`NEXT_PUBLIC_*`** = Variables accessibles côté client (navigateur)
- **Sans préfixe** = Variables accessibles uniquement côté serveur

Le code Supabase s'exécute côté client, donc il a besoin du préfixe `NEXT_PUBLIC_`.

## ✅ Vérification

Après avoir fait ces changements et redémarré le serveur:

1. Ouvrez http://localhost:3000
2. Vous devriez voir la page de connexion (pas d'erreur)
3. L'erreur "supabaseUrl is required" devrait disparaître

## 📋 Checklist

- [ ] Renommer `SUPABASE_URL` → `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Renommer `SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Garder `SUPABASE_SERVICE_ROLE_KEY` sans préfixe (utilisé côté serveur uniquement)
- [ ] Sauvegarder le fichier `.env.local`
- [ ] Redémarrer le serveur avec `npm run dev`
- [ ] Vérifier que l'application charge sans erreur

## 🆘 Si le Problème Persiste

1. Vérifiez qu'il n'y a pas d'espaces avant ou après les valeurs
2. Vérifiez que les clés Supabase sont complètes (pas tronquées)
3. Essayez de vider le cache du navigateur (Ctrl+Shift+R)
4. Vérifiez la console du navigateur pour d'autres erreurs
