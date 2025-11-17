# 🧪 Guide de Test - Isolation Utilisateur

## 📋 Objectif

Vérifier que l'isolation utilisateur fonctionne correctement et que chaque utilisateur ne voit que ses propres projets.

---

## ✅ Prérequis

Avant de commencer les tests, assurez-vous que :

- [ ] Le script SQL `database/enable-user-isolation.sql` a été exécuté
- [ ] Le serveur de développement est démarré (`npm run dev`)
- [ ] Supabase Auth est configuré et fonctionnel
- [ ] Vous avez accès au Supabase Dashboard

---

## 🚀 Étape 1: Vérification dans Supabase

### 1.1 Vérifier que RLS est activé

Ouvrir **Supabase Dashboard → SQL Editor** et exécuter :

```sql
SELECT 
    tablename, 
    rowsecurity as "RLS Activé"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('chapters', 'concepts', 'user_progress', 'chat_history', 'chapter_progress', 'translations')
ORDER BY tablename;
```

**Résultat attendu :** Toutes les tables doivent avoir `RLS Activé = true`

| tablename | RLS Activé |
|-----------|------------|
| chapters | true |
| chapter_progress | true |
| chat_history | true |
| concepts | true |
| translations | true |
| user_progress | true |

### 1.2 Vérifier les policies

```sql
SELECT 
    tablename as "Table", 
    policyname as "Policy",
    cmd as "Opération"
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

**Résultat attendu :** 24 policies au total (4 par table)

- Chaque table doit avoir 4 policies : SELECT, INSERT, UPDATE, DELETE
- Toutes les policies doivent contenir "own" dans leur nom

### 1.3 Vérifier les colonnes user_id

```sql
SELECT 
    table_name as "Table",
    column_name as "Colonne",
    data_type as "Type"
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND column_name = 'user_id'
ORDER BY table_name;
```

**Résultat attendu :** 6 tables avec colonne `user_id` de type `uuid`

---

## 👥 Étape 2: Test avec Utilisateur 1

### 2.1 Créer le premier compte

1. Ouvrir http://localhost:3000
2. Cliquer sur **Sign Up** (ou S'inscrire)
3. Créer un compte :
   - Email : `user1@test.com`
   - Mot de passe : `Test1234!`
4. Se connecter avec ce compte

### 2.2 Uploader un projet

1. Sur la page d'accueil, cliquer sur **Upload** ou glisser un fichier
2. Sélectionner un fichier PDF de test (par exemple `test-course.txt` ou un PDF)
3. Attendre le traitement (30-60 secondes)
4. Vérifier que le chapitre apparaît sur le dashboard

**✅ Succès si :**
- Le fichier est uploadé sans erreur
- Le chapitre apparaît sur le dashboard
- Aucune erreur dans la console

### 2.3 Vérifier dans Supabase

Ouvrir **Supabase Dashboard → Table Editor → chapters** :

```sql
SELECT id, title, user_id, created_at 
FROM chapters 
ORDER BY created_at DESC 
LIMIT 5;
```

**✅ Succès si :**
- Le chapitre créé est visible
- La colonne `user_id` est remplie avec un UUID
- Le `user_id` correspond à l'utilisateur connecté

**💡 Astuce :** Pour obtenir votre user_id, exécutez :
```sql
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
```

### 2.4 Noter les informations

**Informations à noter pour User 1 :**
- User ID : `_____________________`
- Chapitre créé : `_____________________`
- Nombre de chapitres : `_____`

---

## 👥 Étape 3: Test avec Utilisateur 2

### 3.1 Se déconnecter de User 1

1. Cliquer sur l'avatar/profil en haut à droite
2. Cliquer sur **Sign Out** (ou Se déconnecter)
3. Vérifier que vous êtes bien déconnecté

### 3.2 Créer le deuxième compte

1. Sur la page de connexion, cliquer sur **Sign Up**
2. Créer un nouveau compte :
   - Email : `user2@test.com`
   - Mot de passe : `Test1234!`
3. Se connecter avec ce compte

### 3.3 Vérifier l'isolation

**🎯 TEST CRITIQUE :**

Sur le dashboard de User 2, vous devez voir :
- ✅ **AUCUN chapitre** (dashboard vide)
- ✅ **PAS les chapitres de User 1**

**❌ Si vous voyez les chapitres de User 1 :**
- Le RLS n'est pas activé correctement
- Retourner à l'Étape 1 et vérifier la configuration

### 3.4 Uploader un projet pour User 2

1. Uploader un **autre** fichier PDF
2. Attendre le traitement
3. Vérifier que le nouveau chapitre apparaît

**✅ Succès si :**
- Le nouveau chapitre apparaît
- Seul ce chapitre est visible (pas ceux de User 1)

### 3.5 Vérifier dans Supabase

```sql
SELECT 
    c.id,
    c.title,
    c.user_id,
    u.email as user_email
