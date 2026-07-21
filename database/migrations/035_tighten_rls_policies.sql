-- Migration 035: tighten permissive RLS INSERT policies
--
-- Two legacy policies were created `WITH CHECK (true)`, which let any client
-- holding the anon/authenticated key insert arbitrary rows:
--   * user_badges: a client could award itself (or forge for others) any badge.
--   * log_events:  a client could write log rows with a forged user_id.
--
-- All *legitimate* writes to these tables come from trusted server paths:
--   * badges are awarded only by the check_and_award_badges() trigger;
--   * log_events are written only by lib/backend/analytics.ts via the
--     service-role client (which bypasses RLS entirely).
--
-- So we can close both policies to `WITH CHECK (false)`. For badges we must
-- first make the award trigger SECURITY DEFINER, otherwise its INSERT would run
-- as the calling `authenticated` role and be blocked by the new policy.

-- 1) Award trigger runs with definer privileges so its inserts bypass RLS,
--    regardless of which role updated user_gamification. Body is unchanged from
--    migration 004; only SECURITY DEFINER + a locked search_path are added.
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
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 2) user_badges: clients may no longer insert badges directly. Awards flow
--    exclusively through the SECURITY DEFINER trigger above.
drop policy if exists "System can insert badges" on public.user_badges;
drop policy if exists "No direct badge inserts" on public.user_badges;
create policy "No direct badge inserts"
  on public.user_badges for insert
  with check (false);

-- 3) log_events: writes are server-only (service role), so deny client inserts.
drop policy if exists log_events_insert_any on public.log_events;
drop policy if exists log_events_insert_server_only on public.log_events;
create policy log_events_insert_server_only on public.log_events
  for insert with check (false);
