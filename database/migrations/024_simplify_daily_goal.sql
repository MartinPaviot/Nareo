-- Migration 024: Simplify daily goal calculation
-- Remove dynamic adjustments and always use the base value for the selected level

CREATE OR REPLACE FUNCTION calculate_daily_goal(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_goal_level TEXT;
  v_base INTEGER;
BEGIN
  -- Get user's selected goal level
  SELECT daily_goal_level INTO v_goal_level
  FROM public.user_gamification WHERE user_id = p_user_id;

  v_goal_level := COALESCE(v_goal_level, 'standard');

  -- Return the fixed base value for each level
  v_base := CASE v_goal_level
    WHEN 'tranquille' THEN 8
    WHEN 'standard' THEN 15
    WHEN 'intensif' THEN 35
    ELSE 15
  END;

  RETURN v_base;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_daily_goal IS 'Returns the daily goal based on user selected level (tranquille=8, standard=15, intensif=35)';
