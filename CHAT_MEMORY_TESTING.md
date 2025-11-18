# 🧪 Guide de Test - Migration useChatMemory

## Objectif

Vérifier que la migration vers `useChatMemory` fonctionne correctement avec une mémoire persistante totale.

---

## Prérequis

- ✅ SQL exécuté dans Supabase (`002_chat_messages.sql`)
- ✅ Hook `useChatMemory` créé
- ✅ Intégration complète dans `app/learn/[conceptId]/page.tsx`
- ✅ Application déployée ou en développement local

---

## Test 1: Nouveau chapitre - Persistance initiale ⏱️ 2 min

### Étapes

1. **Ouvrir un nouveau chapitre** (jamais consulté auparavant)
2. **Répondre à 2-3 questions** du quiz interactif
3. **Ouvrir Supabase Dashboard** → Table Editor → `chat_messages`

### Résultats attendus

✅ Vous devriez voir **~5-7 messages** (greetings + questions + réponses)

| Colonne | Valeur attendue |
|---------|----------------|
| `user_id` | Votre ID utilisateur |
| `chapter_id` | ID du chapitre actuel |
| `sender` | 'user' OU 'assistant' |
| `content` | Texte du message |
| `aristo_state` | 'happy', 'confused', 'asking', etc. |
| `timestamp` | Date/heure récente |

### Console navigateur (F12)

Logs attendus:
```
💬 Loading chat history for chapter: [CHAPTER_ID]
✅ Loaded 0 messages from memory (premier chargement)
📡 Setting up realtime subscription for chapter: [CHAPTER_ID]
✅ Message saved to Supabase: [MESSAGE_ID]
✅ Message saved to Supabase: [MESSAGE_ID]
```

---

## Test 2: Persistance après refresh ⏱️ 1 min

### Étapes

1. **Sur le même chapitre**, appuyer sur **F5** (refresh)
2. Attendre le chargement complet

### Résultats attendus

✅ **Tous les messages réapparaissent instantanément**
✅ Aucun message en double
✅ Ordre chronologique préservé

### Console navigateur

```
💬 Loading chat history for chapter: [CHAPTER_ID]
✅ Loaded 7 messages from memory
📡 Setting up realtime subscription for chapter: [CHAPTER_ID]
```

### Actions supplémentaires

3. **Continuer la conversation** (ajouter 2 nouveaux messages)
4. Rafraîchir à nouveau (F5)

✅ Les **nouveaux messages** doivent également persister

---

## Test 3: Changement de chapitre ⏱️ 2 min

### Étapes

1. **Passer à un autre chapitre** via la sidebar
2. Vérifier que le chat est vide OU contient uniquement les messages de ce chapitre
3. **Ajouter 2 messages** dans ce nouveau chapitre
4. **Retourner au premier chapitre** via la sidebar

### Résultats attendus

✅ L'historique du **premier chapitre est intact**
✅ L'historique du **second chapitre est isolé**
✅ Aucun mélange de messages entre chapitres

### Console navigateur

```
🔄 Chapter changed, reloading messages
💬 Loading chat history for chapter: [NEW_CHAPTER_ID]
✅ Loaded X messages from memory
📡 Setting up realtime subscription for chapter: [NEW_CHAPTER_ID]
🔌 Unsubscribing from realtime channel (ancien chapitre)
```

---

## Test 4: Isolation par utilisateur ⏱️ 2 min

### Étapes

1. **Se déconnecter** de l'application
2. **Se connecter avec un autre compte** (ou créer un compte test)
3. **Ouvrir le même chapitre** que dans Test 1

### Résultats attendus

✅ **Aucun message de l'utilisateur précédent n'est visible**
✅ Le chat démarre vide ou avec uniquement le greeting
✅ Row Level Security (RLS) fonctionne correctement

### Vérification Supabase

Dans Table Editor → `chat_messages`:
- Filtrer par `user_id` = nouvel utilisateur
- Vous ne devriez voir **aucun message** de l'ancien utilisateur

---

## Test 5: Fermeture/Réouverture complète ⏱️ 1 min

### Étapes

1. **Avoir une conversation active** (plusieurs messages)
2. **Fermer l'onglet complètement** (Ctrl+W ou clic X)
3. **Rouvrir l'application** dans un nouvel onglet
4. **Naviguer vers le même chapitre**

### Résultats attendus

✅ **L'historique complet est présent**
✅ Aucune perte de données
✅ Les timestamps sont corrects

---

## Test 6: Synchronisation temps réel (optionnel) ⏱️ 2 min

### Étapes

1. **Ouvrir deux onglets** avec le même chapitre
2. Dans **Onglet 1**: ajouter un message
3. Observer **Onglet 2**

### Résultats attendus

✅ Le message apparaît **automatiquement** dans Onglet 2
✅ Pas besoin de rafraîchir manuellement

### Console navigateur (Onglet 2)

```
📨 Realtime message received: [PAYLOAD]
```

---

## Test 7: Gestion d'erreurs ⏱️ 1 min

### Étapes

1. **Désactiver temporairement la connexion Internet**
2. Essayer d'envoyer un message
3. **Réactiver la connexion Internet**

### Résultats attendus

✅ Le message apparaît immédiatement dans l'UI (optimistic update)
⚠️ Une erreur est loggée dans la console
✅ L'UI reste fonctionnelle

### Console navigateur

```
❌ Error saving message to Supabase: [ERROR_MESSAGE]
```

---

## Vérifications finales

