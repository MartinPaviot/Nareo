-- ============================================================================
-- LevelUp Supabase Schema
-- Migration from MemoryStore to Supabase
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CHAPTERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  english_title TEXT NOT NULL,
  english_description TEXT NOT NULL,
  french_title TEXT NOT NULL,
  french_description TEXT NOT NULL,
  pdf_text TEXT NOT NULL,
  extracted_text TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  order_index INTEGER DEFAULT 0,
  questions JSONB DEFAULT '[]'::jsonb,
  source_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for ordering chapters
CREATE INDEX IF NOT EXISTS idx_chapters_order ON chapters(order_index);

-- Index for difficulty filtering
CREATE INDEX IF NOT EXISTS idx_chapters_difficulty ON chapters(difficulty);

-- ============================================================================
-- CONCEPTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  order_index INTEGER NOT NULL DEFAULT 0,
  source_text TEXT
);

-- Index for chapter lookups
CREATE INDEX IF NOT EXISTS idx_concepts_chapter ON concepts(chapter_id);

-- Index for ordering concepts within a chapter
CREATE INDEX IF NOT EXISTS idx_concepts_order ON concepts(chapter_id, order_index);

-- ============================================================================
-- USER_PROGRESS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_progress (
  concept_id TEXT PRIMARY KEY REFERENCES concepts(id) ON DELETE CASCADE,
  phase1_score INTEGER NOT NULL DEFAULT 0,
  phase2_score INTEGER NOT NULL DEFAULT 0,
  phase3_score INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  badge TEXT CHECK (badge IN ('bronze', 'silver', 'gold') OR badge IS NULL),
  completed BOOLEAN NOT NULL DEFAULT FALSE
);

-- Index for filtering completed concepts
CREATE INDEX IF NOT EXISTS idx_progress_completed ON user_progress(completed);

-- Index for badge filtering
CREATE INDEX IF NOT EXISTS idx_progress_badge ON user_progress(badge) WHERE badge IS NOT NULL;

-- ============================================================================
-- CHAT_HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_history (
  concept_id TEXT PRIMARY KEY REFERENCES concepts(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Index for JSONB queries on messages
CREATE INDEX IF NOT EXISTS idx_chat_messages ON chat_history USING GIN (messages);

-- ============================================================================
-- CHAPTER_PROGRESS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS chapter_progress (
  chapter_id TEXT PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
  current_question INTEGER NOT NULL DEFAULT 1,
  questions_answered INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Index for filtering completed chapters
CREATE INDEX IF NOT EXISTS idx_chapter_progress_completed ON chapter_progress(completed);

-- Index for JSONB queries on answers
CREATE INDEX IF NOT EXISTS idx_chapter_answers ON chapter_progress USING GIN (answers);

-- ============================================================================
-- TRANSLATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS translations (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_translations_updated ON translations(updated_at);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for translations table
DROP TRIGGER IF EXISTS update_translations_updated_at ON translations;
CREATE TRIGGER update_translations_updated_at
  BEFORE UPDATE ON translations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE chapters IS 'Stores course chapters with bilingual content and questions';
COMMENT ON TABLE concepts IS 'Stores learning concepts associated with chapters';
COMMENT ON TABLE user_progress IS 'Tracks user progress through concepts with scores and badges';
COMMENT ON TABLE chat_history IS 'Stores chat conversation history for each concept';
COMMENT ON TABLE chapter_progress IS 'Tracks user progress through chapter-based learning';
COMMENT ON TABLE translations IS 'Caches translated content for performance';

COMMENT ON COLUMN chapters.questions IS 'Array of ChapterQuestion objects (5 questions per chapter)';
COMMENT ON COLUMN chat_history.messages IS 'Array of message objects with role, content, and timestamp';
COMMENT ON COLUMN chapter_progress.answers IS 'Array of answer objects with scores and feedback';
COMMENT ON COLUMN translations.value IS 'Cached translation data in any JSON format';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Uncomment to verify schema creation:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Verify all tables and indexes are created
-- 3. Run the migration script to transfer existing data
-- 4. Update memory-store.ts to use Supabase
-- ============================================================================
