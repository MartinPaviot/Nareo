-- ============================================================================
-- LevelUp - Activer l'Isolation Utilisateur (Script Intelligent)
-- Ce script vérifie l'état actuel et active l'isolation utilisateur
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1: Vérifier et créer les colonnes user_id si nécessaire
-- ============================================================================

DO $$ 
BEGIN
    -- Ajouter user_id à chapters si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chapters' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE chapters ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Colonne user_id ajoutée à chapters';
    ELSE
        RAISE NOTICE '✓ Colonne user_id existe déjà dans chapters';
    END IF;

    -- Ajouter user_id à concepts si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'concepts' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE concepts ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Colonne user_id ajoutée à concepts';
    ELSE
        RAISE NOTICE '✓ Colonne user_id existe déjà dans concepts';
    END IF;

    -- Ajouter user_id à user_progress si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_progress' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE user_progress ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Colonne user_id ajoutée à user_progress';
    ELSE
        RAISE NOTICE '✓ Colonne user_id existe déjà dans user_progress';
    END IF;

    -- Ajouter user_id à chat_history si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_history' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE chat_history ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Colonne user_id ajoutée à chat_history';
    ELSE
        RAISE NOTICE '✓ Colonne user_id existe déjà dans chat_history';
    END IF;

    -- Ajouter user_id à chapter_progress si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chapter_progress' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE chapter_progress ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Colonne user_id ajoutée à chapter_progress';
    ELSE
        RAISE NOTICE '✓ Colonne user_id existe déjà dans chapter_progress';
    END IF;

    -- Ajouter user_id à translations si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'translations' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE translations ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Colonne user_id ajoutée à translations';
    ELSE
        RAISE NOTICE '✓ Colonne user_id existe déjà dans translations';
    END IF;
END $$;

-- ============================================================================
-- ÉTAPE 2: Créer les index pour la performance
-- ============================================================================

-- Index simples sur user_id
CREATE INDEX IF NOT EXISTS idx_chapters_user ON chapters(user_id);
CREATE INDEX IF NOT EXISTS idx_concepts_user ON concepts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_progress_user ON chapter_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_translations_user ON translations(user_id);

-- Index composites pour requêtes courantes
CREATE INDEX IF NOT EXISTS idx_chapters_user_order ON chapters(user_id, order_index);
CREATE INDEX IF NOT EXISTS idx_concepts_user_chapter ON concepts(user_id, chapter_id);

-- ============================================================================
-- ÉTAPE 3: Activer Row Level Security (RLS)
-- ============================================================================

ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ÉTAPE 4: Créer les RLS Policies
-- ============================================================================

-- CHAPTERS: Users can only see and manage their own chapters
DROP POLICY IF EXISTS "Users can view own chapters" ON chapters;
CREATE POLICY "Users can view own chapters"
  ON chapters FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chapters" ON chapters;
CREATE POLICY "Users can insert own chapters"
  ON chapters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chapters" ON chapters;
CREATE POLICY "Users can update own chapters"
  ON chapters FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chapters" ON chapters;
CREATE POLICY "Users can delete own chapters"
  ON chapters FOR DELETE
  USING (auth.uid() = user_id);

-- CONCEPTS: Users can only see and manage their own concepts
DROP POLICY IF EXISTS "Users can view own concepts" ON concepts;
CREATE POLICY "Users can view own concepts"
  ON concepts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own concepts" ON concepts;
CREATE POLICY "Users can insert own concepts"
  ON concepts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own concepts" ON concepts;
CREATE POLICY "Users can update own concepts"
  ON concepts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own concepts" ON concepts;
CREATE POLICY "Users can delete own concepts"
  ON concepts FOR DELETE
  USING (auth.uid() = user_id);

-- USER_PROGRESS: Users can only see and manage their own progress
DROP POLICY IF EXISTS "Users can view own progress" ON user_progress;
CREATE POLICY "Users can view own progress"
  ON user_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
CREATE POLICY "Users can insert own progress"
  ON user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
CREATE POLICY "Users can update own progress"
  ON user_progress FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own progress" ON user_progress;
CREATE POLICY "Users can delete own progress"
  ON user_progress FOR DELETE
  USING (auth.uid() = user_id);

-- CHAT_HISTORY: Users can only see and manage their own chat history
DROP POLICY IF EXISTS "Users can view own chat history" ON chat_history;
CREATE POLICY "Users can view own chat history"
  ON chat_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat history" ON chat_history;
