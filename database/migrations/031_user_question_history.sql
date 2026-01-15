-- Migration 031: User Question History
-- Track which questions each user has seen to improve quiz diversity

-- Table pour tracker les questions vues par chaque utilisateur
create table if not exists public.user_question_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_session_id text,
  question_id uuid not null references public.questions(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete cascade,
  seen_at timestamptz default now(),
  answered_correctly boolean,
  attempt_count int default 1,
  last_answered_at timestamptz,

  -- Ensure one entry per user/question pair
  constraint uqh_user_question_unique unique (user_id, question_id),
  constraint uqh_guest_question_unique unique (guest_session_id, question_id),

  -- At least one identifier required
  constraint uqh_user_or_guest check (user_id is not null or guest_session_id is not null)
);

-- Indexes for fast lookups
create index if not exists idx_uqh_user on public.user_question_history(user_id);
create index if not exists idx_uqh_guest on public.user_question_history(guest_session_id);
create index if not exists idx_uqh_course on public.user_question_history(course_id);
create index if not exists idx_uqh_chapter on public.user_question_history(chapter_id);
create index if not exists idx_uqh_question on public.user_question_history(question_id);
create index if not exists idx_uqh_user_course on public.user_question_history(user_id, course_id);

-- Enable RLS
alter table public.user_question_history enable row level security;

-- Policies
create policy uqh_select_own on public.user_question_history
  for select using (
    user_id = auth.uid() or
    (guest_session_id is not null and user_id is null)
  );

create policy uqh_insert_own on public.user_question_history
  for insert with check (
    user_id = auth.uid() or
    (guest_session_id is not null and user_id is null)
  );

create policy uqh_update_own on public.user_question_history
  for update using (user_id = auth.uid());

create policy uqh_delete_own on public.user_question_history
  for delete using (user_id = auth.uid());

-- Add quiz_mode to quiz_attempts for global quiz support
alter table public.quiz_attempts
  add column if not exists quiz_mode text
  check (quiz_mode in ('chapter', 'global', 'review'))
  default 'chapter';

-- Make chapter_id optional for global quizzes
alter table public.quiz_attempts
  alter column chapter_id drop not null;

-- Add constraint: chapter_id required for chapter mode, optional for global/review
-- Note: Using a function because CHECK constraints can't reference other columns in ALTER
do $$
begin
  -- Drop the constraint if it exists (idempotent)
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'quiz_attempts_mode_chapter_check'
    and table_name = 'quiz_attempts'
  ) then
    alter table public.quiz_attempts drop constraint quiz_attempts_mode_chapter_check;
  end if;
end $$;

-- Helper function to get unseen questions for a user
create or replace function get_unseen_questions(
  p_user_id uuid,
  p_guest_session_id text,
  p_course_id uuid,
  p_chapter_id uuid default null,
  p_limit int default 20
)
returns table (
  question_id uuid,
  chapter_id uuid,
  chapter_title text,
  question_text text,
  answer_text text,
  options jsonb,
  type text,
  difficulty int,
  explanation text
)
language plpgsql
security definer
as $$
begin
  return query
  select
    q.id as question_id,
    q.chapter_id,
    ch.title as chapter_title,
    q.question_text,
    q.answer_text,
    q.options,
    q.type,
    q.difficulty,
    q.explanation
  from public.questions q
  inner join public.chapters ch on ch.id = q.chapter_id
  where ch.course_id = p_course_id
    and (p_chapter_id is null or q.chapter_id = p_chapter_id)
    and q.id not in (
      select uqh.question_id
      from public.user_question_history uqh
      where (
        (p_user_id is not null and uqh.user_id = p_user_id) or
        (p_guest_session_id is not null and uqh.guest_session_id = p_guest_session_id)
      )
      and uqh.course_id = p_course_id
      and uqh.answered_correctly = true
    )
  order by random()
  limit p_limit;
end;
$$;

-- Function to record question history (upsert)
create or replace function record_question_history(
  p_user_id uuid,
  p_guest_session_id text,
  p_question_id uuid,
  p_course_id uuid,
  p_chapter_id uuid,
  p_answered_correctly boolean
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.user_question_history (
    user_id,
    guest_session_id,
    question_id,
    course_id,
    chapter_id,
    answered_correctly,
    attempt_count,
    last_answered_at
  ) values (
    p_user_id,
    p_guest_session_id,
    p_question_id,
    p_course_id,
    p_chapter_id,
    p_answered_correctly,
    1,
    now()
  )
  on conflict (user_id, question_id)
  do update set
    answered_correctly = case
      when excluded.answered_correctly then true
      else user_question_history.answered_correctly
    end,
    attempt_count = user_question_history.attempt_count + 1,
    last_answered_at = now();
exception
  when unique_violation then
    -- Handle guest session conflict
    update public.user_question_history
    set
      answered_correctly = case
        when p_answered_correctly then true
        else answered_correctly
      end,
      attempt_count = attempt_count + 1,
      last_answered_at = now()
    where guest_session_id = p_guest_session_id
      and question_id = p_question_id;
end;
$$;

-- Function to reset question history for a course
create or replace function reset_question_history(
  p_user_id uuid,
  p_course_id uuid
)
returns int
language plpgsql
security definer
as $$
declare
  deleted_count int;
begin
  delete from public.user_question_history
  where user_id = p_user_id
    and course_id = p_course_id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
