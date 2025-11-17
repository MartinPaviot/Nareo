# ⚡ Activation Rapide de l'Isolation par Utilisateur

## 🎯 Objectif

Faire en sorte que **chaque utilisateur voit uniquement ses propres cours**.

## ✅ 3 Étapes Simples (10 minutes)

### Étape 1: Exécuter le SQL (2 minutes)

1. Ouvrir **Supabase Dashboard** → **SQL Editor**
2. Copier **tout le contenu** de `database/add-user-isolation.sql`
3. Coller et cliquer sur **"Run"**
4. Attendre le message "Success"

✅ **Fait!** Les tables ont maintenant une colonne `user_id` et RLS est activé.

### Étape 2: Activer l'Authentification (3 minutes)

1. Ouvrir **Supabase Dashboard** → **Authentication** → **Providers**
2. Activer **Email**:
   - Enable Email provider: ✅
   - Confirm email: ✅
3. Configurer **URLs**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/**`

✅ **Fait!** L'authentification est configurée.

### Étape 3: Mettre à Jour le Code (5 minutes)

Le code memory-store.ts doit ajouter `user_id` à toutes les opérations.

**Exemple de modification nécessaire:**

```typescript
// Dans memory-store.ts, ajouter cette fonction helper:
private async getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// Puis l'utiliser dans chaque méthode:
async addChapter(chapter: Chapter): Promise<void> {
  const userId = await this.getUserId();
  if (!userId) throw new Error('User not authenticated');
  
  const { error } = await supabase.from('chapters').upsert({
    id: chapter.id,
    user_id: userId, // ← AJOUTER CECI
    title: chapter.title,
    // ... reste des champs
  });
}
```

## 🧪 Test Rapide

1. **Créer un compte:** Aller sur l'app → Sign Up
2. **Uploader un PDF:** Créer un cours
3. **Se déconnecter:** Sign Out
4. **Créer un 2ème compte:** Sign Up avec un autre email
5. **Vérifier:** Le cours du 1er utilisateur ne doit PAS être visible

✅ **Si le cours n'est pas visible** → L'isolation fonctionne!
❌ **Si le cours est visible** → Vérifier que `user_id` est bien ajouté dans le code

## 📊 Vérification dans Supabase

```sql
-- Voir les chapitres avec leur user_id
SELECT id, title, user_id FROM chapters;

-- Vérifier que RLS est activé
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

## 🚨 Problèmes Courants

### "No rows returned" après login

**Cause:** Les données existantes n'ont pas de `user_id`.

**Solution:**
```sql
-- Supprimer les anciennes données
DELETE FROM chapters WHERE user_id IS NULL;
```

### "Policy violation" error

**Cause:** L'utilisateur n'est pas authentifié.

**Solution:** Vérifier que l'utilisateur est connecté avant d'accéder aux données.

## 📚 Documentation Complète

Pour plus de détails, voir `USER_ISOLATION_GUIDE.md`.

---

**C'est tout!** Votre application est maintenant multi-utilisateurs avec isolation complète des données. 🎉
