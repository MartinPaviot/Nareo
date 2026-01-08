-- ============================================================================
-- Migration 028: Note Generation Progress Tracking
-- Allows note generation to continue even if user leaves the page
-- ============================================================================

-- Add note generation status
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS note_status TEXT DEFAULT 'pending';

-- Add progress tracking columns to courses table
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS note_progress INTEGER DEFAULT 0;

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS note_current_step TEXT DEFAULT NULL;

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS note_section_index INTEGER DEFAULT NULL;

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS note_total_sections INTEGER DEFAULT NULL;

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS note_error_message TEXT DEFAULT NULL;

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS note_started_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS note_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Add column for streaming partial content during generation
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS note_partial_content TEXT DEFAULT NULL;

-- Index for finding courses with active note generation
CREATE INDEX IF NOT EXISTS idx_courses_note_status ON public.courses(note_status) WHERE note_status = 'generating';

-- Comments
COMMENT ON COLUMN public.courses.note_status IS 'Note generation status: pending, generating, ready, failed';
COMMENT ON COLUMN public.courses.note_progress IS 'Note generation progress percentage (0-100)';
COMMENT ON COLUMN public.courses.note_current_step IS 'Current generation step for UI display';
COMMENT ON COLUMN public.courses.note_section_index IS 'Current section being processed';
COMMENT ON COLUMN public.courses.note_total_sections IS 'Total sections to process';
COMMENT ON COLUMN public.courses.note_error_message IS 'Error message if note generation failed';
COMMENT ON COLUMN public.courses.note_started_at IS 'When note generation started';
COMMENT ON COLUMN public.courses.note_completed_at IS 'When note generation completed';
COMMENT ON COLUMN public.courses.note_partial_content IS 'Partial content during note generation for live streaming display';
