-- ============================================================================
-- Migration 006: Progressive Pipeline Architecture
-- Enables chapter-by-chapter availability and parallel flashcard generation
-- ============================================================================

-- 1. Add status column to chapters for progressive availability
ALTER TABLE public.chapters
ADD COLUMN IF NOT EXISTS status TEXT
CHECK (status IN ('pending', 'processing', 'ready', 'failed'))
DEFAULT 'pending';

-- Backfill existing chapters as 'ready' (they already have questions)
UPDATE public.chapters SET status = 'ready' WHERE status IS NULL;

-- Index for filtering chapters by status
CREATE INDEX IF NOT EXISTS idx_chapters_status ON public.chapters(status);

-- 2. Create dedicated flashcards table (instead of JSONB in courses)
CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE, -- NULL = course-level
  type TEXT CHECK (type IN ('definition', 'formula', 'condition', 'intuition', 'link')) DEFAULT 'definition',
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_course ON public.flashcards(course_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_chapter ON public.flashcards(chapter_id);

-- 3. Create flashcard progress tracking per user
CREATE TABLE IF NOT EXISTS public.flashcard_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  mastery TEXT CHECK (mastery IN ('new', 'learning', 'reviewing', 'mastered')) DEFAULT 'new',
  correct_count INT DEFAULT 0,
  incorrect_count INT DEFAULT 0,
  next_review_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, flashcard_id)
);

CREATE INDEX IF NOT EXISTS idx_flashcard_progress_user ON public.flashcard_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_next_review ON public.flashcard_progress(next_review_at);

-- 4. Create course_notes table for async A+ Note generation
CREATE TABLE IF NOT EXISTS public.course_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID UNIQUE NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  content TEXT,
  status TEXT CHECK (status IN ('pending', 'generating', 'ready', 'failed')) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_notes_course ON public.course_notes(course_id);
CREATE INDEX IF NOT EXISTS idx_course_notes_status ON public.course_notes(status);

-- 5. Add flashcards_status to courses for tracking generation
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS flashcards_status TEXT
CHECK (flashcards_status IN ('pending', 'generating', 'ready', 'failed'))
DEFAULT 'pending';

-- 6. Migrate existing JSONB flashcards to new table
-- (Run this only once, then remove the flashcards JSONB column later)
DO $$
DECLARE
  course_record RECORD;
  fc JSONB;
  fc_type TEXT;
BEGIN
  FOR course_record IN
    SELECT id, flashcards
    FROM public.courses
    WHERE flashcards IS NOT NULL AND flashcards != '[]'::jsonb
  LOOP
    FOR fc IN SELECT * FROM jsonb_array_elements(course_record.flashcards)
    LOOP
      -- Validate type or default to 'definition'
      fc_type := fc->>'type';
      IF fc_type NOT IN ('definition', 'formula', 'condition', 'intuition', 'link') THEN
        fc_type := 'definition';
      END IF;

      INSERT INTO public.flashcards (course_id, type, front, back)
      VALUES (
        course_record.id,
        fc_type,
        COALESCE(fc->>'front', fc->>'concept', ''),
        COALESCE(fc->>'back', fc->>'definition', '')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Mark course flashcards as ready after migration
    UPDATE public.courses SET flashcards_status = 'ready' WHERE id = course_record.id;
  END LOOP;
END $$;

-- 7. Migrate existing aplus_note to course_notes table
INSERT INTO public.course_notes (course_id, content, status)
SELECT id, aplus_note, 'ready'
FROM public.courses
WHERE aplus_note IS NOT NULL AND aplus_note != ''
ON CONFLICT (course_id) DO UPDATE SET content = EXCLUDED.content, status = 'ready';

-- ============================================================================
-- RLS Policies for new tables
-- ============================================================================

-- Flashcards RLS
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Users can read flashcards for their own courses
DROP POLICY IF EXISTS flashcards_select_self ON public.flashcards;
CREATE POLICY flashcards_select_self ON public.flashcards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = flashcards.course_id AND c.user_id = auth.uid()
    )
  );

-- Allow reading flashcards for public courses
DROP POLICY IF EXISTS flashcards_select_public ON public.flashcards;
CREATE POLICY flashcards_select_public ON public.flashcards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = flashcards.course_id AND c.is_public = true AND c.status = 'ready'
    )
  );

-- Allow reading flashcards for guest courses
DROP POLICY IF EXISTS flashcards_select_guest ON public.flashcards;
CREATE POLICY flashcards_select_guest ON public.flashcards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = flashcards.course_id AND c.user_id IS NULL
    )
  );

-- Flashcard Progress RLS
ALTER TABLE public.flashcard_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flashcard_progress_select_self ON public.flashcard_progress;
CREATE POLICY flashcard_progress_select_self ON public.flashcard_progress
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS flashcard_progress_upsert_self ON public.flashcard_progress;
CREATE POLICY flashcard_progress_upsert_self ON public.flashcard_progress
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Course Notes RLS
ALTER TABLE public.course_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_notes_select_self ON public.course_notes;
CREATE POLICY course_notes_select_self ON public.course_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_notes.course_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS course_notes_select_public ON public.course_notes;
CREATE POLICY course_notes_select_public ON public.course_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_notes.course_id AND c.is_public = true AND c.status = 'ready'
    )
  );

DROP POLICY IF EXISTS course_notes_select_guest ON public.course_notes;
CREATE POLICY course_notes_select_guest ON public.course_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_notes.course_id AND c.user_id IS NULL
    )
  );

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_progress TO authenticated;
GRANT SELECT ON public.course_notes TO authenticated;
GRANT SELECT ON public.flashcards TO anon;
GRANT SELECT ON public.course_notes TO anon;

-- Service role needs full access for pipeline
GRANT ALL PRIVILEGES ON public.flashcards TO service_role;
GRANT ALL PRIVILEGES ON public.flashcard_progress TO service_role;
GRANT ALL PRIVILEGES ON public.course_notes TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.flashcards IS 'Flashcards generated from course content, can be course-level or chapter-level';
COMMENT ON TABLE public.flashcard_progress IS 'Tracks user progress on individual flashcards with spaced repetition';
COMMENT ON TABLE public.course_notes IS 'A+ Notes generated asynchronously from course content';
COMMENT ON COLUMN public.chapters.status IS 'Processing status: pending, processing, ready, failed';
COMMENT ON COLUMN public.courses.flashcards_status IS 'Flashcard generation status: pending, generating, ready, failed';
