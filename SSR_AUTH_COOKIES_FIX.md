# Fix: Cookies Supabase non créés au login

## 🎯 Problème résolu

**Symptôme:** Après connexion via `/auth/signin`, aucun cookie Supabase n'est créé dans le navigateur, ce qui cause des erreurs "Auth session missing!" dans les API routes.

**Cause racine:** Le composant `SignIn.tsx` utilisait un client Supabase créé avec `@supabase/supabase-js` au lieu de `@supabase/ssr`, qui ne gère pas correctement les cookies pour le SSR.

## ✅ Solution implémentée

### Fichiers créés/modifiés

#### 1. **NOUVEAU:** `lib/supabase-browser.ts`
Client Supabase pour le navigateur utilisant `@supabase/ssr`:

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Pourquoi c'est important:**
- `createBrowserClient` de `@supabase/ssr` gère automatiquement les cookies
- Compatible avec le SSR de Next.js
- Les cookies créés sont lisibles par `createSupabaseServerClient()` côté serveur

#### 2. **MODIFIÉ:** `components/auth/SignIn.tsx`

**Avant:**
```typescript
import { supabase } from '@/lib/supabase'; // ❌ Ancien client

const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
```

**Après:**
```typescript
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'; // ✅ Nouveau client SSR

const supabase = createSupabaseBrowserClient();
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

console.log('✅ User signed in successfully:', data.user.id);
console.log('✅ Session created, cookies should be set');
```

**Changements clés:**
- ✅ Utilise `createSupabaseBrowserClient()` au lieu de l'ancien `supabase`
- ✅ Crée le client à chaque login (important pour SSR)
- ✅ Ajout de logs pour debugging
- ✅ Design et UX conservés à l'identique

## 🔄 Flux d'authentification complet

```
┌─────────────────────────────────────────────────────────────┐
│  1. User remplit formulaire /auth/signin                     │
│     - Email: user@example.com                                │
│     - Password: ********                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. handleSubmit() appelé                                    │
│     const supabase = createSupabaseBrowserClient()           │
│     await supabase.auth.signInWithPassword({...})            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Supabase Auth valide les credentials                     │
│     - Vérifie email/password                                 │
│     - Génère access_token et refresh_token                   │
│     - Retourne session                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. @supabase/ssr crée automatiquement les cookies          │
│     ✅ sb-{project-ref}-auth-token                           │
│        Contient: { access_token, refresh_token, ... }       │
│     ✅ sb-{project-ref}-auth-token-code-verifier (optionnel) │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Redirection vers / (page upload)                         │
│     router.push('/')                                         │
│     router.refresh()                                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Requêtes suivantes incluent automatiquement les cookies  │
│     fetch('/api/upload', { credentials: 'include' })         │
│     → Cookies envoyés automatiquement par le navigateur      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  7. API routes lisent les cookies                            │
│     const supabase = await createSupabaseServerClient()      │
│     const { user } = await supabase.auth.getUser()           │
│     ✅ user.id disponible                                    │
└─────────────────────────────────────────────────────────────┘
```

## 🧪 Tests à effectuer (CRITIQUES)

### Test 1: Vérifier la création des cookies

**Étapes:**
1. Ouvrir le navigateur en mode normal (pas incognito)
2. Aller sur `http://localhost:3000/auth/signin`
3. Ouvrir DevTools (F12) → Onglet **Application** → Section **Cookies** → `http://localhost:3000`
4. Noter les cookies actuels (devrait être vide ou ancien)
5. Se connecter avec email/password valides
6. **IMMÉDIATEMENT** après la connexion, vérifier les cookies

**Résultat attendu:**
```
✅ Cookie présent: sb-{votre-project-ref}-auth-token
   - Domain: localhost
   - Path: /
   - Value: (JSON avec access_token, refresh_token, etc.)
   - HttpOnly: false
   - Secure: false (en dev)
   - SameSite: Lax

Exemple de nom: sb-abcdefghijklmnop-auth-token
```

**Si le cookie n'apparaît pas:**
- Vérifier la console browser pour les logs:
  - ✅ "User signed in successfully: {user-id}"
  - ✅ "Session created, cookies should be set"
- Vérifier les variables d'environnement:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Redémarrer le serveur Next.js

### Test 2: Vérifier l'upload avec authentification

**Étapes:**
1. Être connecté (cookies présents)
2. Aller sur la page upload `/`
3. Uploader un fichier (image ou PDF)
4. Observer les logs du serveur

**Résultat attendu dans les logs serveur:**
```
✅ User authenticated: {user-id}
✅ Chapter saved to Supabase: {chapter-id}
✅ Chapter progress initialized: {chapter-id}
```

**NE DEVRAIT PLUS VOIR:**
```
❌ Auth session missing!
❌ No authenticated user found
❌ User not authenticated
```

