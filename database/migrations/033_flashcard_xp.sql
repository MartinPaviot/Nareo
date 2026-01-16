-- ============================================================================
-- FLASHCARD XP MIGRATION
-- Adds XP rewards for flashcard reviews to align with quiz XP system
-- Formula: Hard=3 XP, Good=5 XP, Easy=4 XP (~5 XP per activity unit)
-- ============================================================================

-- ============================================
-- FUNCTION: Updated record_flashcard_session_activity with XP
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
  v_xp_earned INTEGER;
  v_goal_target INTEGER;
  v_current_units DECIMAL(8,2);
  v_goal_completed BOOLEAN;
  v_was_goal_completed BOOLEAN;
  v_total_xp INTEGER;
  v_result JSONB;
BEGIN
  -- Calculate total reviewed and activity units
  v_total_reviewed := p_hard + p_good + p_easy;

  -- Activity units formula:
  -- Hard: 0.5 units (user struggled)
  -- Good: 1.0 units (standard learning)
  -- Easy: 0.75 units (too easy = less learning value)
  v_activity_units := (p_hard * 0.5) + (p_good * 1.0) + (p_easy * 0.75);

  -- XP formula (aligned with quiz ~5 XP per unit):
  -- Hard: 3 XP (0.5 unit -> 6 XP/unit ratio, rewards effort despite struggle)
  -- Good: 5 XP (1.0 unit -> 5 XP/unit ratio, optimal learning)
  -- Easy: 4 XP (0.75 unit -> 5.3 XP/unit ratio, successful review)
  v_xp_earned := (p_hard * 3) + (p_good * 5) + (p_easy * 4);

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

  -- Upsert daily_activity with flashcard data and XP
  INSERT INTO public.daily_activity (
    user_id, activity_date, daily_goal_target,
    flashcards_reviewed, flashcards_hard, flashcards_good, flashcards_easy,
    activity_units, xp_earned
  )
  VALUES (
    p_user_id, v_today, v_goal_target,
    v_total_reviewed,
    p_hard,
    p_good,
    p_easy,
    v_activity_units,
    v_xp_earned
  )
  ON CONFLICT (user_id, activity_date) DO UPDATE SET
    flashcards_reviewed = daily_activity.flashcards_reviewed + v_total_reviewed,
    flashcards_hard = daily_activity.flashcards_hard + p_hard,
    flashcards_good = daily_activity.flashcards_good + p_good,
    flashcards_easy = daily_activity.flashcards_easy + p_easy,
    activity_units = daily_activity.activity_units + v_activity_units,
    xp_earned = daily_activity.xp_earned + v_xp_earned,
    updated_at = NOW();

  -- Get updated units
  SELECT activity_units INTO v_current_units
  FROM public.daily_activity
  WHERE user_id = p_user_id AND activity_date = v_today;

  -- Check goal completion
  v_goal_completed := v_current_units >= v_goal_target;

  -- Track total XP (base + potential goal bonus)
  v_total_xp := v_xp_earned;

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

    v_total_xp := v_total_xp + 25;

    -- Update user_gamification with flashcard XP + goal bonus
    UPDATE public.user_gamification
    SET
      total_xp = total_xp + v_total_xp,
      total_points = total_points + v_total_xp,
      last_activity_date = v_today,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    -- Update user_gamification with flashcard XP only
    UPDATE public.user_gamification
    SET
      total_xp = total_xp + v_xp_earned,
      total_points = total_points + v_xp_earned,
      last_activity_date = v_today,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- Record XP transaction for flashcard review
  IF v_xp_earned > 0 THEN
    INSERT INTO public.xp_transactions (user_id, amount, transaction_type, base_amount, multiplier, metadata)
    VALUES (
      p_user_id,
      v_xp_earned,
      'flashcard_review',
      v_xp_earned,
      1.0,
      jsonb_build_object(
        'hard', p_hard,
        'good', p_good,
        'easy', p_easy,
        'course_id', p_course_id
      )
    );
  END IF;

  v_result := jsonb_build_object(
    'flashcards_reviewed', v_total_reviewed,
    'activity_units_added', v_activity_units,
    'current_activity_units', v_current_units,
    'goal_target', v_goal_target,
    'goal_completed', v_goal_completed,
    'goal_just_completed', v_goal_completed AND NOT COALESCE(v_was_goal_completed, FALSE),
    'xp_earned', v_xp_earned,
    'total_xp_with_bonus', v_total_xp
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON FUNCTION record_flashcard_session_activity IS 'Records flashcard session, awards XP (Hard=3, Good=5, Easy=4), and updates activity units toward daily goal';
