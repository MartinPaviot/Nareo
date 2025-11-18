# 🔄 Migration vers useChatMemory - Instructions

## ✅ Déjà complété

1. ✅ Table `chat_messages` créée dans Supabase
2. ✅ Hook `useChatMemory` créé avec toutes les fonctionnalités
3. ✅ Hook intégré dans la page learn
4. ✅ Logique de chargement initial modifiée

## 🔧 Modifications restantes

### 1. Remplacer tous les `setMessages` par `addMessage`

**Règle de remplacement :**
```typescript
// AVANT
setMessages(prev => [...prev, newMessage]);

// APRÈS
await addMessage({
  role: newMessage.role,
  content: newMessage.content,
  aristoState: newMessage.aristoState,
});
```

**⚠️ Important** : `addMessage` est async, donc utiliser `await` ou `.then()`

### Occurrences à modifier (ligne par ligne)

#### 🔴 loadQuestion (erreurs)
- Ligne 286 : `setMessages(prev => [...prev, errorMessage]);`
- Ligne 301 : `setMessages(prev => [...prev, errorMessage]);`
- Ligne 318 : `setMessages(prev => [...prev, errorMessage]);`
- Ligne 372 : `setMessages(prev => [...prev, questionMessage]);`

#### 🔴 handleSendMessage
- Ligne 405 : `setMessages(prev => [...prev, userMessage]);`
- Ligne 444 : `setMessages(prev => [...prev, feedbackMessage]);`
- Ligne 475 : `setMessages(prev => [...prev, completeMessage]);`
- Ligne 487 : `setMessages(prev => [...prev, errorMessage]);`

#### 🔴 handleQuickAction
- Ligne 510 : `setMessages(prev => [...prev, userMessage]);`
- Ligne 535 : `setMessages(prev => [...prev, helpMessage]);`
- Ligne 548 : `setMessages(prev => [...prev, errorMessage]);`

#### 🔴 Gestion de traduction (lignes 106, 135)
Ces cas sont spéciaux car ils REMPLACENT tous les messages existants.
**Solution** : Garder en local mais ne PAS persister (messages traduits)

### 2. Supprimer les fonctions obsolètes

```typescript
// ❌ SUPPRIMER complètement
const saveSession = async () => { ... }

// ❌ SUPPRIMER les useEffect de sauvegarde automatique
useEffect(() => {
  const interval = setInterval(() => {
    saveSession();
  }, 30000);
  ...
}, [user, chapterId]);
```

### 3. Exécuter la migration SQL

```bash
# Dans le dashboard Supabase, exécuter:
cd database/migrations
# Copier le contenu de 002_chat_messages.sql et l'exécuter
```

### 4. Tester la migration

#### Test 1: Nouveau chapitre
1. Ouvrir un nouveau chapitre
2. Répondre à 2-3 questions
3. Vérifier dans Supabase que les messages sont bien dans `chat_messages`

#### Test 2: Persistance
1. Rafraîchir la page (F5)
2. Vérifier que tous les messages réapparaissent
3. Continuer la conversation
4. Nouveaux messages doivent apparaître

#### Test 3: Changement de chapitre
1. Passer à un autre chapitre
2. Revenir au chapitre initial
3. L'historique doit être intact

#### Test 4: Isolation
1. Ouvrir chapitre A, ajouter messages
2. Ouvrir chapitre B, ajouter messages
3. Retourner à A : seuls les messages de A doivent apparaître

## 📊 Architecture finale

```
┌─────────────────────────────────────────┐
│         Page learn (UI)                 │
│  ┌───────────────────────────────────┐  │
│  │   useChatMemory Hook              │  │
│  │   - messages (state)              │  │
│  │   - addMessage()                  │  │
│  │   - clearMessages()               │  │
│  │   - isLoading                     │  │
│  └───────────────────────────────────┘  │
│               ↓                         │
│     Supabase Realtime Client            │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│         Supabase Database               │
│  ┌───────────────────────────────────┐  │
│  │  Table: chat_messages             │  │
│  │  - id (UUID)                      │  │
│  │  - user_id (TEXT)                 │  │
│  │  - chapter_id (TEXT)              │  │
│  │  - sender (TEXT)                  │  │
│  │  - content (TEXT)                 │  │
│  │  - aristo_state (TEXT)            │  │
│  │  - timestamp (TIMESTAMPTZ)        │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Indexes:                               │
│  - user_id + chapter_id (composite)     │
│  - timestamp (ASC)                      │
│                                         │
│  RLS Policies:                          │
│  - SELECT: own messages only            │
│  - INSERT: own messages only            │
│  - UPDATE: own messages only            │
│  - DELETE: own messages only            │
└─────────────────────────────────────────┘
```

## 🎯 Bénéfices attendus

1. ✅ **Persistance totale** : Messages sauvegardés en temps réel
2. ✅ **Isolation** : Chaque cours a sa propre mémoire
3. ✅ **Performance** : Requêtes optimisées avec index
4. ✅ **Sécurité** : RLS actif, chaque utilisateur voit uniquement ses messages
5. ✅ **Sync temps réel** : Changements visibles instantanément
6. ✅ **Pas de blocage UI** : Chargement async sans gel
7. ✅ **Récupération d'erreurs** : Optimistic updates + retry
