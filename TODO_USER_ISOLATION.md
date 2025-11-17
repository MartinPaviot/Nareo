# 📋 TODO: Isolation par Utilisateur

## ✅ Complété (par l'IA)

- [x] Créé le script SQL pour ajouter `user_id` et RLS (`database/add-user-isolation.sql`)
- [x] Créé le guide complet d'isolation (`USER_ISOLATION_GUIDE.md`)
- [x] Créé le guide rapide de setup (`QUICK_USER_ISOLATION_SETUP.md`)
- [x] Documenté tous les changements nécessaires

## 🔧 À Faire (par vous)

### 1. Exécuter le SQL d'Isolation ⏱️ 2 minutes

- [ ] Ouvrir Supabase Dashboard → SQL Editor
- [ ] Copier le contenu de `database/add-user-isolation.sql`
- [ ] Coller et cliquer sur "Run"
- [ ] Vérifier le succès

### 2. Activer l'Authentification ⏱️ 3 minutes

- [ ] Ouvrir Supabase Dashboard → Authentication → Providers
- [ ] Activer Email provider
- [ ] Configurer Site URL: `http://localhost:3000`
- [ ] Configurer Redirect URLs: `http://localhost:3000/**`

### 3. Mettre à Jour memory-store.ts ⏱️ 15-30 minutes

**Modifications nécessaires dans `lib/memory-store.ts`:**

#### A. Ajouter une méthode helper pour obtenir user_id

```typescript
private async getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}
```

#### B. Mettre à jour TOUTES les méthodes qui écrivent dans la DB

**Méthodes à modifier:**

- [ ] `addChapter()` - Ajouter `user_id` dans l'insert
- [ ] `addConcept()` - Ajouter `user_id` dans l'insert
- [ ] `updateProgress()` - Ajouter `user_id` dans l'upsert
- [ ] `addChatMessage()` - Ajouter `user_id` dans l'upsert
- [ ] `initializeChapterProgress()` - Ajouter `user_id` dans l'insert
- [ ] `updateChapterProgress()` - Ajouter `user_id` dans l'upsert
- [ ] `addChapterAnswer()` - Ajouter `user_id` dans l'upsert
- [ ] `setTranslation()` - Ajouter `user_id` dans l'upsert (optionnel)

**Exemple de modification:**

```typescript
// AVANT
async addChapter(chapter: Chapter): Promise<void> {
  const { error } = await supabase.from('chapters').upsert({
    id: chapter.id,
    title: chapter.title,
    // ...
  });
}

// APRÈS
async addChapter(chapter: Chapter): Promise<void> {
  const userId = await this.getUserId();
  if (!userId) throw new Error('User not authenticated');
  
  const { error } = await supabase.from('chapters').upsert({
    id: chapter.id,
    user_id: userId, // ← AJOUTER
    title: chapter.title,
    // ...
  });
}
```

### 4. Tester l'Isolation ⏱️ 10 minutes

- [ ] Créer un compte utilisateur (user1@test.com)
- [ ] Uploader un PDF et créer un cours
- [ ] Se déconnecter
- [ ] Créer un 2ème compte (user2@test.com)
- [ ] Vérifier que le cours de user1 n'est PAS visible
- [ ] Uploader un autre PDF
- [ ] Se reconnecter avec user1
- [ ] Vérifier que seul le cours de user1 est visible

### 5. Nettoyer les Données Existantes ⏱️ 2 minutes

**Option A: Supprimer les données sans user_id (Recommandé)**

```sql
DELETE FROM chapters WHERE user_id IS NULL;
```

**Option B: Assigner à votre compte**

```sql
-- Remplacer 'your-user-id' par votre UUID
UPDATE chapters SET user_id = 'your-user-id' WHERE user_id IS NULL;
UPDATE concepts SET user_id = 'your-user-id' WHERE user_id IS NULL;
UPDATE user_progress SET user_id = 'your-user-id' WHERE user_id IS NULL;
UPDATE chat_history SET user_id = 'your-user-id' WHERE user_id IS NULL;
UPDATE chapter_progress SET user_id = 'your-user-id' WHERE user_id IS NULL;
```

## 📊 Vérification

### Vérifier que RLS est activé:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

Toutes les tables doivent avoir `rowsecurity = true`.

### Vérifier les policies:

```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Vous devriez voir 4 policies par table (SELECT, INSERT, UPDATE, DELETE).

### Vérifier les données par utilisateur:

```sql
SELECT user_id, COUNT(*) as chapter_count 
FROM chapters 
GROUP BY user_id;
```

## 🎯 Résultat Attendu

**Avant:**
- ❌ Tous les utilisateurs voient les mêmes cours
- ❌ Pas d'authentification

**Après:**
- ✅ Chaque utilisateur voit uniquement ses cours
- ✅ Authentification obligatoire
- ✅ Données complètement isolées
- ✅ Impossible de voir/modifier les cours d'autres utilisateurs

## 📚 Documentation

- **Guide rapide:** `QUICK_USER_ISOLATION_SETUP.md`
- **Guide complet:** `USER_ISOLATION_GUIDE.md`
- **Script SQL:** `database/add-user-isolation.sql`

## 🚨 En Cas de Problème

1. **Vérifier que le SQL a été exécuté:** Voir les colonnes `user_id` dans Supabase Table Editor
2. **Vérifier que RLS est activé:** Exécuter la requête de vérification ci-dessus
3. **Vérifier l'authentification:** S'assurer que l'utilisateur est connecté
4. **Consulter les logs:** Vérifier les erreurs dans la console du navigateur

---

**Temps total estimé:** 30-45 minutes

**Priorité:** Haute (nécessaire pour production multi-utilisateurs)
