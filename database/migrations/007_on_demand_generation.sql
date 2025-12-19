-- Migration: On-demand quiz/flashcards/note generation
-- This migration adds status tracking columns for on-demand content generation

-- 1. Add quiz_status to courses for tracking quiz generation
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS quiz_status TEXT
CHECK (quiz_status IN ('pending', 'generating', 'ready', 'partial', 'failed'))
DEFAULT 'pending';

-- 2. Add note_status to courses for tracking A+ Note generation
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS note_status TEXT
CHECK (note_status IN ('pending', 'generating', 'ready', 'failed'))
DEFAULT 'pending';

-- 3. Update existing courses to have correct status based on existing data
-- Courses that already have quiz questions should be marked as 'ready'
DO $$
DECLARE
    course_record RECORD;
    question_count INTEGER;
BEGIN
    FOR course_record IN SELECT id FROM public.courses WHERE quiz_status IS NULL OR quiz_status = 'pending' LOOP
        SELECT COUNT(*) INTO question_count
        FROM public.questions q
        JOIN public.chapters ch ON q.chapter_id = ch.id
        WHERE ch.course_id = course_record.id;

        IF question_count > 0 THEN
            UPDATE public.courses SET quiz_status = 'ready' WHERE id = course_record.id;
        END IF;
    END LOOP;
END $$;

-- Courses that already have aplus_note content should be marked as 'ready'
UPDATE public.courses
SET note_status = 'ready'
WHERE aplus_note IS NOT NULL AND aplus_note != '' AND (note_status IS NULL OR note_status = 'pending');

-- 4. Add 'pending_quiz' to chapters status check constraint
-- First drop the existing constraint if it exists
ALTER TABLE public.chapters
DROP CONSTRAINT IF EXISTS chapters_status_check;

-- Add new constraint with 'pending_quiz' status
ALTER TABLE public.chapters
ADD CONSTRAINT chapters_status_check
CHECK (status IN ('pending', 'pending_quiz', 'processing', 'ready', 'failed'));

-- 5. Comments for documentation
COMMENT ON COLUMN public.courses.quiz_status IS 'Quiz generation status: pending (not started), generating (in progress), ready (complete), partial (some chapters failed), failed';
COMMENT ON COLUMN public.courses.note_status IS 'A+ Note generation status: pending, generating, ready, failed';
