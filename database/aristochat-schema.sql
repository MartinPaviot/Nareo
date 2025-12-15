-- Aristo'Chat core schema (Supabase / Postgres)
-- Run in the new Supabase project before deploying the Next.js backend.

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id),
  email text,
  full_name text,
  locale text default 'fr',
  created_at timestamptz default now()
);

create table if not exists public.courses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users (id),
  title text,
  original_filename text,
  storage_bucket text,
  storage_path text,
  source_file_path text,
  status text check (status in ('pending','processing','ready','failed')) default 'pending',
  language text default 'fr',
  content_language text,
  pages_count int,
  chapter_count int default 0,
  coverage_ratio numeric,
  important_coverage_ratio numeric,
  is_public boolean default false,
  error_message text,
  created_at timestamptz default now()
);
create index if not exists idx_courses_user on public.courses (user_id);
create index if not exists idx_courses_status on public.courses (status);

create table if not exists public.chapters (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid references auth.users (id),
  order_index int,
  difficulty text,
  title text,
  summary text,
  importance int check (importance between 1 and 3),
  source_text text,
  extracted_text text,
  concept_count int,
  covered_concepts int,
  coverage_ratio numeric,
  created_at timestamptz default now()
);
create index if not exists idx_chapters_course on public.chapters (course_id);
create index if not exists idx_chapters_user on public.chapters (user_id);

create table if not exists public.concepts (
  id uuid primary key default uuid_generate_v4(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid references auth.users (id),
  title text,
  description text,
  importance int check (importance between 1 and 3),
  source_text text,
  created_at timestamptz default now()
);
create index if not exists idx_concepts_chapter on public.concepts (chapter_id);
create index if not exists idx_concepts_course on public.concepts (course_id);
create index if not exists idx_concepts_user on public.concepts (user_id);

create table if not exists public.questions (
  id uuid primary key default uuid_generate_v4(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  concept_id uuid references public.concepts (id),
  question_number int,
  question_text text,
  answer_text text,
  options jsonb,
  type text check (type in ('mcq','open')) default 'mcq',
  difficulty int check (difficulty between 1 and 5),
  phase text,
  points int,
  explanation text,
  created_at timestamptz default now()
);
create index if not exists idx_questions_chapter on public.questions (chapter_id);
create index if not exists idx_questions_concept on public.questions (concept_id);

create table if not exists public.question_concepts (
  question_id uuid references public.questions (id) on delete cascade,
  concept_id uuid references public.concepts (id) on delete cascade,
  primary key (question_id, concept_id)
);
create index if not exists idx_question_concepts_concept on public.question_concepts (concept_id);

create table if not exists public.quiz_attempts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id),
  course_id uuid not null references public.courses (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  started_at timestamptz default now(),
  completed_at timestamptz,
  score numeric,
  answers jsonb
);
create index if not exists idx_attempts_user on public.quiz_attempts (user_id);
create index if not exists idx_attempts_course on public.quiz_attempts (course_id);
create index if not exists idx_attempts_chapter on public.quiz_attempts (chapter_id);

-- Legacy sessions placeholder to avoid missing table errors
create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users (id),
  chapter_id uuid references public.chapters (id),
  started_at timestamptz default now(),
  ended_at timestamptz,
  total_time_minutes int default 0,
  duration_seconds int,
  voice_used boolean default false
);
create index if not exists idx_sessions_user on public.sessions (user_id);
create index if not exists idx_sessions_chapter on public.sessions (chapter_id);

-- User stats for session tracking
create table if not exists public.user_stats (
  user_id uuid primary key references auth.users (id),
  total_duration_seconds int default 0,
  last_seen_at timestamptz
);

create table if not exists public.user_course_access (
  user_id uuid not null references auth.users (id),
  course_id uuid not null references public.courses (id) on delete cascade,
  access_tier text check (access_tier in ('free','paid')) default 'free',
  granted_at timestamptz default now(),
  expires_at timestamptz,
  primary key (user_id, course_id)
);
create index if not exists idx_access_course on public.user_course_access (course_id);

