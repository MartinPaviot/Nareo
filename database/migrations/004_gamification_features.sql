-- ============================================================================
-- Gamification Features Migration
-- Adds daily streaks, badges, and activity tracking
-- ============================================================================

-- User daily activity tracking
create table if not exists public.daily_activity (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  quizzes_completed int default 0,
  questions_answered int default 0,
  questions_correct int default 0,
  points_earned int default 0,
  time_spent_minutes int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, activity_date)
);
create index if not exists idx_daily_activity_user on public.daily_activity (user_id);
create index if not exists idx_daily_activity_date on public.daily_activity (activity_date desc);

-- User streaks and gamification stats
create table if not exists public.user_gamification (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak int default 0,
  longest_streak int default 0,
  last_activity_date date,
  total_points int default 0,
  total_quizzes_completed int default 0,
  total_chapters_completed int default 0,
  total_questions_answered int default 0,
  total_questions_correct int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Badges
create table if not exists public.badges (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null, -- e.g., 'first_quiz', 'streak_7', 'perfect_score'
  name_fr text not null,
  name_en text not null,
  name_de text not null,
  description_fr text,
  description_en text,
  description_de text,
  icon text, -- emoji or icon name
  rarity text check (rarity in ('common','rare','epic','legendary')) default 'common',
  created_at timestamptz default now()
);

-- User badges
create table if not exists public.user_badges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz default now(),
  unique(user_id, badge_id)
);
create index if not exists idx_user_badges_user on public.user_badges (user_id);

-- Insert default badges
insert into public.badges (code, name_fr, name_en, name_de, description_fr, description_en, description_de, icon, rarity)
values
  ('first_quiz', 'Premier Pas', 'First Steps', 'Erste Schritte', 'Complète ton premier quiz', 'Complete your first quiz', 'Absolviere dein erstes Quiz', '🎯', 'common'),
  ('streak_3', 'En Rythme', 'Getting Into Rhythm', 'Im Rhythmus', '3 jours d''affilée', '3 days in a row', '3 Tage hintereinander', '🔥', 'common'),
  ('streak_7', 'Semaine Parfaite', 'Perfect Week', 'Perfekte Woche', '7 jours d''affilée', '7 days in a row', '7 Tage hintereinander', '⭐', 'rare'),
  ('streak_30', 'Mois Légendaire', 'Legendary Month', 'Legendärer Monat', '30 jours d''affilée', '30 days in a row', '30 Tage hintereinander', '👑', 'legendary'),
  ('perfect_score', 'Sans Faute', 'Perfect Score', 'Perfekte Punktzahl', 'Obtiens 100% à un quiz', 'Get 100% on a quiz', 'Erreiche 100% in einem Quiz', '💯', 'rare'),
  ('speed_demon', 'Éclair', 'Lightning Fast', 'Blitzschnell', 'Termine 10 quiz en un jour', 'Complete 10 quizzes in one day', 'Absolviere 10 Quiz an einem Tag', '⚡', 'epic'),
  ('night_owl', 'Chouette de Nuit', 'Night Owl', 'Nachteule', 'Complète un quiz après 23h', 'Complete a quiz after 11 PM', 'Absolviere ein Quiz nach 23 Uhr', '🦉', 'common'),
  ('early_bird', 'Lève-tôt', 'Early Bird', 'Frühaufsteher', 'Complète un quiz avant 7h', 'Complete a quiz before 7 AM', 'Absolviere ein Quiz vor 7 Uhr', '🐦', 'common'),
  ('chapter_master', 'Maître du Chapitre', 'Chapter Master', 'Kapitelmeister', 'Termine tous les chapitres d''un cours', 'Complete all chapters of a course', 'Absolviere alle Kapitel eines Kurses', '📚', 'rare'),
  ('knowledge_hunter', 'Chasseur de Savoir', 'Knowledge Hunter', 'Wissensjäger', 'Réponds correctement à 100 questions', 'Answer 100 questions correctly', 'Beantworte 100 Fragen richtig', '🎓', 'epic')
on conflict (code) do nothing;

-- Function to update streak
create or replace function update_user_streak()
returns trigger as $$
declare
  last_date date;
  activity_date_var date;
  new_streak int;
