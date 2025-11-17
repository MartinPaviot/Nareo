# SSR Authentication Fix - Implementation Complete

## 🎯 Problème résolu

**Erreur initiale:**
```
SSR auth error: Auth session missing!
⚠️ No authenticated user found
❌ Error saving chapter: Error: User not authenticated
```

**Cause:** L'architecture d'authentification utilisait un parsing manuel des cookies et des tokens, ce qui ne fonctionnait pas correctement avec `@supabase/ssr` dans les API routes Next.js.

## ✅ Solution implémentée

### Architecture finale

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Browser)                          │
│  - AuthContext utilise supabase client                      │
│  - Cookies Supabase créés au login                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP Request avec cookies
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Route (/api/upload)                     │
│  1. requireAuth(request) ──────────────────────┐            │
│                                                 │            │
│  2. authenticateRequest() ──────────────────┐  │            │
│     - createSupabaseServerClient()          │  │            │
│     - Lit cookies via next/headers          │  │            │
│     - supabase.auth.getUser()              │  │            │
│     - Retourne { user: { id, email } }     │  │            │
│                                             │  │            │
│  3. Si auth OK: user.id disponible ────────┘  │            │
│     Si auth KO: return 401 ───────────────────┘            │
│                                                              │
│  4. memoryStore.addChapter(chapter, user.id)                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Database                         │
│  - Données enregistrées avec user_id                        │
│  - RLS policies appliquées                                  │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Fichiers modifiés

### 1. `lib/supabase-server.ts`
**Changements:**
- ✅ Fonction renommée: `createClient()` → `createSupabaseServerClient()`
- ✅ Utilise `@supabase/ssr` avec `createServerClient()`
- ✅ Gestion correcte des cookies via `next/headers`
- ✅ Fonction `async` pour supporter Next.js 15

**Code clé:**
```typescript
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}
```

### 2. `lib/api-auth.ts`
**Changements:**
- ❌ **SUPPRIMÉ:** Parsing manuel des cookies
- ❌ **SUPPRIMÉ:** Extraction manuelle de l'access_token
- ❌ **SUPPRIMÉ:** Création de client avec headers Authorization
- ❌ **SUPPRIMÉ:** Logs "No access token found in request"
- ✅ **AJOUTÉ:** Utilisation de `createSupabaseServerClient()`
- ✅ **SIMPLIFIÉ:** Interface `AuthenticatedRequest` (plus de `supabase` dans le retour)

**Code clé:**
```typescript
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthenticatedRequest | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.warn('⚠️ Auth error: Auth session missing!');
      return null;
    }
    
    return {
      user: {
        id: user.id,
        email: user.email ?? undefined,
      },
    };
  } catch (error) {
    console.error('❌ Auth error:', error);
    return null;
  }
}
```

### 3. `lib/memory-store.ts`
**Changements:**
- ✅ Import mis à jour: `createSupabaseServerClient` au lieu de `createClient`
- ✅ Toutes les méthodes acceptent un paramètre optionnel `userId?: string`
- ✅ Méthode `getUserId()` utilise `createSupabaseServerClient()`

**Code clé:**
```typescript
private async getUserId(providedUserId?: string): Promise<string | null> {
  if (providedUserId) {
    return providedUserId;
  }
  
  try {
    const serverClient = await createSupabaseServerClient();
    const { data: { user }, error } = await serverClient.auth.getUser();
    
    if (user?.id) {
      return user.id;
    }
    
    // Fallback to regular client for client-side
    const { data: { user: clientUser } } = await supabase.auth.getUser();
    return clientUser?.id || null;
  } catch (error) {
    return null;
  }
}
```

### 4. `app/api/upload/route.ts`
**Changements:**
- ✅ Déjà configuré correctement avec `requireAuth()`
- ✅ Passe `user.id` à toutes les méthodes du memory store

**Code clé:**
```typescript
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (isErrorResponse(authResult)) {
    return authResult;
  }
  
  const { user } = authResult;
  
  // ... traitement du fichier ...
  
  await memoryStore.addChapter(chapter, user.id);
  await memoryStore.initializeChapterProgress(chapterId, user.id);
  await memoryStore.addConcept(concept, user.id);
}
```

### 5. `app/page.tsx`
**Changements:**
- ✅ Déjà configuré avec `AuthGuard` pour protection côté client
- ✅ Fetch avec `credentials: 'include'` pour envoyer les cookies

## 🔒 Flux d'authentification

### 1. Login (côté client)
```typescript
// Dans AuthContext ou page de login
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});

// Supabase crée automatiquement les cookies:
// - sb-{project-ref}-auth-token
// - sb-{project-ref}-auth-token-code-verifier
```

