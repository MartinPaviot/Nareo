-- ============================================================================
-- STATS & ENGAGEMENT MODULE MIGRATION
-- Enhances gamification with XP system, chapter mastery, streak freezes,
-- weekly insights, and advanced engagement features
-- ============================================================================

-- ============================================
-- ALTER TABLE: user_gamification (add new columns)
-- ============================================
ALTER TABLE public.user_gamification
ADD COLUMN IF NOT EXISTS streak_freezes_available INTEGER DEFAULT 1 CHECK (streak_freezes_available >= 0 AND streak_freezes_available <= 3),
ADD COLUMN IF NOT EXISTS daily_goal_level TEXT DEFAULT 'standard' CHECK (daily_goal_level IN ('tranquille', 'standard', 'intensif')),
ADD COLUMN IF NOT EXISTS streak_lost_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS previous_streak_before_loss INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;

-- ============================================
-- ALTER TABLE: daily_activity (add new columns)
-- ============================================
ALTER TABLE public.daily_activity
ADD COLUMN IF NOT EXISTS daily_goal_target INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS daily_goal_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS goal_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS perfect_quizzes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_correct_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS xp_multiplier_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS streak_freeze_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS streak_freeze_used_at TIMESTAMPTZ;

-- ============================================
-- TABLE: chapter_mastery (Spaced Repetition)
-- ============================================
CREATE TABLE IF NOT EXISTS public.chapter_mastery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,

  -- Mastery level
  mastery_level TEXT DEFAULT 'not_started' CHECK (mastery_level IN (
    'not_started',  -- Never reviewed
    'discovery',    -- < 50% precision, < 5 questions
    'learning',     -- 50-69% precision
    'acquired',     -- 70-89% precision
    'mastered'      -- >= 90% precision, >= 20 questions
  )),

  -- Stats for calculating level
  total_questions_answered INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,

  -- Spaced Repetition
  last_reviewed_at TIMESTAMPTZ,
  next_review_due TIMESTAMPTZ,
  days_until_degradation INTEGER,
  degradation_warning_sent BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_chapter_mastery_user ON public.chapter_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_mastery_course ON public.chapter_mastery(course_id);
CREATE INDEX IF NOT EXISTS idx_chapter_mastery_review_due ON public.chapter_mastery(next_review_due);
CREATE INDEX IF NOT EXISTS idx_chapter_mastery_level ON public.chapter_mastery(mastery_level);

-- ============================================
-- TABLE: xp_transactions (XP history)
-- ============================================
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    -- Gains
    'question_answered', 'correct_answer', 'daily_goal_completed', 'perfect_quiz',
    'streak_milestone', 'badge_earned', 'chapter_mastered', 'correct_streak_bonus',
    'danger_chapter_bonus', 'quiz_completed',
    -- Spending
    'reward_purchase', 'streak_freeze_purchase'
  )),

  multiplier DECIMAL(3,2) DEFAULT 1.0,
  base_amount INTEGER,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON public.xp_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_type ON public.xp_transactions(transaction_type);

-- ============================================
-- TABLE: weekly_insights
-- ============================================
CREATE TABLE IF NOT EXISTS public.weekly_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  week_start DATE NOT NULL,
  week_end DATE NOT NULL,

  -- Quantitative metrics
  total_questions INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  precision_percentage DECIMAL(5,2),
  total_time_seconds INTEGER DEFAULT 0,
  days_active INTEGER DEFAULT 0,
  quizzes_completed INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,

  -- Comparison with previous week
  questions_vs_previous_week INTEGER,
  precision_vs_previous_week DECIMAL(5,2),

  -- AI-generated insights
  strength_insight TEXT,
  weakness_insight TEXT,
  tip_insight TEXT,

  -- Strongest/weakest chapter
  strongest_chapter_id UUID REFERENCES public.chapters(id),
  weakest_chapter_id UUID REFERENCES public.chapters(id),

  generated_at TIMESTAMPTZ DEFAULT NOW(),
  notification_sent BOOLEAN DEFAULT FALSE,

  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_insights_user_week ON public.weekly_insights(user_id, week_start DESC);