### 1. Supabase Dashboard

**Navigation**: Table Editor → `chat_messages`

**Vérifications**:
- ✅ Tous vos messages sont présents
- ✅ Colonne `user_id` correcte
- ✅ Colonne `chapter_id` correcte
- ✅ Timestamps chronologiques
- ✅ Pas de doublons

**Filtres utiles**:
```sql
-- Voir tous les messages d'un utilisateur
SELECT * FROM chat_messages WHERE user_id = 'YOUR_USER_ID';

-- Voir tous les messages d'un chapitre
SELECT * FROM chat_messages WHERE chapter_id = 'CHAPTER_ID';

-- Compter les messages par chapitre
SELECT chapter_id, COUNT(*) as message_count
FROM chat_messages
WHERE user_id = 'YOUR_USER_ID'
GROUP BY chapter_id;
```

### 2. Console navigateur

**Pas d'erreurs critiques** comme:
- ❌ `Failed to load chat history`
- ❌ `Cannot read property of undefined`
- ❌ `RLS policy violation`

**Logs normaux**:
- ✅ `Loading chat history`
- ✅ `Loaded X messages from memory`
- ✅ `Message saved to Supabase`
- ✅ `Setting up realtime subscription`

### 3. Performance

| Opération | Temps attendu | Acceptabilité |
|-----------|---------------|---------------|
| Chargement historique (50 msg) | < 200ms | ⚡ Rapide |
| Sauvegarde d'un message | < 100ms | ⚡ Instantané |
| Changement de chapitre | < 300ms | ⚡ Fluide |
| Sync temps réel | Instantané | ⚡ Temps réel |

---

## Problèmes connus et solutions

### ❌ "Messages ne se chargent pas"

**Causes possibles**:
1. RLS mal configuré → Vérifier les policies dans Supabase
2. `user_id` incorrect → Vérifier `user?.id` dans le code
3. Table `chat_messages` manquante → Exécuter `002_chat_messages.sql`

**Solution**:
```sql
-- Vérifier RLS
SELECT * FROM pg_policies WHERE tablename = 'chat_messages';

-- Tester manuellement
SELECT * FROM chat_messages WHERE user_id = 'YOUR_USER_ID';
```

### ❌ "Messages en double"

**Cause**: Optimistic update + Realtime subscription

**Solution**: Le code gère déjà ce cas (ligne 217 dans `useChatMemory.ts`)

```typescript
setMessages((prev) => {
  const exists = prev.find((m) => m.id === newMessage.id);
  if (exists) {
    return prev; // Éviter doublon
  }
  return [...prev, newMessage];
});
```

### ❌ "Performance lente"

**Causes possibles**:
1. Index manquants
2. Trop de messages (> 1000)

**Solutions**:
```sql
-- Vérifier les index
SELECT * FROM pg_indexes WHERE tablename = 'chat_messages';

-- Nettoyer les vieux messages (> 90 jours)
DELETE FROM chat_messages
WHERE timestamp < NOW() - INTERVAL '90 days';
```

### ❌ "Isolation ne fonctionne pas"

**Vérification RLS**:
```sql
-- Les policies doivent utiliser auth.uid()
SELECT * FROM pg_policies
WHERE tablename = 'chat_messages'
AND qual LIKE '%auth.uid()%';
```

---

## Checklist de validation finale

Avant de considérer la migration comme réussie:

- [ ] Test 1 réussi: Messages sauvegardés dans Supabase
- [ ] Test 2 réussi: Messages persistent après refresh
- [ ] Test 3 réussi: Isolation par chapitre fonctionne
- [ ] Test 4 réussi: Isolation par utilisateur fonctionne
- [ ] Test 5 réussi: Persistance après fermeture complète
- [ ] Aucune erreur dans la console navigateur
- [ ] Performance acceptable (< 300ms par opération)
- [ ] RLS policies actives et fonctionnelles
- [ ] Index créés correctement

---

## Prochaines étapes (après validation)

Une fois tous les tests réussis, vous pouvez:

1. **Supprimer** `learning_sessions.chat_messages` (ancien système)
2. **Ajouter** des fonctionnalités supplémentaires:
   - Export de conversation en PDF
   - Recherche dans l'historique
   - Statistiques de progression
   - Nettoyage automatique (cron job)

3. **Monitorer** les performances en production:
   - Temps de chargement
   - Taille de la base de données
   - Nombre de requêtes par utilisateur

---

## Support

En cas de problème:

1. **Console navigateur (F12)** → Onglet Console
2. **Supabase Dashboard** → Logs → Recent Queries
3. **Table `chat_messages`** → Vérifier les données brutes
4. **RLS Policies** → Vérifier qu'elles sont actives

**Documentation de référence**:
- [MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md) - Vue d'ensemble de la migration
- [useChatMemory.ts](./hooks/useChatMemory.ts) - Code source du hook
- [002_chat_messages.sql](./database/migrations/002_chat_messages.sql) - Schéma SQL

---

## 🎉 Conclusion

Si tous les tests passent, **félicitations** ! Votre chatbot dispose maintenant d'une mémoire persistante professionnelle.

**Avantages obtenus**:
- ✅ 100% Persistant (jamais de perte de données)
- ✅ 100% Sécurisé (RLS actif)
- ✅ 100% Performant (< 300ms par opération)
- ✅ 100% Isolé (par utilisateur et par chapitre)
- ✅ 100% Temps réel (synchronisation multi-onglets)

**Bonne chance pour vos tests !** 🚀
