# 🔐 Guide d'Isolation par Utilisateur

## 📋 Problème Actuel

**Actuellement:** Tous les utilisateurs voient les mêmes cours (données partagées globalement).

**Solution:** Ajouter l'isolation par utilisateur avec Supabase Auth + Row Level Security (RLS).

## ✅ Ce qui sera changé

Après cette migration:
- ✅ Chaque utilisateur voit **uniquement ses propres cours**
- ✅ Les données sont **complètement isolées** entre utilisateurs
- ✅ Impossible de voir ou modifier les cours d'autres utilisateurs
- ✅ Authentification requise pour accéder à l'application

## 🚀 Étapes d'Implémentation

### Étape 1: Activer Supabase Auth (5 minutes)

1. **Ouvrir Supabase Dashboard** → Authentication → Providers
2. **Activer Email Provider:**
   - Enable Email provider: ✅
   - Confirm email: ✅ (recommandé)
   - Secure email change: ✅ (recommandé)

3. **Configurer les URLs de redirection:**
   - Site URL: `http://localhost:3000` (développement)
   - Redirect URLs: `http://localhost:3000/**`

4. **Optionnel - Activer d'autres providers:**
   - Google OAuth
   - GitHub OAuth
   - etc.

### Étape 2: Exécuter le SQL d'Isolation (2 minutes)

1. **Ouvrir Supabase Dashboard** → SQL Editor
2. **Copier le contenu de** `database/add-user-isolation.sql`
3. **Coller et cliquer sur "Run"**
4. **Vérifier le succès** (devrait voir "Success. No rows returned")

**Ce script fait:**
- ✅ Ajoute `user_id` à toutes les tables
- ✅ Crée des index pour performance
- ✅ Active Row Level Security (RLS)
- ✅ Crée des policies pour isolation

### Étape 3: Mettre à Jour memory-store.ts (Déjà fait partiellement)

Le code actuel utilise déjà Supabase, mais nous devons ajouter `user_id` à toutes les opérations.

**Modifications nécessaires:**

```typescript
// Avant (sans user_id)
await supabase.from('chapters').insert({
  id: chapter.id,
  title: chapter.title,
  // ...
});

// Après (avec user_id)
const { data: { user } } = await supabase.auth.getUser();
await supabase.from('chapters').insert({
  id: chapter.id,
  user_id: user?.id,
  title: chapter.title,
  // ...
});
```

### Étape 4: Tester l'Isolation (10 minutes)

1. **Créer 2 comptes utilisateurs:**
   - User 1: test1@example.com
   - User 2: test2@example.com

2. **Tester avec User 1:**
   - Se connecter
   - Uploader un PDF
   - Vérifier que le cours apparaît

3. **Tester avec User 2:**
   - Se déconnecter de User 1
   - Se connecter avec User 2
   - Vérifier que les cours de User 1 ne sont **PAS visibles**
   - Uploader un autre PDF
   - Vérifier que seul ce nouveau cours apparaît

4. **Revenir à User 1:**
   - Se déconnecter de User 2
   - Se reconnecter avec User 1
   - Vérifier que seuls les cours de User 1 sont visibles

## 🔍 Vérification dans Supabase

### Vérifier que RLS est activé:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

Toutes les tables doivent avoir `rowsecurity = true`.

### Vérifier les policies:

```sql
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public';
```

Vous devriez voir des policies pour SELECT, INSERT, UPDATE, DELETE sur chaque table.

### Vérifier les données par utilisateur:

```sql
-- Voir tous les chapitres avec leur user_id
SELECT id, title, user_id, created_at 
FROM chapters 
ORDER BY created_at DESC;

-- Compter les chapitres par utilisateur
SELECT user_id, COUNT(*) as chapter_count 
FROM chapters 
GROUP BY user_id;
```

## 🛡️ Sécurité

### Ce qui est protégé:

✅ **Lecture:** Un utilisateur ne peut voir que ses propres données
✅ **Écriture:** Un utilisateur ne peut créer que des données liées à son compte
✅ **Modification:** Un utilisateur ne peut modifier que ses propres données
✅ **Suppression:** Un utilisateur ne peut supprimer que ses propres données

### Cascade Deletes:

Quand un utilisateur supprime un chapitre:
1. Le chapitre est supprimé
2. Tous les concepts liés sont supprimés (CASCADE)
3. Toute la progression est supprimée (CASCADE)
4. L'historique de chat est supprimé (CASCADE)

Quand un utilisateur supprime son compte:
1. Toutes ses données sont automatiquement supprimées (CASCADE)

