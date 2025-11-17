# 🚨 URGENT: Fix User Isolation - Data Leak Between Users

## ❌ Problème Identifié

Les utilisateurs voient les cours des autres utilisateurs car:
1. Les tables Supabase **n'ont PAS** de colonne `user_id`
2. Row Level Security (RLS) **n'est PAS activé**
3. Le script `database/add-user-isolation.sql` **n'a jamais été exécuté**

## ✅ Solution Immédiate

### Étape 1: Exécuter le Script SQL dans Supabase

1. **Ouvrez Supabase Dashboard**
   - Allez sur https://supabase.com/dashboard
   - Sélectionnez votre projet

2. **Ouvrez SQL Editor**
   - Dans le menu latéral, cliquez sur "SQL Editor"
   - Cliquez sur "New query"

3. **Copiez et Exécutez le Script**
   - Ouvrez le fichier `database/add-user-isolation.sql`
   - Copiez **TOUT** le contenu
   - Collez dans l'éditeur SQL
   - Cliquez sur "Run" (ou Ctrl+Enter)

4. **Vérifiez le Succès**
   - Vous devriez voir "Success. No rows returned"
   - Aucune erreur ne doit apparaître

### Étape 2: Nettoyer les Données Existantes (IMPORTANT!)

Après avoir exécuté le script, les anciennes données **n'auront pas de user_id** et seront inaccessibles.

**Option A: Supprimer toutes les anciennes données** (Recommandé pour un nouveau départ)

```sql
-- Supprimer toutes les données sans user_id
DELETE FROM translations WHERE user_id IS NULL;
DELETE FROM chapter_progress WHERE user_id IS NULL;
DELETE FROM chat_history WHERE user_id IS NULL;
DELETE FROM user_progress WHERE user_id IS NULL;
DELETE FROM concepts WHERE user_id IS NULL;
DELETE FROM chapters WHERE user_id IS NULL;
```

**Option B: Assigner les données à un utilisateur spécifique**

```sql
-- Remplacez 'YOUR-USER-UUID' par l'UUID de votre utilisateur
-- Vous pouvez le trouver dans: Authentication > Users
UPDATE chapters SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
UPDATE concepts SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
UPDATE user_progress SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
UPDATE chat_history SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
UPDATE chapter_progress SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
```

### Étape 3: Vérifier que RLS est Activé

Exécutez cette requête pour vérifier:

```sql
-- Vérifier que RLS est activé sur toutes les tables
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

Résultat attendu: `rls_enabled` doit être `true` pour toutes les tables.

### Étape 4: Vérifier les Policies

```sql
-- Vérifier que les policies existent
SELECT 
  tablename, 
  policyname, 
  cmd as operation
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Vous devriez voir 4 policies par table (SELECT, INSERT, UPDATE, DELETE).

### Étape 5: Vérifier les Colonnes user_id

```sql
-- Vérifier que user_id existe sur toutes les tables
SELECT 
  table_name, 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name = 'user_id'
ORDER BY table_name;
```

Vous devriez voir `user_id` (type UUID) sur toutes les tables.

## 🧪 Test Après Migration

### Test 1: Créer un Nouveau Compte

1. Déconnectez-vous
2. Créez un nouveau compte (SignUp)
3. Vous devriez voir **0 cours** dans le dashboard
4. ✅ **SUCCÈS** si vous ne voyez aucun cours des autres utilisateurs

### Test 2: Upload un Cours

1. Uploadez un nouveau document
2. Le cours devrait apparaître dans votre dashboard
3. Déconnectez-vous et reconnectez-vous avec un autre compte
4. ✅ **SUCCÈS** si l'autre compte ne voit PAS ce cours

### Test 3: Vérifier l'Ancien Compte

1. Reconnectez-vous avec votre ancien compte
2. Vous devriez voir uniquement VOS cours
3. ✅ **SUCCÈS** si vous ne voyez pas les cours des autres

## 🔍 Debugging

Si après la migration vous avez toujours des problèmes:

### Vérifier qu'un chapitre a bien un user_id

```sql
SELECT id, title, user_id 
FROM chapters 
LIMIT 5;
```

Si `user_id` est NULL, c'est que le chapitre a été créé avant la migration.

### Vérifier l'authentification dans les logs

Dans votre console Next.js, vous devriez voir:
```
✅ User authenticated (SSR): <user-id>
📝 Inserting chapter with user_id: <user-id>
```

Si vous voyez `⚠️ No user ID`, c'est un problème d'authentification.

## 📋 Checklist Complète

- [ ] Script `add-user-isolation.sql` exécuté dans Supabase
- [ ] RLS activé sur toutes les tables (vérification SQL)
- [ ] Policies créées (vérification SQL)
- [ ] Colonnes `user_id` ajoutées (vérification SQL)
- [ ] Anciennes données nettoyées ou assignées
- [ ] Test avec nouveau compte: 0 cours visible ✅
- [ ] Test upload: cours visible uniquement pour le créateur ✅
- [ ] Test multi-utilisateurs: isolation complète ✅

## ⚠️ Important

**NE PAS** désactiver RLS après l'avoir activé! Cela exposerait toutes les données à tous les utilisateurs.

Si vous avez besoin d'accéder aux données pour du debugging, utilisez le Supabase Dashboard (Table Editor) qui a les permissions admin.

## 🎯 Résultat Final

Après avoir suivi ces étapes:
- ✅ Chaque utilisateur voit uniquement SES cours
- ✅ Pas de fuite de données entre utilisateurs
- ✅ RLS protège automatiquement toutes les requêtes
- ✅ Le code existant continue de fonctionner (déjà compatible)

## 📞 Support

Si vous rencontrez des erreurs lors de l'exécution du script SQL:
1. Copiez l'erreur complète
2. Vérifiez que vous êtes bien connecté à votre projet Supabase
3. Vérifiez que les tables existent déjà (créées par `supabase-schema.sql`)