### 2. Requête API (côté serveur)
```typescript
// 1. Browser envoie automatiquement les cookies
fetch('/api/upload', {
  method: 'POST',
  body: formData,
  credentials: 'include' // Important!
});

// 2. API route lit les cookies
const supabase = await createSupabaseServerClient();
// createServerClient lit automatiquement les cookies via next/headers

// 3. Validation de l'utilisateur
const { data: { user } } = await supabase.auth.getUser();
// Supabase valide le token dans le cookie

// 4. Utilisation du user.id
await memoryStore.addChapter(chapter, user.id);
```

## 🧪 Tests à effectuer

### Test 1: Connexion et cookies
```bash
1. Aller sur /auth/signin
2. Se connecter avec email/password
3. Ouvrir DevTools > Application > Cookies
4. Vérifier la présence de:
   - sb-{project-ref}-auth-token
   - Valeur: JSON avec access_token, refresh_token, etc.
```

### Test 2: Upload authentifié
```bash
1. Être connecté
2. Aller sur la page upload (/)
3. Uploader un fichier
4. Vérifier dans les logs du serveur:
   ✅ "User authenticated: {user-id}"
   ✅ "Chapter saved to Supabase: {chapter-id}"
   ❌ PAS de "Auth session missing!"
5. Vérifier dans Supabase que le chapitre a un user_id
```

### Test 3: Upload non authentifié
```bash
1. Ouvrir navigation privée OU se déconnecter
2. Essayer d'accéder à /
   → Devrait rediriger vers /auth/signin (AuthGuard)
3. Essayer un POST direct sur /api/upload (via curl):
   curl -X POST http://localhost:3000/api/upload
   → Devrait retourner 401 avec message "Authentication required"
```

### Test 4: Vérification base de données
```sql
-- Dans Supabase SQL Editor
SELECT id, title, user_id, created_at 
FROM chapters 
ORDER BY created_at DESC 
LIMIT 5;

-- Vérifier que user_id est bien rempli
```

## 🚀 Commandes de test

### Test manuel avec curl
```bash
# Sans authentification (devrait retourner 401)
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test.jpg"

# Avec authentification (nécessite un cookie valide)
# Récupérer le cookie depuis DevTools après login
curl -X POST http://localhost:3000/api/upload \
  -H "Cookie: sb-xxx-auth-token=..." \
  -F "file=@test.jpg"
```

### Vérifier les logs
```bash
# Dans le terminal où Next.js tourne
# Chercher ces messages:
✅ "User authenticated: {user-id}"
✅ "Chapter saved to Supabase: {chapter-id}"

# Ne devrait PLUS voir:
❌ "No access token found in request"
❌ "Auth session missing!"
❌ "User not authenticated"
```

## 📊 Checklist de validation

- [x] `lib/supabase-server.ts` utilise `@supabase/ssr` correctement
- [x] `lib/api-auth.ts` n'a plus de parsing manuel de cookies
- [x] `lib/memory-store.ts` utilise `createSupabaseServerClient()`
- [x] `/api/upload` utilise `requireAuth()` et passe `user.id`
- [x] Page upload protégée par `AuthGuard`
- [ ] **À TESTER:** Login crée des cookies Supabase
- [ ] **À TESTER:** Upload fonctionne avec authentification
- [ ] **À TESTER:** Upload échoue sans authentification (401)
- [ ] **À TESTER:** Données enregistrées avec user_id correct

## 🔧 Dépannage

### Problème: "Auth session missing!" persiste
**Solutions:**
1. Vérifier que les cookies Supabase sont présents dans DevTools
2. Vérifier que `credentials: 'include'` est dans le fetch
3. Vérifier les variables d'environnement:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Redémarrer le serveur Next.js

### Problème: Cookies non créés au login
**Solutions:**
1. Vérifier que le login utilise le bon client Supabase
2. Vérifier que `@supabase/ssr` est installé
3. Vérifier la configuration du client dans `AuthContext`

### Problème: 401 même connecté
**Solutions:**
1. Vérifier que les cookies sont envoyés (Network tab)
2. Vérifier que `createSupabaseServerClient()` est bien appelé
3. Vérifier les logs serveur pour voir où l'auth échoue

## 📚 Ressources

- [Supabase SSR Documentation](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Next.js Cookies API](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [@supabase/ssr Package](https://www.npmjs.com/package/@supabase/ssr)

## ✨ Prochaines étapes

1. **Tester l'implémentation** selon les tests ci-dessus
2. **Vérifier les autres API routes** qui pourraient avoir besoin d'authentification
3. **Ajouter des tests automatisés** pour l'authentification
4. **Documenter le flux** pour les nouveaux développeurs
