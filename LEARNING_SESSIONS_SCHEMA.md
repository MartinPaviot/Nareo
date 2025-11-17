# Structure de la table learning_sessions

## 📋 Colonnes requises

Voici la structure complète de la table `learning_sessions` basée sur le code:

```sql
CREATE TABLE IF NOT EXISTS learning_sessions (
    -- Identifiant unique
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Utilisateur propriétaire (pour RLS)
    user_id TEXT NOT NULL,
    
    -- Chapitre associé
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    
    -- État de la session
    current_question INTEGER DEFAULT 1,
    
    -- Messages de chat (format JSONB)
    chat_messages JSONB DEFAULT '[]'::jsonb,
    
    -- État de la session (active, paused, completed)
    session_state TEXT DEFAULT 'active' CHECK (session_state IN ('active', 'paused', 'completed')),
    
    -- Dernière activité
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contrainte d'unicité: un utilisateur ne peut avoir qu'une session par chapitre
    UNIQUE(user_id, chapter_id)
);
```

## 📊 Détails des colonnes

| Colonne | Type | Nullable | Default | Description |
|---------|------|----------|---------|-------------|
| `id` | UUID | NO | uuid_generate_v4() | Identifiant unique de la session |
| `user_id` | TEXT | NO | - | ID de l'utilisateur (pour RLS) |
| `chapter_id` | UUID | NO | - | Référence au chapitre |
| `current_question` | INTEGER | YES | 1 | Numéro de la question actuelle |
| `chat_messages` | JSONB | YES | '[]' | Historique des messages de chat |
| `session_state` | TEXT | YES | 'active' | État: 'active', 'paused', ou 'completed' |
| `last_activity` | TIMESTAMPTZ | YES | NOW() | Dernière activité de l'utilisateur |
| `created_at` | TIMESTAMPTZ | YES | NOW() | Date de création |
| `updated_at` | TIMESTAMPTZ | YES | NOW() | Date de dernière mise à jour |

## 🔑 Contraintes et index

### Contraintes:
```sql
-- Clé primaire
PRIMARY KEY (id)

-- Clé étrangère vers chapters
FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE

-- Contrainte de vérification sur session_state
CHECK (session_state IN ('active', 'paused', 'completed'))

-- Contrainte d'unicité
UNIQUE (user_id, chapter_id)
```

### Index recommandés:
```sql
-- Index pour les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id 
ON learning_sessions(user_id);

-- Index pour les requêtes par chapitre
CREATE INDEX IF NOT EXISTS idx_learning_sessions_chapter_id 
ON learning_sessions(chapter_id);

-- Index pour filtrer par état
CREATE INDEX IF NOT EXISTS idx_learning_sessions_state 
ON learning_sessions(session_state);

-- Index pour trier par dernière activité
CREATE INDEX IF NOT EXISTS idx_learning_sessions_last_activity 
ON learning_sessions(last_activity DESC);
```

## 🔒 RLS Policies

```sql
-- Activer RLS
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: Les utilisateurs peuvent voir leurs propres sessions
CREATE POLICY "Users can view their own learning sessions"
    ON learning_sessions FOR SELECT
    USING (user_id = auth.uid()::text);

-- Policy INSERT: Les utilisateurs peuvent créer leurs propres sessions
CREATE POLICY "Users can insert their own learning sessions"
    ON learning_sessions FOR INSERT
    WITH CHECK (user_id = auth.uid()::text);

-- Policy UPDATE: Les utilisateurs peuvent mettre à jour leurs propres sessions
CREATE POLICY "Users can update their own learning sessions"
    ON learning_sessions FOR UPDATE
    USING (user_id = auth.uid()::text);

-- Policy DELETE: Les utilisateurs peuvent supprimer leurs propres sessions
CREATE POLICY "Users can delete their own learning sessions"
    ON learning_sessions FOR DELETE
    USING (user_id = auth.uid()::text);
```

## 🔄 Trigger pour updated_at

```sql
-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur learning_sessions
CREATE TRIGGER update_learning_sessions_updated_at
    BEFORE UPDATE ON learning_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## 📝 Format des données JSONB

### chat_messages
```json
[
  {
    "role": "user",
    "content": "Qu'est-ce qu'une fonction?",
    "timestamp": "2024-01-15T10:30:00Z"
  },
  {
    "role": "assistant",
    "content": "Une fonction est...",
    "timestamp": "2024-01-15T10:30:05Z"
  }
]
```

## 🎯 Exemple de données

```sql
INSERT INTO learning_sessions (
    user_id,
    chapter_id,
    current_question,
    chat_messages,
    session_state,
    last_activity
) VALUES (
    'user-123',
    'chapter-456',
    3,
    '[
        {"role": "user", "content": "Question 1?", "timestamp": "2024-01-15T10:00:00Z"},
        {"role": "assistant", "content": "Réponse 1", "timestamp": "2024-01-15T10:00:05Z"}
    ]'::jsonb,
    'active',
    NOW()
);
```

## ✅ Vérification

Pour vérifier que votre table est correctement configurée:

```sql
-- Vérifier la structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'learning_sessions'
ORDER BY ordinal_position;

-- Vérifier les contraintes
SELECT
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conrelid = 'learning_sessions'::regclass;

-- Vérifier les index
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'learning_sessions';

-- Vérifier les policies RLS
SELECT
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'learning_sessions';
```

## 🚀 Script SQL complet

Voici le script SQL complet à exécuter dans Supabase:

```sql
-- Activer l'extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Créer la table
CREATE TABLE IF NOT EXISTS learning_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    current_question INTEGER DEFAULT 1,
    chat_messages JSONB DEFAULT '[]'::jsonb,
    session_state TEXT DEFAULT 'active' CHECK (session_state IN ('active', 'paused', 'completed')),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, chapter_id)
);

-- Créer les index
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_chapter_id ON learning_sessions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_state ON learning_sessions(session_state);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_last_activity ON learning_sessions(last_activity DESC);

-- Créer la fonction de mise à jour
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
CREATE TRIGGER update_learning_sessions_updated_at
    BEFORE UPDATE ON learning_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Activer RLS
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;

-- Créer les policies
CREATE POLICY "Users can view their own learning sessions"
    ON learning_sessions FOR SELECT
    USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own learning sessions"
    ON learning_sessions FOR INSERT
    WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own learning sessions"
    ON learning_sessions FOR UPDATE
    USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own learning sessions"
    ON learning_sessions FOR DELETE
    USING (user_id = auth.uid()::text);

-- Accorder les permissions
GRANT ALL ON learning_sessions TO authenticated;
GRANT ALL ON learning_sessions TO service_role;
```

## 📌 Notes importantes

1. **user_id est TEXT** (pas UUID) car il vient de Supabase Auth
2. **chapter_id est UUID** et référence la table `chapters`
3. **session_state** est limité à 3 valeurs: 'active', 'paused', 'completed'
4. **chat_messages** est JSONB pour stocker l'historique des conversations
5. **UNIQUE(user_id, chapter_id)** garantit qu'un utilisateur ne peut avoir qu'une session par chapitre
6. **RLS policies** utilisent `auth.uid()::text` pour correspondre au type TEXT de user_id

Cette structure est compatible avec le code que nous avons corrigé dans les API routes!
