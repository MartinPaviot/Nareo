-- ============================================================================
-- COURSES MODULE REFACTOR MIGRATION
-- Unified folder/courses view with smart CTA, freshness tracking, and priority items
-- ============================================================================

-- ============================================
-- ALTER TABLE: COURSES
-- Add fields for freshness and smart CTA
-- ============================================
ALTER TABLE courses ADD COLUMN IF NOT EXISTS last_studied_at TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS current_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cards_to_review INTEGER DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS overall_mastery_percentage DECIMAL(5,2) DEFAULT 0;

-- Index for sorting and filtering
CREATE INDEX IF NOT EXISTS idx_courses_last_studied ON courses(last_studied_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_user_order ON courses(user_id, display_order);

-- ============================================
-- ALTER TABLE: FOLDERS
-- Add fields for improved UI
-- ============================================
ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_collapsed BOOLEAN DEFAULT FALSE;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Update position to display_order if position exists
UPDATE folders SET display_order = position WHERE display_order = 0 AND position > 0;

-- ============================================
-- TABLE: STUDY_SESSIONS
-- Track study sessions for freshness
-- ============================================
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,

  session_type TEXT NOT NULL CHECK (session_type IN ('quiz', 'flashcards', 'revision_sheet')),

  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  questions_answered INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  cards_reviewed INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_course ON study_sessions(user_id, course_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_sessions_recent ON study_sessions(user_id, started_at DESC);

-- ============================================
-- TABLE: PRIORITY_ITEMS
-- Items to review urgently (calculated by CRON or on-demand)
-- ============================================
CREATE TABLE IF NOT EXISTS priority_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  item_type TEXT NOT NULL CHECK (item_type IN ('chapter', 'course', 'flashcard_deck')),
  item_id UUID NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,

  priority_score INTEGER DEFAULT 0,
  reason TEXT,

  days_since_review INTEGER,
  mastery_level TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  UNIQUE(user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_priority_items_user ON priority_items(user_id, priority_score DESC);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own study sessions" ON study_sessions;
CREATE POLICY "Users own study sessions" ON study_sessions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own priority items" ON priority_items;
CREATE POLICY "Users own priority items" ON priority_items FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTION: Get courses organized by folder
-- ============================================
CREATE OR REPLACE FUNCTION get_courses_by_folder(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH folder_data AS (
    SELECT
      f.id AS folder_id,
      f.name AS folder_name,
      f.color AS folder_color,
      f.icon AS folder_icon,
      f.is_collapsed,
      COALESCE(f.display_order, f.position, 0) AS folder_order,
      COALESCE(
        jsonb_agg(
          CASE WHEN c.id IS NOT NULL THEN
            jsonb_build_object(
              'id', c.id,
              'name', COALESCE(c.editable_title, c.title),
              'file_name', c.title,
              'created_at', c.created_at,
              'last_studied_at', c.last_studied_at,
              'days_since_study', EXTRACT(DAY FROM NOW() - c.last_studied_at)::INTEGER,
              'total_chapters', (SELECT COUNT(*) FROM chapters WHERE course_id = c.id),
              'mastered_chapters', (
                SELECT COUNT(*) FROM chapter_mastery cm2
                JOIN chapters ch2 ON ch2.id = cm2.chapter_id
                WHERE ch2.course_id = c.id AND cm2.user_id = p_user_id AND cm2.mastery_level = 'mastered'
              ),
              'mastery_percentage', COALESCE(c.overall_mastery_percentage, 0),
              'current_chapter', (
                SELECT jsonb_build_object(
                  'id', ch.id,
                  'name', ch.name,
                  'chapter_number', ch.chapter_number
                )
                FROM chapters ch WHERE ch.id = c.current_chapter_id
              ),
              'cards_to_review', COALESCE(c.cards_to_review, 0),
              'display_order', COALESCE(c.display_order, 0),
              'status', c.status
            )
          ELSE NULL END
          ORDER BY c.display_order, c.created_at DESC
        ) FILTER (WHERE c.id IS NOT NULL AND c.status = 'ready'),
        '[]'::jsonb
      ) AS courses
    FROM folders f
    LEFT JOIN folder_courses fc ON fc.folder_id = f.id
    LEFT JOIN courses c ON c.id = fc.course_id AND c.user_id = p_user_id
    WHERE f.user_id = p_user_id
    GROUP BY f.id
  ),
  uncategorized AS (
    SELECT
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'name', COALESCE(c.editable_title, c.title),
            'file_name', c.title,
            'created_at', c.created_at,
            'last_studied_at', c.last_studied_at,
            'days_since_study', EXTRACT(DAY FROM NOW() - c.last_studied_at)::INTEGER,
            'total_chapters', (SELECT COUNT(*) FROM chapters WHERE course_id = c.id),
            'mastered_chapters', (
              SELECT COUNT(*) FROM chapter_mastery cm2
              JOIN chapters ch2 ON ch2.id = cm2.chapter_id
              WHERE ch2.course_id = c.id AND cm2.user_id = p_user_id AND cm2.mastery_level = 'mastered'
            ),
            'mastery_percentage', COALESCE(c.overall_mastery_percentage, 0),
            'current_chapter', (
              SELECT jsonb_build_object(
                'id', ch.id,
                'name', ch.name,
                'chapter_number', ch.chapter_number
              )
              FROM chapters ch WHERE ch.id = c.current_chapter_id
            ),
            'cards_to_review', COALESCE(c.cards_to_review, 0),
            'display_order', COALESCE(c.display_order, 0),
            'status', c.status
          )
          ORDER BY c.display_order, c.created_at DESC
        ),
        '[]'::jsonb
      ) AS courses
    FROM courses c
    WHERE c.user_id = p_user_id
    AND c.status = 'ready'
    AND NOT EXISTS (
      SELECT 1 FROM folder_courses fc WHERE fc.course_id = c.id
    )
  )
  SELECT jsonb_build_object(
    'folders', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', folder_id,
          'name', folder_name,
          'color', folder_color,
          'icon', folder_icon,
          'is_collapsed', is_collapsed,
          'display_order', folder_order,
          'courses', courses,
          'course_count', jsonb_array_length(courses)
        )
        ORDER BY folder_order, folder_name
      ) FROM folder_data),
      '[]'::jsonb
    ),
    'uncategorized', COALESCE(
      (SELECT courses FROM uncategorized),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Calculate priority items
-- ============================================
CREATE OR REPLACE FUNCTION calculate_priority_items(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_chapter RECORD;
  v_priority_score INTEGER;
  v_reason TEXT;
BEGIN
  -- Delete expired items
  DELETE FROM priority_items
  WHERE user_id = p_user_id
  AND (expires_at < NOW() OR expires_at IS NULL);

  -- Calculate priority chapters
  FOR v_chapter IN
    SELECT
      cm.chapter_id,
      cm.course_id,
      cm.mastery_level,
      cm.last_reviewed_at,
      cm.days_until_degradation,
      ch.name AS chapter_name,
      COALESCE(c.editable_title, c.title) AS course_name,
      EXTRACT(DAY FROM NOW() - cm.last_reviewed_at)::INTEGER AS days_since
    FROM chapter_mastery cm
    JOIN chapters ch ON ch.id = cm.chapter_id
    JOIN courses c ON c.id = cm.course_id
    WHERE cm.user_id = p_user_id
    AND cm.mastery_level NOT IN ('mastered')
    ORDER BY
      CASE WHEN cm.days_until_degradation <= 2 THEN 0 ELSE 1 END,
      cm.last_reviewed_at ASC NULLS FIRST,
      CASE cm.mastery_level
        WHEN 'not_started' THEN 0
        WHEN 'discovery' THEN 1
        WHEN 'learning' THEN 2
        WHEN 'acquired' THEN 3
        ELSE 4
      END
    LIMIT 5
  LOOP
    v_priority_score := 100;

    IF v_chapter.days_until_degradation IS NOT NULL AND v_chapter.days_until_degradation <= 2 THEN
      v_priority_score := v_priority_score + 50;
      v_reason := 'Va régresser dans ' || v_chapter.days_until_degradation || ' jour(s)';
    ELSIF v_chapter.days_since IS NOT NULL AND v_chapter.days_since >= 5 THEN
      v_priority_score := v_priority_score + (v_chapter.days_since * 5);
      v_reason := 'Pas révisé depuis ' || v_chapter.days_since || ' jours';
    ELSIF v_chapter.mastery_level = 'not_started' THEN
      v_priority_score := v_priority_score + 30;
      v_reason := 'Chapitre jamais étudié';
    ELSIF v_chapter.mastery_level = 'discovery' THEN
      v_priority_score := v_priority_score + 20;
      v_reason := 'Maîtrise faible - à renforcer';
    ELSE
      v_reason := 'À réviser pour progresser';
    END IF;

    INSERT INTO priority_items (
      user_id, item_type, item_id, course_id,
      priority_score, reason, days_since_review, mastery_level,
      expires_at
    )
    VALUES (
      p_user_id, 'chapter', v_chapter.chapter_id, v_chapter.course_id,
      v_priority_score, v_reason, v_chapter.days_since, v_chapter.mastery_level,
      NOW() + INTERVAL '24 hours'
    )
    ON CONFLICT (user_id, item_type, item_id) DO UPDATE SET
      priority_score = EXCLUDED.priority_score,
      reason = EXCLUDED.reason,
      days_since_review = EXCLUDED.days_since_review,
      mastery_level = EXCLUDED.mastery_level,
      expires_at = EXCLUDED.expires_at;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Get smart CTA for a course
-- ============================================
CREATE OR REPLACE FUNCTION get_smart_cta(p_course_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_cards_to_review INTEGER;
  v_current_chapter RECORD;
  v_cta_type TEXT;
  v_cta_label TEXT;
  v_cta_target_id UUID;
  v_cta_target_type TEXT;
BEGIN
  -- Check flashcards to review (if flashcards table exists)
  BEGIN
    SELECT COUNT(*) INTO v_cards_to_review
    FROM flashcards
    WHERE course_id = p_course_id AND next_review_at <= NOW();
  EXCEPTION WHEN undefined_table THEN
    v_cards_to_review := 0;
  END;

  IF v_cards_to_review > 0 THEN
    v_cta_type := 'flashcards';
    v_cta_label := 'Réviser ' || v_cards_to_review || ' carte' || CASE WHEN v_cards_to_review > 1 THEN 's' ELSE '' END;
    v_cta_target_id := p_course_id;
    v_cta_target_type := 'flashcards';
  ELSE
    -- Find current or next chapter
    SELECT ch.id, ch.name, ch.chapter_number, cm.mastery_level
    INTO v_current_chapter
    FROM chapters ch
    LEFT JOIN chapter_mastery cm ON cm.chapter_id = ch.id AND cm.user_id = p_user_id
    WHERE ch.course_id = p_course_id
    AND (cm.mastery_level IS NULL OR cm.mastery_level NOT IN ('mastered', 'acquired'))
    ORDER BY ch.chapter_number
    LIMIT 1;

    IF v_current_chapter.id IS NOT NULL THEN
      IF v_current_chapter.mastery_level IS NULL OR v_current_chapter.mastery_level = 'not_started' THEN
        v_cta_type := 'start_chapter';
        v_cta_label := 'Commencer Ch.' || v_current_chapter.chapter_number;
      ELSE
        v_cta_type := 'continue_chapter';
        v_cta_label := 'Continuer Ch.' || v_current_chapter.chapter_number;
      END IF;
      v_cta_target_id := v_current_chapter.id;
      v_cta_target_type := 'chapter';
    ELSE
      v_cta_type := 'review';
      v_cta_label := 'Réviser le cours';
      v_cta_target_id := p_course_id;
      v_cta_target_type := 'course';
    END IF;
  END IF;

  -- Update current_chapter_id
  IF v_cta_target_type = 'chapter' THEN
    UPDATE courses SET current_chapter_id = v_cta_target_id WHERE id = p_course_id;
  END IF;

  v_result := jsonb_build_object(
    'type', v_cta_type,
    'label', v_cta_label,
    'target_id', v_cta_target_id,
    'target_type', v_cta_target_type,
    'cards_to_review', v_cards_to_review
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Toggle folder collapse
-- ============================================
CREATE OR REPLACE FUNCTION toggle_folder_collapse(p_folder_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_new_state BOOLEAN;
BEGIN
  UPDATE folders
  SET is_collapsed = NOT is_collapsed
  WHERE id = p_folder_id AND user_id = p_user_id
  RETURNING is_collapsed INTO v_new_state;

  RETURN v_new_state;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Start study session
-- ============================================
CREATE OR REPLACE FUNCTION start_study_session(
  p_user_id UUID,
  p_course_id UUID,
  p_chapter_id UUID,
  p_session_type TEXT
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO study_sessions (user_id, course_id, chapter_id, session_type)
  VALUES (p_user_id, p_course_id, p_chapter_id, p_session_type)
  RETURNING id INTO v_session_id;

  -- Update last_studied_at
  UPDATE courses SET last_studied_at = NOW() WHERE id = p_course_id;

  -- Remove corresponding priority item
  DELETE FROM priority_items
  WHERE user_id = p_user_id
  AND item_id = COALESCE(p_chapter_id, p_course_id);

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Update course mastery
-- ============================================
CREATE OR REPLACE FUNCTION update_course_mastery(p_course_id UUID)
RETURNS VOID AS $$
DECLARE
  v_mastery DECIMAL;
  v_cards_to_review INTEGER;
  v_user_id UUID;
BEGIN
  -- Get user_id from course
  SELECT user_id INTO v_user_id FROM courses WHERE id = p_course_id;

  -- Calculate average mastery
  SELECT COALESCE(
    AVG(CASE cm.mastery_level
      WHEN 'not_started' THEN 0
      WHEN 'discovery' THEN 25
      WHEN 'learning' THEN 50
      WHEN 'acquired' THEN 75
      WHEN 'mastered' THEN 100
    END),
    0
  ) INTO v_mastery
  FROM chapters ch
  LEFT JOIN chapter_mastery cm ON cm.chapter_id = ch.id AND cm.user_id = v_user_id
  WHERE ch.course_id = p_course_id;

  -- Count cards to review (if flashcards table exists)
  BEGIN
    SELECT COUNT(*) INTO v_cards_to_review
    FROM flashcards
    WHERE course_id = p_course_id AND next_review_at <= NOW();
  EXCEPTION WHEN undefined_table THEN
    v_cards_to_review := 0;
  END;

  -- Update
  UPDATE courses
  SET
    overall_mastery_percentage = v_mastery,
    cards_to_review = v_cards_to_review
  WHERE id = p_course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE study_sessions IS 'Tracks study sessions for freshness calculation';
COMMENT ON TABLE priority_items IS 'Items to review urgently, calculated on demand';
COMMENT ON FUNCTION get_courses_by_folder IS 'Returns courses organized by folder with stats';
COMMENT ON FUNCTION calculate_priority_items IS 'Calculates priority items for a user';
COMMENT ON FUNCTION get_smart_cta IS 'Returns intelligent CTA for a course';
COMMENT ON FUNCTION start_study_session IS 'Starts a study session and updates freshness';
COMMENT ON FUNCTION update_course_mastery IS 'Updates course mastery percentage';
