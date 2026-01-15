-- ============================================================================
-- UNIFIED ACTIVITY UNITS MIGRATION
-- Transforms daily goal to include both quiz questions AND flashcard reviews
-- using "activity units" where each activity contributes based on difficulty
-- ============================================================================

-- ============================================
-- ALTER TABLE: daily_activity (add flashcard tracking columns)
-- ============================================
ALTER TABLE public.daily_activity
ADD COLUMN IF NOT EXISTS flashcards_reviewed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS flashcards_hard INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS flashcards_good INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS flashcards_easy INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS activity_units DECIMAL(8,2) DEFAULT 0;

-- Backfill: activity_units = questions_answered for existing data
UPDATE public.daily_activity
SET activity_units = questions_answered
WHERE activity_units = 0 OR activity_units IS NULL;

-- ============================================
-- FUNCTION: Updated calculate_daily_goal with new thresholds
-- Tranquille: 20, Standard: 35, Intensif: 60
-- ============================================
CREATE OR REPLACE FUNCTION calculate_daily_goal(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_goal_level TEXT;
  v_base INTEGER;
  v_avg_recent DECIMAL;
  v_completion_rate DECIMAL;
  v_is_weekend BOOLEAN;
  v_final_goal INTEGER;
BEGIN
  SELECT daily_goal_level INTO v_goal_level
  FROM public.user_gamification WHERE user_id = p_user_id;

  v_goal_level := COALESCE(v_goal_level, 'standard');

  -- New thresholds for unified activity units
  v_base := CASE v_goal_level
    WHEN 'tranquille' THEN 20
    WHEN 'standard' THEN 35
    WHEN 'intensif' THEN 60
    ELSE 35
  END;

  -- Adjust based on recent activity (using activity_units now)
  SELECT AVG(activity_units) INTO v_avg_recent
  FROM (
    SELECT activity_units
    FROM public.daily_activity
    WHERE user_id = p_user_id AND activity_units > 0
    ORDER BY activity_date DESC
    LIMIT 7
  ) recent;

  IF v_avg_recent IS NOT NULL AND v_avg_recent > 0 THEN
    v_base := ROUND((v_base + v_avg_recent) / 2);
  END IF;

  -- Adjust based on completion rate
  SELECT
    COUNT(*) FILTER (WHERE daily_goal_completed)::DECIMAL / NULLIF(COUNT(*), 0)
  INTO v_completion_rate
  FROM public.daily_activity
  WHERE user_id = p_user_id AND activity_date >= CURRENT_DATE - INTERVAL '7 days';

  IF v_completion_rate IS NOT NULL THEN
    IF v_completion_rate < 0.5 THEN
      v_base := ROUND(v_base * 0.9);
    ELSIF v_completion_rate > 0.9 THEN
      v_base := ROUND(v_base * 1.1);
    END IF;
  END IF;

  -- Weekend reduction
  v_is_weekend := EXTRACT(DOW FROM CURRENT_DATE) IN (0, 6);
  IF v_is_weekend THEN
    v_base := ROUND(v_base * 0.7);
  END IF;

  -- Constrain to reasonable bounds (min 10, max 100 for new system)
  v_final_goal := GREATEST(10, LEAST(100, ROUND(v_base / 5.0) * 5));

  RETURN v_final_goal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Updated record_quiz_answer_with_xp to track activity_units
-- ============================================
CREATE OR REPLACE FUNCTION record_quiz_answer_with_xp(
  p_user_id UUID,
  p_chapter_id UUID,
  p_course_id UUID,
  p_is_correct BOOLEAN,
  p_current_correct_streak INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_base_xp INTEGER;
  v_multiplier DECIMAL(3,2) := 1.0;
  v_final_xp INTEGER;
  v_goal_target INTEGER;
  v_goal_completed BOOLEAN;
  v_was_goal_completed BOOLEAN;
  v_chapter_in_danger BOOLEAN := FALSE;
  v_current_units DECIMAL(8,2);
  v_result JSONB;
BEGIN
  -- Calculate base XP
  v_base_xp := 5;
  IF p_is_correct THEN
    v_base_xp := v_base_xp + 5;
  END IF;

  -- Check if chapter is "in danger" (will degrade soon)
  SELECT (days_until_degradation <= 2 AND days_until_degradation > 0) INTO v_chapter_in_danger
  FROM public.chapter_mastery
  WHERE user_id = p_user_id AND chapter_id = p_chapter_id;

  v_chapter_in_danger := COALESCE(v_chapter_in_danger, FALSE);

  IF v_chapter_in_danger THEN
    v_multiplier := 2.0;
  ELSIF p_current_correct_streak >= 5 THEN
    v_multiplier := 1.5;
  END IF;

  v_final_xp := ROUND(v_base_xp * v_multiplier);

  -- Get or calculate today's goal
  SELECT daily_goal_target, daily_goal_completed INTO v_goal_target, v_was_goal_completed
  FROM public.daily_activity
  WHERE user_id = p_user_id AND activity_date = v_today;

  IF v_goal_target IS NULL THEN
    v_goal_target := calculate_daily_goal(p_user_id);
  END IF;

  -- Upsert daily_activity (now includes activity_units)
  INSERT INTO public.daily_activity (
    user_id, activity_date, questions_answered, questions_correct, xp_earned,
    daily_goal_target, longest_correct_streak, activity_units
  )
  VALUES (
    p_user_id, v_today, 1,
    CASE WHEN p_is_correct THEN 1 ELSE 0 END,
    v_final_xp, v_goal_target,
    CASE WHEN p_is_correct THEN p_current_correct_streak + 1 ELSE 0 END,
    1.0  -- Each quiz question = 1 activity unit
  )
  ON CONFLICT (user_id, activity_date) DO UPDATE SET
    questions_answered = daily_activity.questions_answered + 1,
    questions_correct = daily_activity.questions_correct + CASE WHEN p_is_correct THEN 1 ELSE 0 END,
    xp_earned = daily_activity.xp_earned + v_final_xp,
    longest_correct_streak = GREATEST(
      daily_activity.longest_correct_streak,
      CASE WHEN p_is_correct THEN p_current_correct_streak + 1 ELSE 0 END
    ),
    activity_units = daily_activity.activity_units + 1.0,  -- +1 unit per quiz question
    updated_at = NOW();

  -- Get current activity units for goal check
  SELECT activity_units INTO v_current_units
  FROM public.daily_activity
  WHERE user_id = p_user_id AND activity_date = v_today;

  -- Check if goal is now completed (based on activity_units)
  v_goal_completed := v_current_units >= v_goal_target;

  -- If goal just completed, add bonus XP
  IF v_goal_completed AND NOT COALESCE(v_was_goal_completed, FALSE) THEN
    UPDATE public.daily_activity
    SET daily_goal_completed = TRUE,
        goal_completed_at = NOW(),
        xp_earned = xp_earned + 25
    WHERE user_id = p_user_id AND activity_date = v_today;

    INSERT INTO public.xp_transactions (user_id, amount, transaction_type, base_amount, multiplier)
    VALUES (p_user_id, 25, 'daily_goal_completed', 25, 1.0);

    v_final_xp := v_final_xp + 25;
  END IF;

  -- Update user_gamification totals
  UPDATE public.user_gamification
  SET
    total_xp = total_xp + v_final_xp,
    total_points = total_points + v_final_xp,
    last_activity_date = v_today,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- If no row updated, insert one
  IF NOT FOUND THEN
    INSERT INTO public.user_gamification (user_id, total_xp, total_points, last_activity_date)
    VALUES (p_user_id, v_final_xp, v_final_xp, v_today)
    ON CONFLICT (user_id) DO UPDATE SET
      total_xp = user_gamification.total_xp + v_final_xp,
      total_points = user_gamification.total_points + v_final_xp,
      last_activity_date = v_today,
      updated_at = NOW();
  END IF;

  -- Update chapter mastery
  PERFORM update_chapter_mastery(p_user_id, p_chapter_id, p_course_id, p_is_correct);

  -- Record XP transaction
  INSERT INTO public.xp_transactions (user_id, amount, transaction_type, base_amount, multiplier, metadata)
  VALUES (p_user_id, v_final_xp - CASE WHEN v_goal_completed AND NOT COALESCE(v_was_goal_completed, FALSE) THEN 25 ELSE 0 END,
    CASE WHEN p_is_correct THEN 'correct_answer' ELSE 'question_answered' END,
    v_base_xp, v_multiplier,
    jsonb_build_object('chapter_id', p_chapter_id, 'correct_streak', p_current_correct_streak)
  );

  v_result := jsonb_build_object(
    'xp_earned', v_final_xp,
    'multiplier', v_multiplier,
    'goal_completed', v_goal_completed,
    'chapter_in_danger', v_chapter_in_danger,
    'activity_units', v_current_units
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Record flashcard session activity
-- Called at the end of a flashcard review session
-- ============================================
CREATE OR REPLACE FUNCTION record_flashcard_session_activity(
  p_user_id UUID,
  p_hard INTEGER,
  p_good INTEGER,
  p_easy INTEGER,
  p_course_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_total_reviewed INTEGER;
  v_activity_units DECIMAL(8,2);
  v_goal_target INTEGER;
  v_current_units DECIMAL(8,2);
  v_goal_completed BOOLEAN;
  v_was_goal_completed BOOLEAN;
  v_result JSONB;
BEGIN
  -- Calculate total reviewed and activity units
  v_total_reviewed := p_hard + p_good + p_easy;

  -- Activity units formula:
  -- Hard: 0.5 units (user struggled)
  -- Good: 1.0 units (standard learning)
  -- Easy: 0.75 units (too easy = less learning value)
  v_activity_units := (p_hard * 0.5) + (p_good * 1.0) + (p_easy * 0.75);

  -- Get current daily_activity state
  SELECT daily_goal_target, daily_goal_completed, activity_units
  INTO v_goal_target, v_was_goal_completed, v_current_units
  FROM public.daily_activity
  WHERE user_id = p_user_id AND activity_date = v_today;

  IF v_goal_target IS NULL THEN
    v_goal_target := calculate_daily_goal(p_user_id);
    v_current_units := 0;
  END IF;

  v_current_units := COALESCE(v_current_units, 0);

  -- Upsert daily_activity with flashcard data
  INSERT INTO public.daily_activity (
    user_id, activity_date, daily_goal_target,
    flashcards_reviewed, flashcards_hard, flashcards_good, flashcards_easy,
    activity_units
  )
  VALUES (
    p_user_id, v_today, v_goal_target,
    v_total_reviewed,
    p_hard,
    p_good,
    p_easy,
    v_activity_units
  )
  ON CONFLICT (user_id, activity_date) DO UPDATE SET
    flashcards_reviewed = daily_activity.flashcards_reviewed + v_total_reviewed,
    flashcards_hard = daily_activity.flashcards_hard + p_hard,
    flashcards_good = daily_activity.flashcards_good + p_good,
    flashcards_easy = daily_activity.flashcards_easy + p_easy,
    activity_units = daily_activity.activity_units + v_activity_units,
    updated_at = NOW();

  -- Get updated units
  SELECT activity_units INTO v_current_units
  FROM public.daily_activity
  WHERE user_id = p_user_id AND activity_date = v_today;

  -- Check goal completion
  v_goal_completed := v_current_units >= v_goal_target;

  -- If goal just completed, mark it and award bonus XP
  IF v_goal_completed AND NOT COALESCE(v_was_goal_completed, FALSE) THEN
    UPDATE public.daily_activity
    SET daily_goal_completed = TRUE,
        goal_completed_at = NOW(),
        xp_earned = xp_earned + 25
    WHERE user_id = p_user_id AND activity_date = v_today;

    -- Record XP transaction for goal completion
    INSERT INTO public.xp_transactions (user_id, amount, transaction_type, base_amount, multiplier)
    VALUES (p_user_id, 25, 'daily_goal_completed', 25, 1.0);

    -- Update user_gamification
    UPDATE public.user_gamification
    SET
      total_xp = total_xp + 25,
      total_points = total_points + 25,
      last_activity_date = v_today,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    -- Just update last_activity_date
    UPDATE public.user_gamification
    SET
      last_activity_date = v_today,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  v_result := jsonb_build_object(
    'flashcards_reviewed', v_total_reviewed,
    'activity_units_added', v_activity_units,
    'current_activity_units', v_current_units,
    'goal_target', v_goal_target,
    'goal_completed', v_goal_completed,
    'goal_just_completed', v_goal_completed AND NOT COALESCE(v_was_goal_completed, FALSE)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN public.daily_activity.flashcards_reviewed IS 'Total flashcards reviewed today';
COMMENT ON COLUMN public.daily_activity.flashcards_hard IS 'Flashcards rated as Hard';
COMMENT ON COLUMN public.daily_activity.flashcards_good IS 'Flashcards rated as Good';
COMMENT ON COLUMN public.daily_activity.flashcards_easy IS 'Flashcards rated as Easy';
COMMENT ON COLUMN public.daily_activity.activity_units IS 'Unified activity units: quiz=1.0, flashcard hard=0.5, good=1.0, easy=0.75';
COMMENT ON FUNCTION record_flashcard_session_activity IS 'Records flashcard session and updates activity units toward daily goal';
