-- ============================================================================
-- LevelUp - Add User Isolation (Multi-User Support)
-- This script adds user_id columns and Row Level Security (RLS)
-- ============================================================================

-- ============================================================================
-- STEP 1: Add user_id columns to all tables
-- ============================================================================

-- Add user_id to chapters
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to concepts (inherited from chapter, but explicit for queries)
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to user_progress
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to chat_history
ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to chapter_progress
ALTER TABLE chapter_progress ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to translations (shared across users, but can be user-specific)
ALTER TABLE translations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 2: Create indexes on user_id for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_chapters_user ON chapters(user_id);
CREATE INDEX IF NOT EXISTS idx_concepts_user ON concepts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_progress_user ON chapter_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_translations_user ON translations(user_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_chapters_user_order ON chapters(user_id, order_index);
CREATE INDEX IF NOT EXISTS idx_concepts_user_chapter ON concepts(user_id, chapter_id);

-- ============================================================================
-- STEP 3: Enable Row Level Security (RLS) on all tables
-- ============================================================================

ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS Policies
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
-- STEP 5: Create helper function to get current user ID
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Update existing data (if any) to assign to a default user
-- ============================================================================

-- NOTE: This is optional. If you have existing data without user_id,
-- you can either:
-- 1. Delete it: DELETE FROM chapters WHERE user_id IS NULL;
-- 2. Assign to a specific user: UPDATE chapters SET user_id = 'user-uuid' WHERE user_id IS NULL;
-- 3. Leave it and it will be inaccessible (recommended for clean start)

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies
-- SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public';

-- Check user_id columns exist
-- SELECT table_name, column_name FROM information_schema.columns 
-- WHERE table_schema = 'public' AND column_name = 'user_id';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Update memory-store.ts to include user_id in all operations
-- 3. Ensure Supabase Auth is configured
-- 4. Test with multiple users
-- ============================================================================
