-- ============================================================================
-- Migration 026: Simplify Spaced Repetition to 3 Buttons
-- Removes 'again' rating, keeps only: hard, good, easy
-- ============================================================================

-- 1. Update the last_rating constraint to remove 'again'
-- First drop the existing constraint, then recreate it
ALTER TABLE public.flashcard_progress
DROP CONSTRAINT IF EXISTS flashcard_progress_last_rating_check;

ALTER TABLE public.flashcard_progress
ADD CONSTRAINT flashcard_progress_last_rating_check
CHECK (last_rating IS NULL OR last_rating IN ('hard', 'good', 'easy'));

-- 2. Convert any existing 'again' ratings to 'hard' (closest equivalent)
UPDATE public.flashcard_progress
SET last_rating = 'hard'
WHERE last_rating = 'again';

-- 3. Drop the cards_again column from flashcard_sessions
ALTER TABLE public.flashcard_sessions
DROP COLUMN IF EXISTS cards_again;

-- 4. Update the constraint for session counts (now only 3 categories)
ALTER TABLE public.flashcard_sessions
DROP CONSTRAINT IF EXISTS valid_session_counts;

ALTER TABLE public.flashcard_sessions
ADD CONSTRAINT valid_session_counts CHECK (
  cards_hard + cards_good + cards_easy <= total_cards
);

-- 5. Update comment for last_rating
COMMENT ON COLUMN public.flashcard_progress.last_rating IS 'Last rating given: hard, good, easy';
