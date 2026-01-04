-- Migration 023: Fix delete_course_cascade function
-- Updates the cascade delete function to handle all related tables
-- Also fixes foreign key constraints that were missing ON DELETE CASCADE

-- =======================
-- 1. FIX FOREIGN KEY CONSTRAINTS
-- =======================

-- Fix weekly_insights foreign keys to chapters (add ON DELETE SET NULL)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'weekly_insights_strongest_chapter_id_fkey') THEN
    ALTER TABLE public.weekly_insights DROP CONSTRAINT weekly_insights_strongest_chapter_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'weekly_insights_weakest_chapter_id_fkey') THEN
    ALTER TABLE public.weekly_insights DROP CONSTRAINT weekly_insights_weakest_chapter_id_fkey;
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- Table doesn't exist, skip
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'weekly_insights') THEN
    ALTER TABLE public.weekly_insights
    ADD CONSTRAINT weekly_insights_strongest_chapter_id_fkey
    FOREIGN KEY (strongest_chapter_id) REFERENCES public.chapters(id) ON DELETE SET NULL;

    ALTER TABLE public.weekly_insights
    ADD CONSTRAINT weekly_insights_weakest_chapter_id_fkey
    FOREIGN KEY (weakest_chapter_id) REFERENCES public.chapters(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, skip
END $$;

-- =======================
-- 2. UPDATE CASCADE DELETE FUNCTION
-- =======================

-- Function to delete a course and all related data
CREATE OR REPLACE FUNCTION delete_course_cascade(course_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  chapter_ids uuid[];
BEGIN
  -- Get all chapter IDs for this course
  SELECT ARRAY_AGG(id) INTO chapter_ids
  FROM chapters WHERE course_id = course_id_param;

  -- Only proceed with chapter-related deletions if there are chapters
  IF chapter_ids IS NOT NULL AND array_length(chapter_ids, 1) > 0 THEN
    -- Delete chapter_mastery for all chapters of this course
    BEGIN
      DELETE FROM chapter_mastery WHERE chapter_id = ANY(chapter_ids);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- Clear weekly_insights references to these chapters (SET NULL)
    BEGIN
      UPDATE weekly_insights SET strongest_chapter_id = NULL WHERE strongest_chapter_id = ANY(chapter_ids);
      UPDATE weekly_insights SET weakest_chapter_id = NULL WHERE weakest_chapter_id = ANY(chapter_ids);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- Delete chat_messages for all chapters
    BEGIN
      DELETE FROM chat_messages WHERE chapter_id = ANY(chapter_ids);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- Delete questions for all chapters
    BEGIN
      DELETE FROM questions WHERE chapter_id = ANY(chapter_ids);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- Delete flashcards for all chapters
    BEGIN
      DELETE FROM flashcards WHERE chapter_id = ANY(chapter_ids);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- Delete user_chapter_progress for all chapters
    BEGIN
      DELETE FROM user_chapter_progress WHERE chapter_id = ANY(chapter_ids);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- Delete generation_jobs for all chapters
    BEGIN
      DELETE FROM generation_jobs WHERE chapter_id = ANY(chapter_ids);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- Delete study_sessions for all chapters
    BEGIN
      DELETE FROM study_sessions WHERE chapter_id = ANY(chapter_ids);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END IF;

  -- Delete course-level data
  BEGIN
    DELETE FROM chapter_mastery WHERE course_id = course_id_param;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM generation_jobs WHERE course_id = course_id_param;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM course_settings WHERE course_id = course_id_param;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM folder_courses WHERE course_id = course_id_param;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM study_sessions WHERE course_id = course_id_param;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM priority_items WHERE course_id = course_id_param;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM log_events WHERE course_id = course_id_param;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Delete all chapters
  DELETE FROM chapters WHERE course_id = course_id_param;

  -- Finally, delete the course itself
  DELETE FROM courses WHERE id = course_id_param;
END;
$$;

-- =======================
-- 3. DOCUMENTATION
-- =======================

COMMENT ON FUNCTION delete_course_cascade IS 'Safely deletes a course and all related data including chapters, questions, flashcards, progress, mastery, generation jobs, study sessions, priority items, and folder associations';
