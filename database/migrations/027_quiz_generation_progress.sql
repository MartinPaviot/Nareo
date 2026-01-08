-- ============================================================================
-- Migration 027: Quiz Generation Progress Tracking
-- Allows quiz generation to continue even if user leaves the page
-- ============================================================================

-- Add progress tracking columns to courses table
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS quiz_progress INTEGER DEFAULT 0;

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS quiz_questions_generated INTEGER DEFAULT 0;

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS quiz_total_questions INTEGER DEFAULT 0;

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS quiz_current_step TEXT DEFAULT NULL;

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS quiz_error_message TEXT DEFAULT NULL;

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS quiz_started_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS quiz_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Index for finding courses with active quiz generation
CREATE INDEX IF NOT EXISTS idx_courses_quiz_status ON public.courses(quiz_status) WHERE quiz_status = 'generating';

-- Comments
COMMENT ON COLUMN public.courses.quiz_progress IS 'Quiz generation progress percentage (0-100)';
COMMENT ON COLUMN public.courses.quiz_questions_generated IS 'Number of questions generated so far';
COMMENT ON COLUMN public.courses.quiz_total_questions IS 'Total expected questions';
COMMENT ON COLUMN public.courses.quiz_current_step IS 'Current generation step for UI display';
COMMENT ON COLUMN public.courses.quiz_error_message IS 'Error message if quiz generation failed';
COMMENT ON COLUMN public.courses.quiz_started_at IS 'When quiz generation started';
COMMENT ON COLUMN public.courses.quiz_completed_at IS 'When quiz generation completed';
