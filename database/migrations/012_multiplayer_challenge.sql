-- ============================================================================
-- MULTIPLAYER CHALLENGE MODE MIGRATION
-- Adds tables for real-time multiplayer quizzes, friendships, and leaderboards
-- ============================================================================

-- ============================================
-- TABLE: user_profiles (profil public)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  friend_code TEXT UNIQUE, -- Code court pour ajouter des amis (ex: MARTIN-7294)
  total_points INTEGER DEFAULT 0,
  total_challenges_played INTEGER DEFAULT 0,
  total_challenges_won INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generate a unique friend_code on creation
CREATE OR REPLACE FUNCTION generate_friend_code()
RETURNS TRIGGER AS $$
DECLARE
  base_name TEXT;
  random_suffix TEXT;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Clean display name (remove special chars, limit to 6 chars)
  base_name := UPPER(REGEXP_REPLACE(SUBSTRING(NEW.display_name FROM 1 FOR 6), '[^A-Z0-9]', '', 'g'));
  IF LENGTH(base_name) < 3 THEN
    base_name := 'USER';
  END IF;

  -- Generate random suffix and check uniqueness
  LOOP
    random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    new_code := base_name || '-' || random_suffix;

    SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE friend_code = new_code) INTO code_exists;
    IF NOT code_exists THEN
      NEW.friend_code := new_code;
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_friend_code ON public.user_profiles;
CREATE TRIGGER trigger_generate_friend_code
BEFORE INSERT ON public.user_profiles
FOR EACH ROW
WHEN (NEW.friend_code IS NULL)
EXECUTE FUNCTION generate_friend_code();

CREATE INDEX IF NOT EXISTS idx_user_profiles_friend_code ON public.user_profiles(friend_code);

-- ============================================
-- TABLE: friendships (relations d'amitié)
-- ============================================
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicates
  UNIQUE(user_id, friend_id),

  -- Prevent self-friending
  CHECK (user_id != friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);

-- ============================================
-- TABLE: weekly_points (points hebdomadaires)
-- ============================================
CREATE TABLE IF NOT EXISTS public.weekly_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, -- Monday of the week
  points INTEGER DEFAULT 0,
  challenges_played INTEGER DEFAULT 0,
  challenges_won INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_points_user_week ON public.weekly_points(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_points_week_points ON public.weekly_points(week_start, points DESC);

-- ============================================
-- TABLE: challenges (défis)
-- ============================================
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- Ex: WACC-4829
  host_id UUID NOT NULL REFERENCES auth.users(id),

  -- Link to existing content
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,

  -- Configuration
  mode TEXT NOT NULL DEFAULT 'standard' CHECK (mode IN ('sprint', 'standard', 'marathon')),
  question_count INTEGER NOT NULL DEFAULT 15,
  time_per_question INTEGER NOT NULL DEFAULT 20, -- seconds

  -- State
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'starting', 'playing', 'finished', 'cancelled')),
  current_question_index INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_challenges_code ON public.challenges(code);
CREATE INDEX IF NOT EXISTS idx_challenges_host ON public.challenges(host_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);

-- ============================================
-- TABLE: challenge_players (participants)
-- ============================================
CREATE TABLE IF NOT EXISTS public.challenge_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id), -- NULL if guest without account

  -- Player info
  display_name TEXT NOT NULL,
  is_guest BOOLEAN DEFAULT FALSE,

  -- In-game state
  is_ready BOOLEAN DEFAULT FALSE,
  is_connected BOOLEAN DEFAULT TRUE,

  -- Scores
  score INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  total_answers INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  average_response_time_ms INTEGER,

  -- Final rank
  final_rank INTEGER,
  points_earned INTEGER DEFAULT 0,

  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_challenge_players_challenge ON public.challenge_players(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_players_user ON public.challenge_players(user_id);

-- ============================================
-- TABLE: challenge_questions (questions du défi)
-- ============================================
CREATE TABLE IF NOT EXISTS public.challenge_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL, -- 0, 1, 2...

  -- Copy of the question (for history)
  question_type TEXT NOT NULL, -- 'multiple_choice', 'true_false', 'fill_blank'
  question_data JSONB NOT NULL, -- The complete question
  correct_answer TEXT NOT NULL,

  -- Timestamps
  shown_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  UNIQUE(challenge_id, question_index)
);

CREATE INDEX IF NOT EXISTS idx_challenge_questions_challenge ON public.challenge_questions(challenge_id);