-- ============================================
-- TABLE: user_rewards (cosmetic purchases)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  reward_type TEXT NOT NULL CHECK (reward_type IN (
    -- Avatars
    'avatar_default', 'avatar_graduation', 'avatar_scientist', 'avatar_astronaut',
    'avatar_ninja', 'avatar_wizard', 'avatar_gold',
    -- Themes
    'theme_light', 'theme_dark', 'theme_ocean', 'theme_forest', 'theme_sunset', 'theme_exam_night',
    -- Power-ups (consumables)
    'powerup_double_xp', 'powerup_hint', 'streak_freeze'
  )),

  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  xp_cost INTEGER NOT NULL,
  is_equipped BOOLEAN DEFAULT FALSE,
  quantity INTEGER DEFAULT 1,

  UNIQUE(user_id, reward_type)
);

CREATE INDEX IF NOT EXISTS idx_user_rewards_user ON public.user_rewards(user_id);

-- ============================================
-- Add new badges for streaks and XP milestones
-- ============================================
INSERT INTO public.badges (code, name_fr, name_en, name_de, description_fr, description_en, description_de, icon, rarity)
VALUES
  ('streak_14', 'Deux Semaines', 'Two Weeks Strong', 'Zwei Wochen', '14 jours d''affilée', '14 days in a row', '14 Tage hintereinander', '🔥', 'rare'),
  ('streak_60', 'Deux Mois', 'Two Months Strong', 'Zwei Monate', '60 jours d''affilée', '60 days in a row', '60 Tage hintereinander', '🏆', 'epic'),
  ('streak_100', 'Centurion', 'Centurion', 'Zenturio', '100 jours d''affilée', '100 days in a row', '100 Tage hintereinander', '👑', 'legendary'),
  ('xp_100', 'Débutant XP', 'XP Beginner', 'XP Anfänger', 'Atteins 100 XP', 'Reach 100 XP', 'Erreiche 100 XP', '✨', 'common'),
  ('xp_500', 'Collectionneur XP', 'XP Collector', 'XP Sammler', 'Atteins 500 XP', 'Reach 500 XP', 'Erreiche 500 XP', '💫', 'common'),
  ('xp_1000', 'Expert XP', 'XP Expert', 'XP Experte', 'Atteins 1000 XP', 'Reach 1000 XP', 'Erreiche 1000 XP', '🌟', 'rare'),
  ('xp_5000', 'Maître XP', 'XP Master', 'XP Meister', 'Atteins 5000 XP', 'Reach 5000 XP', 'Erreiche 5000 XP', '⭐', 'epic'),
  ('xp_10000', 'Légende XP', 'XP Legend', 'XP Legende', 'Atteins 10000 XP', 'Reach 10000 XP', 'Erreiche 10000 XP', '🌠', 'legendary'),
  ('first_mastered_chapter', 'Premier Maître', 'First Master', 'Erster Meister', 'Maîtrise ton premier chapitre', 'Master your first chapter', 'Meistere dein erstes Kapitel', '📖', 'rare'),
  ('all_chapters_mastered', 'Maître Absolu', 'Absolute Master', 'Absoluter Meister', 'Maîtrise tous les chapitres d''un cours', 'Master all chapters of a course', 'Meistere alle Kapitel eines Kurses', '🎓', 'legendary'),
  ('ten_perfect_quizzes', 'Perfectionniste', 'Perfectionist', 'Perfektionist', 'Obtiens 10 quiz parfaits', 'Get 10 perfect quizzes', 'Erhalte 10 perfekte Quiz', '💎', 'epic'),
  ('overachiever', 'Surperformant', 'Overachiever', 'Überleistung', 'Dépasse ton objectif 7 jours de suite', 'Exceed your goal 7 days in a row', 'Übertreffe dein Ziel 7 Tage hintereinander', '🚀', 'epic'),
  ('comeback_king', 'Retour du Roi', 'Comeback King', 'König der Rückkehr', 'Reconstruis un streak de 7 après l''avoir perdu', 'Rebuild a 7-day streak after losing it', 'Baue einen 7-Tage-Streak nach dem Verlust wieder auf', '🦁', 'rare'),
  ('weekend_warrior', 'Guerrier du Weekend', 'Weekend Warrior', 'Wochenend-Krieger', 'Révise 5 weekends d''affilée', 'Study 5 weekends in a row', 'Lerne 5 Wochenenden hintereinander', '⚔️', 'rare')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- FUNCTION: Calculate daily goal based on user preferences and history
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

  v_base := CASE v_goal_level
    WHEN 'tranquille' THEN 8
    WHEN 'standard' THEN 15
    WHEN 'intensif' THEN 35
    ELSE 15
  END;

  SELECT AVG(questions_answered) INTO v_avg_recent
  FROM (
    SELECT questions_answered
    FROM public.daily_activity
    WHERE user_id = p_user_id AND questions_answered > 0
    ORDER BY activity_date DESC
    LIMIT 7
  ) recent;

  IF v_avg_recent IS NOT NULL AND v_avg_recent > 0 THEN
    v_base := ROUND((v_base + v_avg_recent) / 2);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE daily_goal_completed)::DECIMAL / NULLIF(COUNT(*), 0)
  INTO v_completion_rate
  FROM public.daily_activity
  WHERE user_id = p_user_id AND activity_date >= CURRENT_DATE - INTERVAL '7 days';

  IF v_completion_rate IS NOT NULL THEN
    IF v_completion_rate < 0.5 THEN
      v_base := ROUND(v_base * 0.8);
    ELSIF v_completion_rate > 0.9 THEN
      v_base := ROUND(v_base * 1.1);
    END IF;
  END IF;

  v_is_weekend := EXTRACT(DOW FROM CURRENT_DATE) IN (0, 6);
  IF v_is_weekend THEN
    v_base := ROUND(v_base * 0.7);
  END IF;

  v_final_goal := GREATEST(5, LEAST(50, ROUND(v_base / 5.0) * 5));

  RETURN v_final_goal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Record quiz answer with XP calculation
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

  -- Upsert daily_activity
  INSERT INTO public.daily_activity (
    user_id, activity_date, questions_answered, questions_correct, xp_earned,
    daily_goal_target, longest_correct_streak
  )
  VALUES (
    p_user_id, v_today, 1,
    CASE WHEN p_is_correct THEN 1 ELSE 0 END,
    v_final_xp, v_goal_target,
    CASE WHEN p_is_correct THEN p_current_correct_streak + 1 ELSE 0 END
  )
  ON CONFLICT (user_id, activity_date) DO UPDATE SET
    questions_answered = daily_activity.questions_answered + 1,
    questions_correct = daily_activity.questions_correct + CASE WHEN p_is_correct THEN 1 ELSE 0 END,
    xp_earned = daily_activity.xp_earned + v_final_xp,
    longest_correct_streak = GREATEST(
      daily_activity.longest_correct_streak,
      CASE WHEN p_is_correct THEN p_current_correct_streak + 1 ELSE 0 END
    ),
    updated_at = NOW();

  -- Check if goal is now completed
  SELECT (questions_answered >= daily_goal_target) INTO v_goal_completed
  FROM public.daily_activity
  WHERE user_id = p_user_id AND activity_date = v_today;

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
    'chapter_in_danger', v_chapter_in_danger
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Update chapter mastery
-- ============================================
CREATE OR REPLACE FUNCTION update_chapter_mastery(
  p_user_id UUID,
  p_chapter_id UUID,
  p_course_id UUID,
  p_is_correct BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  v_total_questions INTEGER;
  v_correct_answers INTEGER;
  v_precision DECIMAL;
  v_new_level TEXT;
  v_current_level TEXT;
  v_days_until_degrade INTEGER;
BEGIN
  -- Upsert chapter_mastery
  INSERT INTO public.chapter_mastery (user_id, chapter_id, course_id, total_questions_answered, correct_answers, last_reviewed_at)
  VALUES (p_user_id, p_chapter_id, p_course_id, 1, CASE WHEN p_is_correct THEN 1 ELSE 0 END, NOW())
  ON CONFLICT (user_id, chapter_id) DO UPDATE SET
    total_questions_answered = chapter_mastery.total_questions_answered + 1,
    correct_answers = chapter_mastery.correct_answers + CASE WHEN p_is_correct THEN 1 ELSE 0 END,
    last_reviewed_at = NOW(),
    degradation_warning_sent = FALSE,
    updated_at = NOW();

  -- Get updated stats
  SELECT total_questions_answered, correct_answers, mastery_level
  INTO v_total_questions, v_correct_answers, v_current_level
  FROM public.chapter_mastery
  WHERE user_id = p_user_id AND chapter_id = p_chapter_id;

  -- Calculate precision
  v_precision := (v_correct_answers::DECIMAL / NULLIF(v_total_questions, 0)) * 100;

  -- Determine new level
  v_new_level := CASE
    WHEN v_total_questions < 5 THEN 'discovery'
    WHEN v_precision < 50 THEN 'discovery'
    WHEN v_precision < 70 THEN 'learning'
    WHEN v_precision < 90 OR v_total_questions < 20 THEN 'acquired'
    ELSE 'mastered'
  END;

  -- Calculate days until degradation
  v_days_until_degrade := CASE v_new_level
    WHEN 'mastered' THEN 14
    WHEN 'acquired' THEN 10
    WHEN 'learning' THEN 7
    ELSE NULL
  END;

  -- Update mastery
  UPDATE public.chapter_mastery
  SET
    mastery_level = v_new_level,
    days_until_degradation = v_days_until_degrade,
    next_review_due = CASE
      WHEN v_days_until_degrade IS NOT NULL THEN CURRENT_DATE + (v_days_until_degrade * INTERVAL '1 day')
      ELSE NULL
    END
  WHERE user_id = p_user_id AND chapter_id = p_chapter_id;

  -- Award badge if first mastered chapter
  IF v_new_level = 'mastered' AND v_current_level != 'mastered' THEN
    INSERT INTO public.user_badges (user_id, badge_id)
    SELECT p_user_id, id FROM public.badges WHERE code = 'first_mastered_chapter'
    ON CONFLICT DO NOTHING;

    -- XP bonus for mastering chapter
    UPDATE public.user_gamification
    SET total_xp = total_xp + 100,
        total_points = total_points + 100
    WHERE user_id = p_user_id;

    INSERT INTO public.xp_transactions (user_id, amount, transaction_type, metadata)
    VALUES (p_user_id, 100, 'chapter_mastered', jsonb_build_object('chapter_id', p_chapter_id));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Check and update streak (called on login)
-- ============================================
CREATE OR REPLACE FUNCTION check_and_update_streak(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_last_activity DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_freezes INTEGER;
  v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
  v_streak_state TEXT;
  v_previous_streak INTEGER;
  v_freeze_used BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
  -- Get current stats
  SELECT last_activity_date, current_streak, longest_streak, streak_freezes_available, previous_streak_before_loss
  INTO v_last_activity, v_current_streak, v_longest_streak, v_freezes, v_previous_streak
  FROM public.user_gamification
  WHERE user_id = p_user_id;

  -- If no stats, create initial record
  IF v_last_activity IS NULL THEN
    INSERT INTO public.user_gamification (user_id, streak_freezes_available)
    VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN jsonb_build_object('streak_state', 'new_user', 'current_streak', 0, 'longest_streak', 0, 'freezes_available', 1, 'previous_streak_lost', 0);
  END IF;

  v_current_streak := COALESCE(v_current_streak, 0);
  v_longest_streak := COALESCE(v_longest_streak, 0);
  v_freezes := COALESCE(v_freezes, 1);
  v_previous_streak := COALESCE(v_previous_streak, 0);

  -- Determine streak state
  IF v_last_activity = CURRENT_DATE THEN
    v_streak_state := 'on_fire';

  ELSIF v_last_activity = v_yesterday THEN
    v_streak_state := 'at_risk';

  ELSIF v_last_activity < v_yesterday THEN
    -- Check if freeze was used yesterday
    SELECT streak_freeze_used INTO v_freeze_used
    FROM public.daily_activity
    WHERE user_id = p_user_id AND activity_date = v_yesterday;

    IF COALESCE(v_freeze_used, FALSE) THEN
      v_streak_state := 'protected';
    ELSIF v_freezes > 0 AND v_current_streak > 0 THEN
      -- Auto-activate freeze for yesterday
      INSERT INTO public.daily_activity (user_id, activity_date, daily_goal_target, streak_freeze_used, streak_freeze_used_at)
      VALUES (p_user_id, v_yesterday, 0, TRUE, NOW())
      ON CONFLICT (user_id, activity_date) DO UPDATE SET
        streak_freeze_used = TRUE,
        streak_freeze_used_at = NOW();

      UPDATE public.user_gamification
      SET streak_freezes_available = streak_freezes_available - 1
      WHERE user_id = p_user_id;

      v_streak_state := 'protected';
      v_freeze_used := TRUE;
      v_freezes := v_freezes - 1;
    ELSE
      -- Streak lost
      v_previous_streak := v_current_streak;

      UPDATE public.user_gamification
      SET
        previous_streak_before_loss = current_streak,
        current_streak = 0,
        streak_lost_at = NOW()
      WHERE user_id = p_user_id;

      v_current_streak := 0;
      v_streak_state := 'lost';
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'streak_state', v_streak_state,
    'current_streak', v_current_streak,
    'longest_streak', v_longest_streak,
    'freezes_available', v_freezes,
    'previous_streak_lost', v_previous_streak
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Check streak milestones and award rewards
-- ============================================
CREATE OR REPLACE FUNCTION check_streak_milestones(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_current_streak INTEGER;
  v_milestones INTEGER[] := ARRAY[3, 7, 14, 30, 60, 100];
  v_milestone INTEGER;
  v_badge_code TEXT;
  v_xp_reward INTEGER;
  v_freeze_reward BOOLEAN;
  v_rewards JSONB := '[]'::JSONB;
  v_badge_id UUID;
BEGIN
  SELECT current_streak INTO v_current_streak
  FROM public.user_gamification WHERE user_id = p_user_id;

  v_current_streak := COALESCE(v_current_streak, 0);

  FOREACH v_milestone IN ARRAY v_milestones
  LOOP
    IF v_current_streak >= v_milestone THEN
      v_badge_code := 'streak_' || v_milestone;

      -- Get badge id
      SELECT id INTO v_badge_id FROM public.badges WHERE code = v_badge_code;

      IF v_badge_id IS NOT NULL THEN
        -- Try to insert badge
        INSERT INTO public.user_badges (user_id, badge_id)
        VALUES (p_user_id, v_badge_id)
        ON CONFLICT DO NOTHING;

        -- If newly inserted
        IF FOUND THEN
          v_xp_reward := CASE v_milestone
            WHEN 3 THEN 50
            WHEN 7 THEN 100
            WHEN 14 THEN 200
            WHEN 30 THEN 500
            WHEN 60 THEN 1000
            WHEN 100 THEN 2000
            ELSE 0
          END;

          v_freeze_reward := v_milestone IN (7, 30, 60);

          -- Award XP and freeze
          UPDATE public.user_gamification
          SET total_xp = total_xp + v_xp_reward,
              total_points = total_points + v_xp_reward,
              streak_freezes_available = streak_freezes_available + CASE WHEN v_freeze_reward THEN 1 ELSE 0 END
          WHERE user_id = p_user_id;

          INSERT INTO public.xp_transactions (user_id, amount, transaction_type, metadata)
          VALUES (p_user_id, v_xp_reward, 'streak_milestone', jsonb_build_object('milestone', v_milestone));

          v_rewards := v_rewards || jsonb_build_object(
            'milestone', v_milestone,
            'badge', v_badge_code,
            'xp', v_xp_reward,
            'freeze', v_freeze_reward
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN v_rewards;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Complete quiz with bonuses
-- ============================================
CREATE OR REPLACE FUNCTION complete_quiz_with_bonus(
  p_user_id UUID,
  p_quiz_id UUID,
  p_total_questions INTEGER,
  p_correct_answers INTEGER,
  p_chapter_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_precision DECIMAL;
  v_is_perfect BOOLEAN;
  v_xp_bonus INTEGER := 0;
  v_badges_earned TEXT[] := '{}';
  v_today DATE := CURRENT_DATE;
  v_badge_id UUID;
BEGIN
  v_precision := (p_correct_answers::DECIMAL / NULLIF(p_total_questions, 0)) * 100;
  v_is_perfect := (p_correct_answers = p_total_questions);

  -- Update daily activity
  UPDATE public.daily_activity
  SET quizzes_completed = quizzes_completed + 1,
      perfect_quizzes = perfect_quizzes + CASE WHEN v_is_perfect THEN 1 ELSE 0 END
  WHERE user_id = p_user_id AND activity_date = v_today;

  -- Perfect quiz bonus
  IF v_is_perfect THEN
    v_xp_bonus := 50;

    UPDATE public.user_gamification
    SET total_xp = total_xp + v_xp_bonus,
        total_points = total_points + v_xp_bonus
    WHERE user_id = p_user_id;

    INSERT INTO public.xp_transactions (user_id, amount, transaction_type, metadata)
    VALUES (p_user_id, v_xp_bonus, 'perfect_quiz', jsonb_build_object('quiz_id', p_quiz_id));

    -- Check first perfect quiz badge
    SELECT id INTO v_badge_id FROM public.badges WHERE code = 'perfect_score';
    IF v_badge_id IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (p_user_id, v_badge_id)
      ON CONFLICT DO NOTHING;

      IF FOUND THEN
        v_badges_earned := array_append(v_badges_earned, 'perfect_score');
      END IF;
    END IF;
  END IF;

  -- First quiz badge
  SELECT id INTO v_badge_id FROM public.badges WHERE code = 'first_quiz';
  IF v_badge_id IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (p_user_id, v_badge_id)
    ON CONFLICT DO NOTHING;

    IF FOUND THEN
      v_badges_earned := array_append(v_badges_earned, 'first_quiz');
    END IF;
  END IF;

  -- Update user gamification totals
  UPDATE public.user_gamification
  SET total_quizzes_completed = total_quizzes_completed + 1
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'precision', v_precision,
    'is_perfect', v_is_perfect,
    'xp_bonus', v_xp_bonus,
    'badges_earned', v_badges_earned
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Degrade stale chapters (CRON job)
-- ============================================
CREATE OR REPLACE FUNCTION degrade_stale_chapters()
RETURNS INTEGER AS $$
DECLARE
  v_degraded_count INTEGER := 0;
BEGIN
  -- Send warnings 2 days before degradation
  UPDATE public.chapter_mastery
  SET degradation_warning_sent = TRUE
  WHERE next_review_due <= CURRENT_DATE + INTERVAL '2 days'
    AND next_review_due > CURRENT_DATE
    AND degradation_warning_sent = FALSE
    AND mastery_level IN ('mastered', 'acquired', 'learning');

  -- Degrade expired chapters
  WITH degraded AS (
    UPDATE public.chapter_mastery
    SET
      mastery_level = CASE mastery_level
        WHEN 'mastered' THEN 'acquired'
        WHEN 'acquired' THEN 'learning'
        WHEN 'learning' THEN 'discovery'
        ELSE mastery_level
      END,
      days_until_degradation = CASE
        WHEN mastery_level = 'mastered' THEN 10
        WHEN mastery_level = 'acquired' THEN 7
        ELSE NULL
      END,
      next_review_due = CASE
        WHEN mastery_level IN ('mastered', 'acquired') THEN CURRENT_DATE + INTERVAL '7 days'
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE next_review_due < CURRENT_DATE
      AND mastery_level IN ('mastered', 'acquired', 'learning')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_degraded_count FROM degraded;

  RETURN v_degraded_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.chapter_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

-- chapter_mastery policies
DROP POLICY IF EXISTS "Users can view own chapter mastery" ON public.chapter_mastery;
CREATE POLICY "Users can view own chapter mastery"
  ON public.chapter_mastery FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chapter mastery" ON public.chapter_mastery;
CREATE POLICY "Users can insert own chapter mastery"
  ON public.chapter_mastery FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chapter mastery" ON public.chapter_mastery;
CREATE POLICY "Users can update own chapter mastery"
  ON public.chapter_mastery FOR UPDATE
  USING (auth.uid() = user_id);

-- xp_transactions policies
DROP POLICY IF EXISTS "Users can view own xp transactions" ON public.xp_transactions;
CREATE POLICY "Users can view own xp transactions"
  ON public.xp_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert xp transactions" ON public.xp_transactions;
CREATE POLICY "System can insert xp transactions"
  ON public.xp_transactions FOR INSERT
  WITH CHECK (true);

-- weekly_insights policies
DROP POLICY IF EXISTS "Users can view own weekly insights" ON public.weekly_insights;
CREATE POLICY "Users can view own weekly insights"
  ON public.weekly_insights FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert weekly insights" ON public.weekly_insights;
CREATE POLICY "System can insert weekly insights"
  ON public.weekly_insights FOR INSERT
  WITH CHECK (true);

-- user_rewards policies
DROP POLICY IF EXISTS "Users can view own rewards" ON public.user_rewards;
CREATE POLICY "Users can view own rewards"
  ON public.user_rewards FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own rewards" ON public.user_rewards;
CREATE POLICY "Users can insert own rewards"
  ON public.user_rewards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own rewards" ON public.user_rewards;
CREATE POLICY "Users can update own rewards"
  ON public.user_rewards FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public.chapter_mastery IS 'Tracks mastery level per chapter with spaced repetition';
COMMENT ON TABLE public.xp_transactions IS 'History of XP gains and spending';
COMMENT ON TABLE public.weekly_insights IS 'Weekly performance summaries with AI insights';
COMMENT ON TABLE public.user_rewards IS 'Cosmetic rewards purchased by users';
COMMENT ON FUNCTION calculate_daily_goal IS 'Calculates personalized daily goal based on user history';
COMMENT ON FUNCTION record_quiz_answer_with_xp IS 'Records a quiz answer and calculates XP with multipliers';
COMMENT ON FUNCTION update_chapter_mastery IS 'Updates chapter mastery level based on performance';
COMMENT ON FUNCTION check_and_update_streak IS 'Checks streak status on login and handles freezes';
COMMENT ON FUNCTION check_streak_milestones IS 'Awards badges and XP for streak milestones';
COMMENT ON FUNCTION complete_quiz_with_bonus IS 'Completes a quiz and awards bonuses';
COMMENT ON FUNCTION degrade_stale_chapters IS 'CRON function to degrade chapters not reviewed';
