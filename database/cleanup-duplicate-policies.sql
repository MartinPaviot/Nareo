-- ============================================================================
-- LevelUp - Nettoyage des Policies RLS Dupliquées
-- Ce script supprime les anciennes policies et garde uniquement les nouvelles
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1: Supprimer les anciennes policies (noms courts)
-- ============================================================================

-- CHAPTERS - Supprimer les anciennes policies
DROP POLICY IF EXISTS "chapters_owner_select" ON chapters;
DROP POLICY IF EXISTS "chapters_owner_insert" ON chapters;
DROP POLICY IF EXISTS "chapters_owner_update" ON chapters;
DROP POLICY IF EXISTS "chapters_owner_delete" ON chapters;

-- CONCEPTS - Supprimer les anciennes policies
DROP POLICY IF EXISTS "concepts_owner_select" ON concepts;
DROP POLICY IF EXISTS "concepts_owner_insert" ON concepts;
DROP POLICY IF EXISTS "concepts_owner_update" ON concepts;
DROP POLICY IF EXISTS "concepts_owner_delete" ON concepts;

-- USER_PROGRESS - Supprimer les anciennes policies
DROP POLICY IF EXISTS "user_progress_owner_select" ON user_progress;
DROP POLICY IF EXISTS "user_progress_owner_insert" ON user_progress;
DROP POLICY IF EXISTS "user_progress_owner_update" ON user_progress;
DROP POLICY IF EXISTS "user_progress_owner_delete" ON user_progress;

-- CHAT_HISTORY - Supprimer les anciennes policies
DROP POLICY IF EXISTS "chat_history_owner_select" ON chat_history;
DROP POLICY IF EXISTS "chat_history_owner_insert" ON chat_history;
DROP POLICY IF EXISTS "chat_history_owner_update" ON chat_history;
DROP POLICY IF EXISTS "chat_history_owner_delete" ON chat_history;

-- CHAPTER_PROGRESS - Supprimer les anciennes policies
DROP POLICY IF EXISTS "chapter_progress_owner_select" ON chapter_progress;
DROP POLICY IF EXISTS "chapter_progress_owner_insert" ON chapter_progress;
DROP POLICY IF EXISTS "chapter_progress_owner_update" ON chapter_progress;
DROP POLICY IF EXISTS "chapter_progress_owner_delete" ON chapter_progress;

-- TRANSLATIONS - Supprimer les anciennes policies
DROP POLICY IF EXISTS "translations_owner_select" ON translations;
DROP POLICY IF EXISTS "translations_owner_insert" ON translations;
DROP POLICY IF EXISTS "translations_owner_update" ON translations;
DROP POLICY IF EXISTS "translations_owner_delete" ON translations;

-- ============================================================================
-- ÉTAPE 2: Vérifier que seules les nouvelles policies restent
-- ============================================================================

-- Afficher toutes les policies restantes
SELECT 
    tablename as "Table",
    policyname as "Policy Name",
    cmd as "Operation"
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('chapters', 'concepts', 'user_progress', 'chat_history', 'chapter_progress', 'translations')
ORDER BY tablename, cmd;

-- Compter les policies par table
SELECT 
    tablename as "Table",
    COUNT(*) as "Number of Policies"
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('chapters', 'concepts', 'user_progress', 'chat_history', 'chapter_progress', 'translations')
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- RÉSULTAT ATTENDU
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ NETTOYAGE DES POLICIES TERMINÉ';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✓ Anciennes policies supprimées (24)';
    RAISE NOTICE '✓ Nouvelles policies conservées (24)';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Résultat attendu:';
    RAISE NOTICE '- chapters: 4 policies';
    RAISE NOTICE '- concepts: 4 policies';
    RAISE NOTICE '- user_progress: 4 policies';
    RAISE NOTICE '- chat_history: 4 policies';
    RAISE NOTICE '- chapter_progress: 4 policies';
    RAISE NOTICE '- translations: 4 policies';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Chaque table a maintenant exactement 4 policies:';
    RAISE NOTICE '   - Users can view own [table]';
    RAISE NOTICE '   - Users can insert own [table]';
    RAISE NOTICE '   - Users can update own [table]';
    RAISE NOTICE '   - Users can delete own [table]';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- VÉRIFICATION FINALE
-- ============================================================================

-- Cette requête doit retourner exactement 24 lignes (4 par table)
SELECT COUNT(*) as "Total Policies (should be 24)"
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('chapters', 'concepts', 'user_progress', 'chat_history', 'chapter_progress', 'translations');