begin
  -- Get current date from activity
  activity_date_var := NEW.activity_date;

  -- Get last activity date
  select last_activity_date into last_date
  from public.user_gamification
  where user_id = NEW.user_id;

  -- Initialize gamification record if not exists
  insert into public.user_gamification (user_id, last_activity_date)
  values (NEW.user_id, activity_date_var)
  on conflict (user_id) do nothing;

  -- Calculate streak
  if last_date is null then
    new_streak := 1;
  elsif activity_date_var = last_date then
    -- Same day, don't update streak
    return NEW;
  elsif activity_date_var = last_date + interval '1 day' then
    -- Consecutive day
    select current_streak + 1 into new_streak
    from public.user_gamification
    where user_id = NEW.user_id;
  else
    -- Streak broken
    new_streak := 1;
  end if;

  -- Update user gamification stats
  update public.user_gamification
  set
    current_streak = new_streak,
    longest_streak = greatest(longest_streak, new_streak),
    last_activity_date = activity_date_var,
    updated_at = now()
  where user_id = NEW.user_id;

  return NEW;
end;
$$ language plpgsql;

-- Trigger to update streak on daily activity
drop trigger if exists trigger_update_streak on public.daily_activity;
create trigger trigger_update_streak
  after insert or update on public.daily_activity
  for each row
  execute function update_user_streak();

-- Function to award badges based on achievements
create or replace function check_and_award_badges()
returns trigger as $$
declare
  badge_rec record;
  user_streak int;
  total_correct int;
  total_quizzes int;
begin
  -- Get user stats
  select current_streak, total_questions_correct, total_quizzes_completed
  into user_streak, total_correct, total_quizzes
  from public.user_gamification
  where user_id = NEW.user_id;

  -- Award first quiz badge
  if total_quizzes >= 1 then
    insert into public.user_badges (user_id, badge_id)
    select NEW.user_id, id from public.badges where code = 'first_quiz'
    on conflict do nothing;
  end if;

  -- Award streak badges
  if user_streak >= 3 then
    insert into public.user_badges (user_id, badge_id)
    select NEW.user_id, id from public.badges where code = 'streak_3'
    on conflict do nothing;
  end if;

  if user_streak >= 7 then
    insert into public.user_badges (user_id, badge_id)
    select NEW.user_id, id from public.badges where code = 'streak_7'
    on conflict do nothing;
  end if;

  if user_streak >= 30 then
    insert into public.user_badges (user_id, badge_id)
    select NEW.user_id, id from public.badges where code = 'streak_30'
    on conflict do nothing;
  end if;

  -- Award knowledge hunter badge
  if total_correct >= 100 then
    insert into public.user_badges (user_id, badge_id)
    select NEW.user_id, id from public.badges where code = 'knowledge_hunter'
    on conflict do nothing;
  end if;

  return NEW;
end;
$$ language plpgsql;

-- Trigger to check badges on gamification update
drop trigger if exists trigger_check_badges on public.user_gamification;
create trigger trigger_check_badges
  after update on public.user_gamification
  for each row
  execute function check_and_award_badges();

-- Row Level Security
alter table public.daily_activity enable row level security;
alter table public.user_gamification enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

-- Policies for daily_activity
drop policy if exists "Users can view own daily activity" on public.daily_activity;
create policy "Users can view own daily activity"
  on public.daily_activity for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily activity" on public.daily_activity;
create policy "Users can insert own daily activity"
  on public.daily_activity for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily activity" on public.daily_activity;
create policy "Users can update own daily activity"
  on public.daily_activity for update
  using (auth.uid() = user_id);

-- Policies for user_gamification
drop policy if exists "Users can view own gamification" on public.user_gamification;
create policy "Users can view own gamification"
  on public.user_gamification for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own gamification" on public.user_gamification;
create policy "Users can insert own gamification"
  on public.user_gamification for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own gamification" on public.user_gamification;
create policy "Users can update own gamification"
  on public.user_gamification for update
  using (auth.uid() = user_id);

-- Policies for badges (read-only for all authenticated users)
drop policy if exists "Authenticated users can view badges" on public.badges;
create policy "Authenticated users can view badges"
  on public.badges for select
  using (auth.role() = 'authenticated');

-- Policies for user_badges
drop policy if exists "Users can view own badges" on public.user_badges;
create policy "Users can view own badges"
  on public.user_badges for select
  using (auth.uid() = user_id);

drop policy if exists "System can insert badges" on public.user_badges;
create policy "System can insert badges"
  on public.user_badges for insert
  with check (true);

-- Comments
comment on table public.daily_activity is 'Tracks user activity per day for streak calculation';
comment on table public.user_gamification is 'Stores user gamification stats including streaks';
comment on table public.badges is 'Available badges that can be earned';
comment on table public.user_badges is 'Badges earned by users';
