-- Migration: Add archive functionality for flashcards
-- Allows users to manually mark flashcards as "acquired" and remove them from reviews

-- Add is_archived column to track archived status
ALTER TABLE public.flashcard_progress
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Add archived_at timestamp for tracking when it was archived
ALTER TABLE public.flashcard_progress
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Index for efficient filtering of non-archived cards in review queries
-- This is a partial index that only includes non-archived cards
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_not_archived
ON public.flashcard_progress(user_id, next_review_at)
WHERE is_archived = FALSE;

-- Index for fetching archived cards efficiently
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_archived
ON public.flashcard_progress(user_id)
WHERE is_archived = TRUE;

-- Comments for documentation
COMMENT ON COLUMN public.flashcard_progress.is_archived IS 'Whether the user has manually archived this card (removed from review queue)';
COMMENT ON COLUMN public.flashcard_progress.archived_at IS 'Timestamp when the card was archived';
