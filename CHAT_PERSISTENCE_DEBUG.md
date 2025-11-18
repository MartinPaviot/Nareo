# 🔍 Guide de diagnostic - Persistance des conversations

## Problème
L'historique des conversations ne se charge pas lors du changement de chapitre.

## ✅ Modifications apportées

### 1. Nouvelle route API : `/api/sessions/load`
- **Fichier**: `app/api/sessions/load/route.ts`
- **Fonction**: Charge l'historique des messages sauvegardés pour un chapitre
- **Logs ajoutés**: Affiche le nombre de sessions et les messages trouvés

### 2. Page d'apprentissage modifiée
- **Fichier**: `app/learn/[conceptId]/page.tsx`
- **Fonction `loadChapterData`**: Charge maintenant l'historique avant d'afficher les messages
- **Logs ajoutés**: Affiche chaque étape du chargement

### 3. API de sauvegarde améliorée
- **Fichier**: `app/api/sessions/save/route.ts`
- **Logs ajoutés**: Affiche le nombre de messages sauvegardés

## 🧪 Tests à effectuer

### Test 1: Vérifier la sauvegarde des messages

1. Démarrez l'application : `npm run dev`
2. Connectez-vous et ouvrez un chapitre
3. Répondez à au moins 2 questions
4. Ouvrez la console du navigateur (F12)
5. **Recherchez ces logs** :
   ```
   💾 Saving learning session for chapter: [ID] question: [N]
   ✅ Learning session saved successfully
   ```

6. Vérifiez dans la console **serveur** (terminal) :
   ```
   📝 Saving learning session for user: [ID] chapter: [ID]
   📊 Session data to save: { currentQuestion: X, messageCount: Y, ... }
   ✅ Learning session saved successfully
   📊 Saved data: { id: ..., chapterId: ..., messageCount: Y }
   ```

### Test 2: Vérifier le chargement des messages

1. Sur le même chapitre, **changez de chapitre** via la sidebar
2. **Revenez** au chapitre précédent
3. **Console navigateur** - Recherchez :
   ```
   🔍 Attempting to load saved session for chapter: [ID]
   📡 Session response status: 200
   📦 Session data received: { hasSession: true, messageCount: X, ... }
   💬 Loading saved chat history: X messages
   ✅ Restored X messages from saved session
   ```

4. **Console serveur** - Recherchez :
   ```
   📚 Loading learning session for user: [ID] chapter: [ID]
   ✅ Learning session loaded successfully
   📊 Session data: { chapterId: ..., messageCount: X, ... }
   ```

### Test 3: Vérifier la base de données Supabase

1. Allez dans votre dashboard Supabase
2. Ouvrez **Table Editor**
3. Sélectionnez la table `learning_sessions`
4. Vérifiez qu'il y a des entrées avec :
   - `user_id` : Votre ID utilisateur
   - `chapter_id` : L'ID du chapitre
   - `chat_messages` : Un tableau JSON avec vos messages
   - `current_question` : Le numéro de question

## 🔍 Problèmes potentiels identifiés

### Problème 1: Les messages ne sont pas sauvegardés
**Symptômes** :
- Pas de log "Learning session saved successfully"
- Table `learning_sessions` vide dans Supabase

**Solutions** :
- Vérifier que la fonction `saveSession()` est appelée (toutes les 30s)
- Vérifier les erreurs dans la console serveur
- Vérifier les permissions RLS sur la table `learning_sessions`

### Problème 2: Les messages sont sauvegardés mais pas chargés
**Symptômes** :
- Log "Learning session saved successfully" ✅
- Log "No saved session found" lors du chargement ❌

**Solutions possibles** :
- **Problème de type de données** : Le `chapter_id` pourrait être de type différent (UUID vs TEXT)
- **Problème RLS** : Les politiques de sécurité bloquent peut-être la lecture
- **Problème de timing** : La session n'est peut-être pas encore sauvegardée quand on change de chapitre

### Problème 3: Les messages sont chargés mais pas affichés
**Symptômes** :
- Log "Restored X messages from saved session" ✅
- Mais aucun message visible dans l'interface ❌

**Solutions** :
- Vérifier que `setMessages(savedMessages)` est appelé
- Vérifier le format des messages chargés

## 🛠️ Corrections à appliquer selon le problème

### Si les messages ne sont pas sauvegardés :

```typescript
// Dans app/learn/[conceptId]/page.tsx
// Vérifier que saveSession() est bien dans le useEffect
useEffect(() => {
  const interval = setInterval(() => {
    saveSession(); // ← Doit être appelé
  }, 30000);
  return () => clearInterval(interval);
}, [user, chapterId, currentQuestionNumber, messages]);
```

### Si le chapitre ID ne correspond pas :

Vérifiez dans Supabase si les `chapter_id` sont bien au format UUID et correspondent.

```sql
-- Dans Supabase SQL Editor
SELECT
  ls.chapter_id as session_chapter_id,
  c.id as actual_chapter_id,
  ls.chat_messages,
  array_length(ls.chat_messages, 1) as message_count
FROM learning_sessions ls
LEFT JOIN chapters c ON ls.chapter_id = c.id
WHERE ls.user_id = 'VOTRE_USER_ID';
```

### Si c'est un problème RLS :

```sql
-- Vérifier les politiques RLS dans Supabase
-- Table : learning_sessions
-- Policy pour SELECT :
CREATE POLICY "Users can view their own learning sessions"
ON learning_sessions
FOR SELECT
USING (auth.uid()::text = user_id);

-- Policy pour INSERT/UPDATE :
CREATE POLICY "Users can manage their own learning sessions"
ON learning_sessions
FOR ALL
USING (auth.uid()::text = user_id);
```

## 📊 Résumé des logs importants

| Étape | Fichier | Log à chercher | Statut attendu |
|-------|---------|---------------|----------------|
| Sauvegarde | `save/route.ts` | `📝 Saving learning session` | ✅ |
| Sauvegarde OK | `save/route.ts` | `✅ Learning session saved` | ✅ |
| Données sauvegardées | `save/route.ts` | `📊 Saved data: { messageCount: X }` | X > 0 |
| Chargement | `load/route.ts` | `📚 Loading learning session` | ✅ |
| Chargement OK | `load/route.ts` | `✅ Learning session loaded` | ✅ |
| Messages trouvés | `load/route.ts` | `📊 Session data: { messageCount: X }` | X > 0 |
| Restauration | `page.tsx` | `✅ Restored X messages` | X > 0 |

## 🎯 Prochaines étapes

1. **Testez** avec les instructions ci-dessus
2. **Collectez les logs** de la console navigateur ET serveur
3. **Partagez** les logs pour diagnostic plus précis
4. Nous pourrons alors identifier exactement où le problème se situe

---

**Note** : Les logs de débogage sont maintenant activés dans tous les fichiers concernés. N'hésitez pas à les partager pour un diagnostic précis.