create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id),
  course_id uuid not null references public.courses (id) on delete cascade,
  stripe_session_id text,
  amount_cents int,
  currency text default 'eur',
  status text check (status in ('pending','succeeded','failed')) default 'pending',
  created_at timestamptz default now()
);
create index if not exists idx_payments_user on public.payments (user_id);
create index if not exists idx_payments_course on public.payments (course_id);

create table if not exists public.log_events (
  id bigserial primary key,
  user_id uuid references auth.users (id),
  session_id text,
  event_name text,
  course_id uuid references public.courses (id),
  chapter_id uuid references public.chapters (id),
  payload jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_logs_event on public.log_events (event_name);
create index if not exists idx_logs_user on public.log_events (user_id);
create index if not exists idx_logs_course on public.log_events (course_id);
create index if not exists idx_logs_chapter on public.log_events (chapter_id);

-- Optional lightweight job queue for async pipeline
create table if not exists public.pipeline_jobs (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid references auth.users (id),
  status text check (status in ('queued','processing','succeeded','failed')) default 'queued',
  stage text,
  attempts int default 0,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_pipeline_jobs_status on public.pipeline_jobs (status);
create index if not exists idx_pipeline_jobs_course on public.pipeline_jobs (course_id);
create index if not exists idx_pipeline_jobs_user on public.pipeline_jobs (user_id);

-- ============================================================================
-- Backfill/ensure required columns exist if tables were created previously
-- ============================================================================

alter table public.concepts add column if not exists user_id uuid references auth.users (id);
alter table public.chapters add column if not exists user_id uuid references auth.users (id);
alter table public.chapters add column if not exists difficulty text;
alter table public.chapters add column if not exists source_text text;
alter table public.chapters add column if not exists extracted_text text;
alter table public.chapters add column if not exists concept_count int;
alter table public.chapters add column if not exists covered_concepts int;
alter table public.chapters add column if not exists coverage_ratio numeric;
alter table public.chapters alter column user_id drop not null;
alter table public.questions add column if not exists question_number int;
alter table public.questions add column if not exists phase text;
alter table public.questions add column if not exists points int;
alter table public.questions add column if not exists explanation text;
alter table public.questions add column if not exists correct_option_index int;
alter table public.questions add column if not exists source_excerpt text;
alter table public.log_events add column if not exists user_id uuid references auth.users (id);
alter table public.pipeline_jobs add column if not exists user_id uuid references auth.users (id);
alter table public.pipeline_jobs add column if not exists course_id uuid references public.courses (id) on delete cascade;
alter table public.pipeline_jobs add column if not exists stage text;
alter table public.sessions add column if not exists user_id uuid references auth.users (id);
alter table public.sessions add column if not exists chapter_id uuid references public.chapters (id);
alter table public.sessions add column if not exists duration_seconds int;
alter table public.user_stats add column if not exists total_duration_seconds int;
alter table public.user_stats add column if not exists last_seen_at timestamptz;
alter table public.sessions add column if not exists ended_at timestamptz;
alter table public.sessions add column if not exists total_time_minutes int;
alter table public.courses add column if not exists chapter_count int default 0;
alter table public.courses add column if not exists coverage_ratio numeric;
alter table public.courses add column if not exists important_coverage_ratio numeric;
alter table public.courses add column if not exists is_public boolean default false;
alter table public.courses add column if not exists content_language text;
update public.courses set content_language = coalesce(content_language, language, 'en');
alter table public.courses alter column user_id drop not null;
alter table public.pipeline_jobs alter column user_id drop not null;
alter table public.concepts alter column user_id drop not null;

-- Backfill pipeline_jobs.user_id from related course
update public.pipeline_jobs pj
set user_id = co.user_id
from public.courses co
where pj.course_id = co.id
  and pj.user_id is null;

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.chapters enable row level security;
alter table public.concepts enable row level security;
alter table public.questions enable row level security;
alter table public.question_concepts enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.user_course_access enable row level security;
alter table public.payments enable row level security;
alter table public.log_events enable row level security;
alter table public.pipeline_jobs enable row level security;
alter table public.sessions enable row level security;
alter table public.user_stats enable row level security;

-- Profiles
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (user_id = auth.uid());
drop policy if exists profiles_upsert_self on public.profiles;
create policy profiles_upsert_self on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Courses
drop policy if exists courses_select_self on public.courses;
create policy courses_select_self on public.courses
  for select using (user_id = auth.uid());
drop policy if exists courses_select_public on public.courses;
create policy courses_select_public on public.courses
  for select using (is_public = true and status = 'ready');
-- Allow guest-owned courses (user_id null) to be read while processing/ready
drop policy if exists courses_select_guest on public.courses;
create policy courses_select_guest on public.courses
  for select using (user_id is null);
drop policy if exists courses_insert_self on public.courses;
create policy courses_insert_self on public.courses
  for insert with check (user_id = auth.uid());
drop policy if exists courses_update_self on public.courses;
create policy courses_update_self on public.courses
  for update using (user_id = auth.uid());

-- Chapters (derived from course ownership)
drop policy if exists chapters_select_self on public.chapters;
create policy chapters_select_self on public.chapters
  for select using (user_id = auth.uid());
drop policy if exists chapters_select_public on public.chapters;
create policy chapters_select_public on public.chapters
  for select using (
    exists (
      select 1 from public.courses co
      where co.id = course_id and co.is_public = true and co.status = 'ready'
    )
  );
-- Allow guest-owned courses to expose chapters
drop policy if exists chapters_select_guest on public.chapters;
create policy chapters_select_guest on public.chapters
  for select using (
    exists (
      select 1 from public.courses co
      where co.id = course_id and co.user_id is null
    )
  );
drop policy if exists chapters_insert_self on public.chapters;
create policy chapters_insert_self on public.chapters
  for insert with check (user_id = auth.uid());
drop policy if exists chapters_update_self on public.chapters;
create policy chapters_update_self on public.chapters
  for update using (user_id = auth.uid());

-- Concepts
drop policy if exists concepts_select_self on public.concepts;
create policy concepts_select_self on public.concepts
  for select using (user_id = auth.uid());
drop policy if exists concepts_insert_self on public.concepts;
create policy concepts_insert_self on public.concepts
  for insert with check (user_id = auth.uid());
drop policy if exists concepts_update_self on public.concepts;
create policy concepts_update_self on public.concepts
  for update using (user_id = auth.uid());

-- Questions
drop policy if exists questions_select_self on public.questions;
create policy questions_select_self on public.questions
  for select using (
    exists (
      select 1 from public.chapters c
      where c.id = questions.chapter_id and c.user_id = auth.uid()
    )
  );
drop policy if exists questions_select_public on public.questions;
create policy questions_select_public on public.questions
  for select using (
    exists (
      select 1
      from public.chapters c
      join public.courses co on co.id = c.course_id
      where c.id = questions.chapter_id
        and co.is_public = true
        and co.status = 'ready'
    )
  );
-- Allow reading questions for guest-owned courses
drop policy if exists questions_select_guest on public.questions;
create policy questions_select_guest on public.questions
  for select using (
    exists (
      select 1
      from public.chapters c
      join public.courses co on co.id = c.course_id
      where c.id = questions.chapter_id
        and co.user_id is null
    )
  );
drop policy if exists questions_insert_self on public.questions;
create policy questions_insert_self on public.questions
  for insert with check (
    exists (
      select 1 from public.chapters c
      where c.id = chapter_id and c.user_id = auth.uid()
    )
  );
drop policy if exists questions_update_self on public.questions;
create policy questions_update_self on public.questions
  for update using (
    exists (
      select 1 from public.chapters c
      where c.id = questions.chapter_id and c.user_id = auth.uid()
    )
  );

-- Question concepts
drop policy if exists question_concepts_select_self on public.question_concepts;
create policy question_concepts_select_self on public.question_concepts
  for select using (
    exists (
      select 1 from public.questions q
      join public.chapters c on c.id = q.chapter_id
      where q.id = question_concepts.question_id and c.user_id = auth.uid()
    )
  );
drop policy if exists question_concepts_insert_self on public.question_concepts;
create policy question_concepts_insert_self on public.question_concepts
  for insert with check (
    exists (
      select 1 from public.questions q
      join public.chapters c on c.id = q.chapter_id
      where q.id = question_id and c.user_id = auth.uid()
    )
  );

-- Quiz attempts
drop policy if exists quiz_attempts_select_self on public.quiz_attempts;
create policy quiz_attempts_select_self on public.quiz_attempts
  for select using (user_id = auth.uid());
drop policy if exists quiz_attempts_insert_self on public.quiz_attempts;
create policy quiz_attempts_insert_self on public.quiz_attempts
  for insert with check (user_id = auth.uid());
drop policy if exists quiz_attempts_update_self on public.quiz_attempts;
create policy quiz_attempts_update_self on public.quiz_attempts
  for update using (user_id = auth.uid());

-- User course access
drop policy if exists access_select_self on public.user_course_access;
create policy access_select_self on public.user_course_access
  for select using (user_id = auth.uid());
drop policy if exists access_upsert_self on public.user_course_access;
create policy access_upsert_self on public.user_course_access
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Payments
drop policy if exists payments_select_self on public.payments;
create policy payments_select_self on public.payments
  for select using (user_id = auth.uid());
drop policy if exists payments_insert_self on public.payments;
create policy payments_insert_self on public.payments
  for insert with check (user_id = auth.uid());
drop policy if exists payments_update_self on public.payments;
create policy payments_update_self on public.payments
  for update using (user_id = auth.uid());

-- Log events: users can insert their own, service role can read all
drop policy if exists log_events_insert_any on public.log_events;
create policy log_events_insert_any on public.log_events
  for insert with check (true);
drop policy if exists log_events_select_self on public.log_events;
create policy log_events_select_self on public.log_events
  for select using (user_id = auth.uid());

-- Pipeline jobs: service role processes, users read their own
drop policy if exists pipeline_jobs_select_self on public.pipeline_jobs;
create policy pipeline_jobs_select_self on public.pipeline_jobs
  for select using (user_id = auth.uid());
drop policy if exists pipeline_jobs_insert_self on public.pipeline_jobs;
create policy pipeline_jobs_insert_self on public.pipeline_jobs
  for insert with check (user_id = auth.uid());
drop policy if exists pipeline_jobs_update_service on public.pipeline_jobs;
create policy pipeline_jobs_update_service on public.pipeline_jobs
  for update using (auth.role() = 'service_role');

-- Sessions (legacy placeholder)
drop policy if exists sessions_select_self on public.sessions;
create policy sessions_select_self on public.sessions
  for select using (user_id = auth.uid());
drop policy if exists sessions_insert_self on public.sessions;
create policy sessions_insert_self on public.sessions
  for insert with check (user_id = auth.uid());
drop policy if exists sessions_update_self on public.sessions;
create policy sessions_update_self on public.sessions
  for update using (user_id = auth.uid());
drop policy if exists sessions_delete_self on public.sessions;
create policy sessions_delete_self on public.sessions
  for delete using (user_id = auth.uid());

-- User stats
drop policy if exists user_stats_select_self on public.user_stats;
create policy user_stats_select_self on public.user_stats
  for select using (user_id = auth.uid());
drop policy if exists user_stats_upsert_self on public.user_stats;
create policy user_stats_upsert_self on public.user_stats
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grants for service role
grant all privileges on all tables in schema public to service_role;
grant usage on schema public to service_role;

-- Grants for authenticated role (RLS will enforce ownership)
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.courses to authenticated;
grant select, insert, update, delete on public.chapters to authenticated;
grant select, insert, update, delete on public.concepts to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.question_concepts to authenticated;
grant select, insert, update, delete on public.quiz_attempts to authenticated;
grant select, insert, update, delete on public.user_course_access to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.log_events to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.user_stats to authenticated;
-- Grants for anon (guest) to read public/guest-owned entities (RLS still applies)
grant select on public.courses to anon;
grant select on public.chapters to anon;
grant select on public.questions to anon;
grant select on public.question_concepts to anon;
