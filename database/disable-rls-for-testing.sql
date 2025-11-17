-- Désactiver temporairement RLS pour permettre les uploads
-- À utiliser UNIQUEMENT pour les tests

ALTER TABLE chapters DISABLE ROW LEVEL SECURITY;
ALTER TABLE concepts DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE translations DISABLE ROW LEVEL SECURITY;

-- Note: Les colonnes user_id existent toujours, mais RLS ne filtre plus
-- Cela permet de tester l'upload sans authentification