FROM chapters c
LEFT JOIN auth.users u ON c.user_id = u.id
ORDER BY c.created_at DESC;
```

**✅ Succès si :**
- Vous voyez 2 chapitres (un par utilisateur)
- Chaque chapitre a un `user_id` différent
- Les emails correspondent aux bons utilisateurs

---

## 👥 Étape 4: Test de Retour à User 1

### 4.1 Se reconnecter avec User 1

1. Se déconnecter de User 2
2. Se reconnecter avec `user1@test.com`

### 4.2 Vérifier l'isolation inverse

**🎯 TEST CRITIQUE :**

Sur le dashboard de User 1, vous devez voir :
- ✅ **Uniquement les chapitres de User 1**
- ✅ **PAS les chapitres de User 2**

**✅ Succès si :**
- Seuls les chapitres créés par User 1 sont visibles
- Le nombre de chapitres correspond à ce qui a été créé par User 1

---

## 🔒 Étape 5: Tests de Sécurité Avancés

### 5.1 Test d'accès direct par URL

**Avec User 1 connecté :**

1. Noter l'ID d'un chapitre de User 2 depuis Supabase
2. Essayer d'accéder directement : `http://localhost:3000/study-plan/[chapter-id-user2]`

**✅ Succès si :**
- Erreur 404 ou redirection
- Impossible d'accéder au chapitre de User 2

### 5.2 Test d'accès API direct

**Avec User 1 connecté :**

Ouvrir la console du navigateur et exécuter :

```javascript
// Remplacer CHAPTER_ID_USER2 par l'ID d'un chapitre de User 2
fetch('/api/chapters/CHAPTER_ID_USER2')
  .then(r => r.json())
  .then(console.log);
```

**✅ Succès si :**
- Erreur 404 ou null
- Impossible de récupérer les données de User 2

### 5.3 Test de suppression croisée

**Avec User 1 connecté :**

Essayer de supprimer un chapitre de User 2 via l'API :

```javascript
// Remplacer CHAPTER_ID_USER2 par l'ID d'un chapitre de User 2
fetch('/api/chapters/CHAPTER_ID_USER2', {
  method: 'DELETE'
})
  .then(r => r.json())
  .then(console.log);
```

**✅ Succès si :**
- Erreur ou échec de suppression
- Le chapitre de User 2 reste intact dans Supabase

---

## 📊 Étape 6: Tests de Fonctionnalités

### 6.1 Test de progression

**Avec User 1 :**

1. Ouvrir un chapitre de User 1
2. Répondre à quelques questions
3. Vérifier que le score est sauvegardé

**Vérifier dans Supabase :**
```sql
SELECT 
    cp.chapter_id,
    cp.user_id,
    cp.score,
    cp.completed,
    u.email
FROM chapter_progress cp
LEFT JOIN auth.users u ON cp.user_id = u.id;
```

**✅ Succès si :**
- La progression est sauvegardée avec le bon `user_id`
- User 2 ne peut pas voir la progression de User 1

### 6.2 Test de chat

**Avec User 1 :**

1. Aller sur une page de concept
2. Envoyer un message à Aristo
3. Vérifier que la conversation est sauvegardée

**Vérifier dans Supabase :**
```sql
SELECT 
    ch.concept_id,
    ch.user_id,
    jsonb_array_length(ch.messages) as message_count,
    u.email
FROM chat_history ch
LEFT JOIN auth.users u ON ch.user_id = u.id;
```

**✅ Succès si :**
- L'historique est sauvegardé avec le bon `user_id`
- User 2 ne peut pas voir l'historique de User 1

### 6.3 Test de suppression avec CASCADE

**Avec User 1 :**

