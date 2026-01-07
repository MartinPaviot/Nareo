-- ============================================================================
-- Migration 025: Enhanced Spaced Repetition System
-- Adds SM-2 algorithm support with ease_factor, interval_days, and session tracking
-- ============================================================================

-- 1. Add new columns to flashcard_progress for SM-2 algorithm
ALTER TABLE public.flashcard_progress
ADD COLUMN IF NOT EXISTS ease_factor DECIMAL(4,2) DEFAULT 2.5,
ADD COLUMN IF NOT EXISTS interval_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_rating TEXT CHECK (last_rating IN ('again', 'hard', 'good', 'easy'));

-- Add constraint for ease_factor (between 1.3 and 3.0)
-- Note: Can't add check constraint on existing column easily, so we handle this in app logic

-- Update existing rows to have default ease_factor
UPDATE public.flashcard_progress
SET ease_factor = 2.5, interval_days = 0, review_count = COALESCE(correct_count, 0) + COALESCE(incorrect_count, 0)
WHERE ease_factor IS NULL;

-- 2. Create flashcard_sessions table for analytics
CREATE TABLE IF NOT EXISTS public.flashcard_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,

  -- Session stats
  total_cards INTEGER NOT NULL DEFAULT 0,
  cards_again INTEGER DEFAULT 0,
  cards_hard INTEGER DEFAULT 0,
  cards_good INTEGER DEFAULT 0,
  cards_easy INTEGER DEFAULT 0,

  -- Timing
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Constraint
  CONSTRAINT valid_session_counts CHECK (
    cards_again + cards_hard + cards_good + cards_easy <= total_cards
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flashcard_sessions_user ON public.flashcard_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_sessions_course ON public.flashcard_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_sessions_started ON public.flashcard_sessions(started_at DESC);

-- 3. Create index for efficient "due today" queries
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_user_next_review
ON public.flashcard_progress(user_id, next_review_at)
WHERE next_review_at IS NOT NULL;

-- 4. RLS for flashcard_sessions
ALTER TABLE public.flashcard_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flashcard_sessions_select_self ON public.flashcard_sessions;
CREATE POLICY flashcard_sessions_select_self ON public.flashcard_sessions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS flashcard_sessions_insert_self ON public.flashcard_sessions;
CREATE POLICY flashcard_sessions_insert_self ON public.flashcard_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS flashcard_sessions_update_self ON public.flashcard_sessions;
CREATE POLICY flashcard_sessions_update_self ON public.flashcard_sessions
  FOR UPDATE USING (user_id = auth.uid());

-- 5. Grants
GRANT SELECT, INSERT, UPDATE ON public.flashcard_sessions TO authenticated;
GRANT ALL PRIVILEGES ON public.flashcard_sessions TO service_role;

-- 6. Comments
COMMENT ON COLUMN public.flashcard_progress.ease_factor IS 'SM-2 ease factor multiplier (1.3-3.0, default 2.5)';
COMMENT ON COLUMN public.flashcard_progress.interval_days IS 'Current review interval in days';
COMMENT ON COLUMN public.flashcard_progress.review_count IS 'Total number of reviews for this card';
COMMENT ON COLUMN public.flashcard_progress.last_rating IS 'Last rating given: again, hard, good, easy';
COMMENT ON TABLE public.flashcard_sessions IS 'Tracks flashcard study sessions for analytics';