## 📊 Impact sur les Performances

### Indexes créés:

```sql
-- Index simples sur user_id
idx_chapters_user
idx_concepts_user
idx_user_progress_user
idx_chat_history_user
idx_chapter_progress_user
idx_translations_user

-- Index composites pour requêtes courantes
idx_chapters_user_order (user_id, order_index)
idx_concepts_user_chapter (user_id, chapter_id)
```

**Impact:** Les requêtes restent rapides même avec des milliers d'utilisateurs.

## 🔄 Migration des Données Existantes

### Option 1: Supprimer les données existantes (Recommandé)

```sql
-- Supprimer toutes les données sans user_id
DELETE FROM chapters WHERE user_id IS NULL;
```

### Option 2: Assigner à un utilisateur spécifique

```sql
-- Assigner toutes les données existantes à un utilisateur
UPDATE chapters SET user_id = 'uuid-de-l-utilisateur' WHERE user_id IS NULL;
UPDATE concepts SET user_id = 'uuid-de-l-utilisateur' WHERE user_id IS NULL;
-- etc.
```

### Option 3: Laisser inaccessible

Les données sans `user_id` resteront dans la base mais seront inaccessibles via RLS.

## 🧪 Tests Recommandés

### Test 1: Isolation des Données

```typescript
// User 1 crée un cours
const user1 = await signIn('user1@test.com');
const chapter1 = await createChapter('Course 1');

// User 2 ne doit PAS voir le cours de User 1
const user2 = await signIn('user2@test.com');
const chapters = await getAllChapters();
expect(chapters).not.toContain(chapter1);
```

### Test 2: Cascade Delete

```typescript
// User 1 crée un cours avec progression
const chapter = await createChapter('Test');
await answerQuestions(chapter.id);

// Supprimer le cours
await deleteChapter(chapter.id);

// Vérifier que la progression est aussi supprimée
const progress = await getChapterProgress(chapter.id);
expect(progress).toBeNull();
```

### Test 3: Tentative d'Accès Non Autorisé

```typescript
// User 1 crée un cours
const user1Chapter = await createChapter('Private Course');

// User 2 essaie d'accéder au cours de User 1
const user2 = await signIn('user2@test.com');
const chapter = await getChapter(user1Chapter.id);
expect(chapter).toBeNull(); // Ne doit pas être accessible
```

## 🚨 Dépannage

### Problème: "Row Level Security policy violation"

**Cause:** L'utilisateur n'est pas authentifié ou essaie d'accéder aux données d'un autre utilisateur.

**Solution:**
1. Vérifier que l'utilisateur est connecté: `await supabase.auth.getUser()`
2. Vérifier que `user_id` est bien passé dans les requêtes
3. Vérifier que les policies RLS sont correctement configurées

### Problème: Aucune donnée visible après migration

**Cause:** Les données existantes n'ont pas de `user_id`.

**Solution:**
```sql
-- Vérifier les données sans user_id
SELECT COUNT(*) FROM chapters WHERE user_id IS NULL;

-- Option 1: Supprimer
DELETE FROM chapters WHERE user_id IS NULL;

-- Option 2: Assigner à votre compte
UPDATE chapters SET user_id = auth.uid() WHERE user_id IS NULL;
```

### Problème: Performance lente

**Cause:** Index manquants ou requêtes non optimisées.

**Solution:**
```sql
-- Vérifier que les index existent
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' AND indexname LIKE '%user%';

-- Analyser les requêtes lentes
EXPLAIN ANALYZE SELECT * FROM chapters WHERE user_id = 'uuid';
```

## 📈 Prochaines Étapes

Après avoir activé l'isolation par utilisateur:

1. ✅ **Tester avec plusieurs comptes**
2. ✅ **Vérifier les performances**
3. ✅ **Configurer les emails de confirmation** (optionnel)
4. ✅ **Ajouter la récupération de mot de passe** (optionnel)
5. ✅ **Configurer OAuth providers** (Google, GitHub, etc.) (optionnel)

## 🎯 Résumé

**Avant:**
- ❌ Tous les utilisateurs voient les mêmes cours
- ❌ Pas d'authentification requise
- ❌ Données partagées globalement

**Après:**
- ✅ Chaque utilisateur voit uniquement ses cours
- ✅ Authentification obligatoire
- ✅ Données complètement isolées
- ✅ Sécurité renforcée avec RLS
- ✅ Prêt pour production multi-utilisateurs

---

**Questions?** Consultez la documentation Supabase:
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