1. Créer un chapitre
2. Répondre à des questions (créer de la progression)
3. Chatter avec Aristo (créer de l'historique)
4. Supprimer le chapitre

**Vérifier dans Supabase :**
```sql
-- Vérifier que tout est supprimé
SELECT 'chapters' as table_name, COUNT(*) FROM chapters WHERE id = 'CHAPTER_ID'
UNION ALL
SELECT 'concepts', COUNT(*) FROM concepts WHERE chapter_id = 'CHAPTER_ID'
UNION ALL
SELECT 'chapter_progress', COUNT(*) FROM chapter_progress WHERE chapter_id = 'CHAPTER_ID'
UNION ALL
SELECT 'chat_history', COUNT(*) FROM chat_history WHERE concept_id IN (
    SELECT id FROM concepts WHERE chapter_id = 'CHAPTER_ID'
);
```

**✅ Succès si :**
- Toutes les requêtes retournent 0
- Toutes les données liées sont supprimées (CASCADE)

---

## 📈 Étape 7: Tests de Performance

### 7.1 Test avec plusieurs chapitres

**Créer 5-10 chapitres pour chaque utilisateur**

1. User 1 : Créer 5 chapitres
2. User 2 : Créer 5 chapitres

**Vérifier :**
- Le dashboard charge rapidement (< 2 secondes)
- Chaque utilisateur voit uniquement ses chapitres
- Pas de ralentissement notable

### 7.2 Vérifier les index

```sql
-- Vérifier que les index existent
SELECT 
    tablename,
    indexname
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE '%user%'
ORDER BY tablename, indexname;
```

**✅ Succès si :**
- Au moins 6 index sur `user_id` existent
- Index composites existent (user_id + order_index, etc.)

---

## ✅ Checklist Finale

### Configuration de Base
- [ ] RLS activé sur toutes les tables (6/6)
- [ ] 24 policies créées (4 par table)
- [ ] Colonnes `user_id` présentes (6/6)
- [ ] Index de performance créés (8+)

### Tests d'Isolation
- [ ] User 1 ne voit que ses chapitres
- [ ] User 2 ne voit que ses chapitres
- [ ] Impossible d'accéder aux données d'un autre utilisateur
- [ ] Impossible de modifier les données d'un autre utilisateur
- [ ] Impossible de supprimer les données d'un autre utilisateur

### Tests Fonctionnels
- [ ] Upload fonctionne pour chaque utilisateur
- [ ] Suppression fonctionne avec CASCADE
- [ ] Progression sauvegardée par utilisateur
- [ ] Chat sauvegardé par utilisateur
- [ ] Traductions fonctionnent

### Tests de Sécurité
- [ ] Accès direct par URL bloqué
- [ ] Accès API direct bloqué
- [ ] Suppression croisée bloquée
- [ ] Modification croisée bloquée

### Performance
- [ ] Dashboard charge rapidement
- [ ] Pas de ralentissement avec plusieurs chapitres
- [ ] Index fonctionnent correctement

---

## 🎯 Résultats Attendus

### ✅ Tous les tests passent

**Félicitations !** L'isolation utilisateur est correctement configurée :

- ✅ Chaque utilisateur voit uniquement ses propres projets
- ✅ Les données sont complètement isolées
- ✅ La sécurité est renforcée avec RLS
- ✅ L'application est prête pour la production multi-utilisateurs

### ❌ Certains tests échouent

**Si des tests échouent :**

1. **Vérifier que le SQL a été exécuté complètement**
   - Retourner à l'Étape 1
   - Vérifier RLS, policies, et colonnes

2. **Vérifier les logs de l'application**
   - Ouvrir la console du navigateur
   - Chercher des erreurs liées à `user_id` ou RLS

3. **Vérifier l'authentification**
   - S'assurer que l'utilisateur est bien connecté
   - Vérifier que `supabase.auth.getUser()` retourne un utilisateur

4. **Consulter la documentation**
   - `USER_ISOLATION_GUIDE.md` - Guide complet
   - `URGENT_RLS_FIX.md` - Dépannage

---

## 🔄 Rollback (si nécessaire)

Si vous devez revenir en arrière :

```sql
-- Désactiver RLS temporairement
ALTER TABLE chapters DISABLE ROW LEVEL SECURITY;
ALTER TABLE concepts DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE translations DISABLE ROW LEVEL SECURITY;
```

**⚠️ Attention :** Cela désactive l'isolation. Tous les utilisateurs verront toutes les données.

---

## 📊 Rapport de Test

### Informations du Test

- **Date :** _______________
- **Testeur :** _______________
- **Version :** _______________

### Résultats

| Catégorie | Tests Passés | Tests Échoués | Notes |
|-----------|--------------|---------------|-------|
| Configuration | ___/4 | ___/4 | |
| Isolation | ___/5 | ___/5 | |
| Fonctionnalités | ___/5 | ___/5 | |
| Sécurité | ___/4 | ___/4 | |
| Performance | ___/2 | ___/2 | |
| **TOTAL** | **___/20** | **___/20** | |

### Statut Final

- [ ] ✅ Tous les tests passent - Isolation activée avec succès
- [ ] ⚠️ Quelques tests échouent - Corrections nécessaires
- [ ] ❌ Plusieurs tests échouent - Revoir la configuration

### Notes Additionnelles

```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 📚 Documentation Complémentaire

- **Guide complet :** `USER_ISOLATION_GUIDE.md`
- **Setup rapide :** `QUICK_USER_ISOLATION_SETUP.md`
- **Script SQL :** `database/enable-user-isolation.sql`
- **Dépannage :** `URGENT_RLS_FIX.md`

---

**🎉 Bonne chance avec vos tests !**
