-- ============================================================================
-- FIX: Course mastery calculation
-- The previous function didn't count chapters without mastery data as 0%
-- Also fixed: next_review_at column doesn't exist in flashcards
-- ============================================================================

CREATE OR REPLACE FUNCTION update_course_mastery(p_course_id UUID)
RETURNS VOID AS $$
DECLARE
  v_mastery DECIMAL;
  v_cards_to_review INTEGER := 0;
  v_user_id UUID;
BEGIN
  -- Get user_id from course
  SELECT user_id INTO v_user_id FROM courses WHERE id = p_course_id;

  -- Calculate average mastery (chapters without data count as 0%)
  SELECT COALESCE(
    AVG(
      COALESCE(
        CASE cm.mastery_level
          WHEN 'not_started' THEN 0
          WHEN 'discovery' THEN 25
          WHEN 'learning' THEN 50
          WHEN 'acquired' THEN 75
          WHEN 'mastered' THEN 100
        END,
        0  -- Chapters without chapter_mastery entry count as 0%
      )
    ),
    0
  ) INTO v_mastery
  FROM chapters ch
  LEFT JOIN chapter_mastery cm ON cm.chapter_id = ch.id AND cm.user_id = v_user_id
  WHERE ch.course_id = p_course_id;

  -- Update course (cards_to_review is not calculated here anymore)
  UPDATE courses
  SET overall_mastery_percentage = v_mastery
  WHERE id = p_course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_course_mastery IS 'Updates course mastery percentage (fixed to count all chapters)';