CREATE POLICY "Users can insert own chat history"
  ON chat_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chat history" ON chat_history;
CREATE POLICY "Users can update own chat history"
  ON chat_history FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat history" ON chat_history;
CREATE POLICY "Users can delete own chat history"
  ON chat_history FOR DELETE
  USING (auth.uid() = user_id);

-- CHAPTER_PROGRESS: Users can only see and manage their own chapter progress
DROP POLICY IF EXISTS "Users can view own chapter progress" ON chapter_progress;
CREATE POLICY "Users can view own chapter progress"
  ON chapter_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chapter progress" ON chapter_progress;
CREATE POLICY "Users can insert own chapter progress"
  ON chapter_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chapter progress" ON chapter_progress;
CREATE POLICY "Users can update own chapter progress"
  ON chapter_progress FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chapter progress" ON chapter_progress;
CREATE POLICY "Users can delete own chapter progress"
  ON chapter_progress FOR DELETE
  USING (auth.uid() = user_id);

-- TRANSLATIONS: Allow users to see their own translations, or shared ones (user_id IS NULL)
DROP POLICY IF EXISTS "Users can view translations" ON translations;
CREATE POLICY "Users can view translations"
  ON translations FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert own translations" ON translations;
CREATE POLICY "Users can insert own translations"
  ON translations FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own translations" ON translations;
CREATE POLICY "Users can update own translations"
  ON translations FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can delete own translations" ON translations;
CREATE POLICY "Users can delete own translations"
  ON translations FOR DELETE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================================
-- ÉTAPE 5: Nettoyer les données existantes sans user_id
-- ============================================================================

-- Option 1: Supprimer les données sans user_id (Recommandé pour démarrage propre)
-- Décommentez les lignes suivantes si vous voulez supprimer les anciennes données:

-- DELETE FROM chapters WHERE user_id IS NULL;
-- DELETE FROM concepts WHERE user_id IS NULL;
-- DELETE FROM user_progress WHERE user_id IS NULL;
-- DELETE FROM chat_history WHERE user_id IS NULL;
-- DELETE FROM chapter_progress WHERE user_id IS NULL;
-- DELETE FROM translations WHERE user_id IS NULL;

-- Option 2: Assigner à un utilisateur spécifique
-- Remplacez 'YOUR-USER-UUID' par votre UUID utilisateur:

-- UPDATE chapters SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
-- UPDATE concepts SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
-- UPDATE user_progress SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
-- UPDATE chat_history SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
-- UPDATE chapter_progress SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;

-- ============================================================================
-- ÉTAPE 6: Vérification
-- ============================================================================

-- Vérifier que RLS est activé
SELECT 
    tablename, 
    rowsecurity as "RLS Activé"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('chapters', 'concepts', 'user_progress', 'chat_history', 'chapter_progress', 'translations')
ORDER BY tablename;

-- Vérifier les policies
SELECT 
    tablename as "Table", 
    COUNT(*) as "Nombre de Policies"
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Vérifier les colonnes user_id
SELECT 
    table_name as "Table",
    column_name as "Colonne",
    data_type as "Type"
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND column_name = 'user_id'
ORDER BY table_name;

-- Compter les données par utilisateur
SELECT 
    'chapters' as table_name,
    user_id,
    COUNT(*) as count
FROM chapters
GROUP BY user_id
UNION ALL
SELECT 
    'concepts' as table_name,
    user_id,
    COUNT(*) as count
FROM concepts
GROUP BY user_id
ORDER BY table_name, user_id;

-- ============================================================================
-- MIGRATION TERMINÉE
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ ISOLATION UTILISATEUR ACTIVÉE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✓ Colonnes user_id créées';
    RAISE NOTICE '✓ Index de performance créés';
    RAISE NOTICE '✓ Row Level Security activé';
    RAISE NOTICE '✓ 24 policies créées (4 par table)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Prochaines étapes:';
    RAISE NOTICE '1. Vérifier les résultats ci-dessus';
    RAISE NOTICE '2. Tester avec 2 comptes utilisateurs';
    RAISE NOTICE '3. Vérifier que chaque utilisateur voit uniquement ses données';
    RAISE NOTICE '';
    RAISE NOTICE '📚 Documentation: USER_ISOLATION_TEST_GUIDE.md';
    RAISE NOTICE '';
END $$;