-- ============================================
-- TABLE: challenge_answers (réponses)
-- ============================================
CREATE TABLE IF NOT EXISTS public.challenge_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.challenge_questions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.challenge_players(id) ON DELETE CASCADE,

  -- Answer
  answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  response_time_ms INTEGER NOT NULL,

  -- Points earned on this question
  points_earned INTEGER DEFAULT 0,
  streak_at_answer INTEGER DEFAULT 0,

  answered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_answers_challenge ON public.challenge_answers(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_answers_player ON public.challenge_answers(player_id);

-- ============================================
-- FUNCTIONS: Utilities
-- ============================================

-- Generate a unique challenge code
CREATE OR REPLACE FUNCTION generate_challenge_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Get the start of the week (Monday)
CREATE OR REPLACE FUNCTION get_week_start(d DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
BEGIN
  -- ISODOW: Monday = 1, Sunday = 7
  RETURN d - (EXTRACT(ISODOW FROM d)::INTEGER - 1);
END;
$$ LANGUAGE plpgsql;

-- Update weekly points after challenge ends
CREATE OR REPLACE FUNCTION update_weekly_points_after_challenge()
RETURNS TRIGGER AS $$
DECLARE
  week_monday DATE;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  week_monday := get_week_start(CURRENT_DATE);

  INSERT INTO public.weekly_points (user_id, week_start, points, challenges_played, challenges_won, best_streak)
  VALUES (
    NEW.user_id,
    week_monday,
    NEW.points_earned,
    1,
    CASE WHEN NEW.final_rank = 1 THEN 1 ELSE 0 END,
    NEW.best_streak
  )
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    points = weekly_points.points + EXCLUDED.points,
    challenges_played = weekly_points.challenges_played + 1,
    challenges_won = weekly_points.challenges_won + CASE WHEN NEW.final_rank = 1 THEN 1 ELSE 0 END,
    best_streak = GREATEST(weekly_points.best_streak, EXCLUDED.best_streak),
    updated_at = NOW();

  -- Also update user profile totals
  UPDATE public.user_profiles
  SET
    total_points = total_points + NEW.points_earned,
    total_challenges_played = total_challenges_played + 1,
    total_challenges_won = total_challenges_won + CASE WHEN NEW.final_rank = 1 THEN 1 ELSE 0 END,
    last_active_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_weekly_points ON public.challenge_players;
CREATE TRIGGER trigger_update_weekly_points
AFTER UPDATE OF finished_at ON public.challenge_players
FOR EACH ROW
WHEN (NEW.finished_at IS NOT NULL AND OLD.finished_at IS NULL)
EXECUTE FUNCTION update_weekly_points_after_challenge();

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_answers ENABLE ROW LEVEL SECURITY;

-- Profiles: visible by everyone, modifiable by self
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.user_profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.user_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Friendships: see own relationships
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
CREATE POLICY "Users can view own friendships" ON public.friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can create friendships" ON public.friendships;
CREATE POLICY "Users can create friendships" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own friendships" ON public.friendships;
CREATE POLICY "Users can update own friendships" ON public.friendships
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
CREATE POLICY "Users can delete own friendships" ON public.friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Weekly points: users can see their own and friends
DROP POLICY IF EXISTS "Users can view weekly points" ON public.weekly_points;
CREATE POLICY "Users can view weekly points" ON public.weekly_points
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND ((user_id = auth.uid() AND friend_id = weekly_points.user_id)
        OR (friend_id = auth.uid() AND user_id = weekly_points.user_id))
    )
  );

-- Challenges: public read, host can modify
DROP POLICY IF EXISTS "Challenges are viewable by everyone" ON public.challenges;
CREATE POLICY "Challenges are viewable by everyone" ON public.challenges
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create challenges" ON public.challenges;
CREATE POLICY "Users can create challenges" ON public.challenges
  FOR INSERT WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can update own challenges" ON public.challenges;
CREATE POLICY "Hosts can update own challenges" ON public.challenges
  FOR UPDATE USING (auth.uid() = host_id);

-- Challenge players: participants can see
DROP POLICY IF EXISTS "Challenge players viewable by everyone" ON public.challenge_players;
CREATE POLICY "Challenge players viewable by everyone" ON public.challenge_players
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can join challenge" ON public.challenge_players;
CREATE POLICY "Anyone can join challenge" ON public.challenge_players
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Players can update own status" ON public.challenge_players;
CREATE POLICY "Players can update own status" ON public.challenge_players
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Challenge questions: viewable by participants
DROP POLICY IF EXISTS "Challenge questions viewable by everyone" ON public.challenge_questions;
CREATE POLICY "Challenge questions viewable by everyone" ON public.challenge_questions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Hosts can insert challenge questions" ON public.challenge_questions;
CREATE POLICY "Hosts can insert challenge questions" ON public.challenge_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.challenges
      WHERE id = challenge_id AND host_id = auth.uid()
    )
  );

-- Challenge answers: viewable by everyone for leaderboard
DROP POLICY IF EXISTS "Challenge answers viewable by everyone" ON public.challenge_answers;
CREATE POLICY "Challenge answers viewable by everyone" ON public.challenge_answers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Players can insert answers" ON public.challenge_answers;
CREATE POLICY "Players can insert answers" ON public.challenge_answers
  FOR INSERT WITH CHECK (true);

-- ============================================
-- REALTIME: Enable for necessary tables
-- Run in Supabase Dashboard > Database > Replication
-- Enable realtime for: challenges, challenge_players
-- ============================================

-- Comments
COMMENT ON TABLE public.user_profiles IS 'Public user profiles for multiplayer features';
COMMENT ON TABLE public.friendships IS 'Friend relationships between users';
COMMENT ON TABLE public.weekly_points IS 'Weekly leaderboard points tracking';
COMMENT ON TABLE public.challenges IS 'Multiplayer challenge sessions';
COMMENT ON TABLE public.challenge_players IS 'Players participating in a challenge';
COMMENT ON TABLE public.challenge_questions IS 'Questions used in a specific challenge';
COMMENT ON TABLE public.challenge_answers IS 'Player answers during a challenge';
