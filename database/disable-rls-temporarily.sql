-- Script pour désactiver temporairement RLS
-- À exécuter dans Supabase SQL Editor pour débloquer l'application
-- ATTENTION: Cela permet à tous les utilisateurs de voir toutes les données

-- Désactiver RLS sur toutes les tables
ALTER TABLE chapters DISABLE ROW LEVEL SECURITY;
ALTER TABLE concepts DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE translations DISABLE ROW LEVEL SECURITY;

-- Vérifier que RLS est désactivé
SELECT 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('chapters', 'concepts', 'user_progress', 'chat_history', 'chapter_progress', 'translations')
ORDER BY tablename;

-- Résultat attendu: rls_enabled = false pour toutes les tables