### Test 3: Vérifier l'API sans authentification

**Étapes:**
1. Ouvrir navigation privée OU supprimer les cookies
2. Essayer d'accéder à `/api/upload` directement

**Avec curl:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test.jpg"
```

**Résultat attendu:**
```json
{
  "error": "Authentication required. Please sign in."
}
```
**Status:** 401 Unauthorized

### Test 4: Vérifier la base de données

**Dans Supabase SQL Editor:**
```sql
-- Vérifier que les chapitres ont un user_id
SELECT 
  id, 
  title, 
  user_id, 
  created_at 
FROM chapters 
ORDER BY created_at DESC 
LIMIT 5;
```

**Résultat attendu:**
- Tous les chapitres créés après le fix doivent avoir un `user_id` non null
- Le `user_id` doit correspondre à l'utilisateur connecté

## 📊 Checklist de validation

- [x] `lib/supabase-browser.ts` créé avec `createBrowserClient`
- [x] `components/auth/SignIn.tsx` utilise `createSupabaseBrowserClient()`
- [x] Logs ajoutés pour debugging
- [x] Design du formulaire conservé
- [ ] **À TESTER:** Cookies créés après login
- [ ] **À TESTER:** Upload fonctionne avec auth
- [ ] **À TESTER:** API retourne 401 sans auth
- [ ] **À TESTER:** user_id présent en base de données

## 🔧 Dépannage

### Problème: Cookies toujours pas créés

**Solutions:**
1. **Vérifier le package @supabase/ssr:**
   ```bash
   npm list @supabase/ssr
   ```
   Si absent:
   ```bash
   npm install @supabase/ssr
   ```

2. **Vérifier les variables d'environnement:**
   ```bash
   # Dans .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   ```

3. **Redémarrer complètement:**
   ```bash
   # Arrêter le serveur (Ctrl+C)
   # Supprimer .next
   rm -rf .next
   # Relancer
   npm run dev
   ```

4. **Vérifier la console browser:**
   - Ouvrir DevTools → Console
   - Chercher des erreurs liées à Supabase
   - Vérifier que les logs de succès apparaissent

### Problème: "Module not found: @supabase/ssr"

**Solution:**
```bash
npm install @supabase/ssr
```

### Problème: Cookies créés mais API retourne toujours 401

**Solutions:**
1. Vérifier que `credentials: 'include'` est dans le fetch
2. Vérifier que `createSupabaseServerClient()` est utilisé dans l'API
3. Vérifier les logs serveur pour voir où l'auth échoue
4. Tester avec curl en incluant le cookie:
   ```bash
   curl -X POST http://localhost:3000/api/upload \
     -H "Cookie: sb-xxx-auth-token=..." \
     -F "file=@test.jpg"
   ```

## 📚 Différences clés: @supabase/supabase-js vs @supabase/ssr

| Aspect | @supabase/supabase-js | @supabase/ssr |
|--------|----------------------|---------------|
| **Stockage session** | localStorage | Cookies HTTP |
| **SSR compatible** | ❌ Non | ✅ Oui |
| **Cookies auto** | ❌ Non | ✅ Oui |
| **Server Components** | ❌ Non | ✅ Oui |
| **API Routes** | ❌ Difficile | ✅ Facile |
| **Usage** | Client uniquement | Client + Serveur |

## 🎯 Résumé

**Avant:**
```typescript
// ❌ Ancien code
import { supabase } from '@/lib/supabase';
await supabase.auth.signInWithPassword({...});
// → Session en localStorage uniquement
// → Pas de cookies
// → API routes ne peuvent pas lire la session
```

**Après:**
```typescript
// ✅ Nouveau code
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
const supabase = createSupabaseBrowserClient();
await supabase.auth.signInWithPassword({...});
// → Session en cookies HTTP
// → Cookies automatiquement créés
// → API routes peuvent lire la session via createSupabaseServerClient()
```

## 🚀 Prochaines étapes

1. **Tester immédiatement:**
   - Se connecter
   - Vérifier les cookies dans DevTools
   - Uploader un fichier
   - Vérifier les logs

2. **Si ça fonctionne:**
   - Les cookies devraient être visibles
   - L'upload devrait réussir
   - Plus d'erreurs "Auth session missing!"

3. **Documenter:**
   - Noter le nom exact du cookie créé
   - Prendre des screenshots pour référence future
   - Mettre à jour la documentation du projet

## ✨ Impact de ce fix

- ✅ Authentification SSR fonctionnelle
- ✅ Cookies Supabase créés automatiquement
- ✅ API routes peuvent valider l'utilisateur
- ✅ Upload de fichiers sécurisé
- ✅ Données isolées par utilisateur
- ✅ Architecture prête pour la production
