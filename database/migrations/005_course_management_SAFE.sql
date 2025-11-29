-- Migration 005: Course Management Features (SAFE VERSION)
-- This version checks for existence before creating policies

-- =======================
-- 1. ADD EDITABLE TITLE COLUMN
-- =======================

-- Add editable_title column to courses table (nullable, defaults to original title)
alter table courses
add column if not exists editable_title text;

-- Set existing courses' editable_title to their current title
update courses
set editable_title = title
where editable_title is null;

-- =======================
-- 2. CREATE FOLDERS TABLE
-- =======================

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#6366f1', -- Default indigo color
  icon text default '📁',
  position int default 0, -- For ordering folders
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Ensure unique folder names per user
  unique(user_id, name)
);

-- Index for faster queries
create index if not exists idx_folders_user_id on folders(user_id);
create index if not exists idx_folders_position on folders(user_id, position);

-- =======================
-- 3. CREATE FOLDER_COURSES JUNCTION TABLE
-- =======================

create table if not exists folder_courses (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references folders(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  position int default 0, -- For ordering courses within a folder
  added_at timestamptz default now(),

  -- A course can only be in a folder once
  unique(folder_id, course_id)
);

-- Indexes for faster queries
create index if not exists idx_folder_courses_folder_id on folder_courses(folder_id);
create index if not exists idx_folder_courses_course_id on folder_courses(course_id);
create index if not exists idx_folder_courses_position on folder_courses(folder_id, position);

-- =======================
-- 4. CASCADE DELETE FUNCTION
-- =======================

-- Function to delete a course and all related data
create or replace function delete_course_cascade(course_id_param uuid)
returns void
language plpgsql
security definer
as $$
declare
  chapter_record record;
begin
  -- Delete all questions for each chapter
  for chapter_record in
    select id from chapters where course_id = course_id_param
  loop
    delete from questions where chapter_id = chapter_record.id;
  end loop;

  -- Delete all chapters (this will cascade to user_chapter_progress via FK)
  delete from chapters where course_id = course_id_param;

  -- Delete folder associations
  delete from folder_courses where course_id = course_id_param;

  -- Delete log events associated with this course
  delete from log_events where course_id = course_id_param;

  -- Finally, delete the course itself
  delete from courses where id = course_id_param;
end;
$$;

-- =======================
-- 5. ROW LEVEL SECURITY (RLS)
-- =======================

-- Enable RLS on new tables
alter table folders enable row level security;
alter table folder_courses enable row level security;

-- Drop existing policies if they exist, then recreate them
do $$
begin
  -- Drop and recreate folders policies
  drop policy if exists "Users can view their own folders" on folders;
  create policy "Users can view their own folders"
    on folders for select
    using (auth.uid() = user_id);

  drop policy if exists "Users can create their own folders" on folders;
  create policy "Users can create their own folders"
    on folders for insert
    with check (auth.uid() = user_id);

  drop policy if exists "Users can update their own folders" on folders;
  create policy "Users can update their own folders"
    on folders for update
    using (auth.uid() = user_id);

  drop policy if exists "Users can delete their own folders" on folders;
  create policy "Users can delete their own folders"
    on folders for delete
    using (auth.uid() = user_id);

  -- Drop and recreate folder_courses policies
  drop policy if exists "Users can view courses in their folders" on folder_courses;
  create policy "Users can view courses in their folders"
    on folder_courses for select
    using (
      exists (
        select 1 from folders
        where folders.id = folder_courses.folder_id
        and folders.user_id = auth.uid()
      )
    );

  drop policy if exists "Users can add courses to their folders" on folder_courses;
  create policy "Users can add courses to their folders"
    on folder_courses for insert
    with check (
      exists (
        select 1 from folders
        where folders.id = folder_courses.folder_id
        and folders.user_id = auth.uid()
      )
    );

  drop policy if exists "Users can remove courses from their folders" on folder_courses;
  create policy "Users can remove courses from their folders"
    on folder_courses for delete
    using (
      exists (
        select 1 from folders
        where folders.id = folder_courses.folder_id
        and folders.user_id = auth.uid()
      )
    );
end $$;

-- =======================
-- 6. UPDATED_AT TRIGGER FOR FOLDERS
-- =======================

create or replace function update_folder_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists set_folder_updated_at on folders;
create trigger set_folder_updated_at
  before update on folders
  for each row
  execute function update_folder_updated_at();

-- =======================
-- 7. COMMENTS FOR DOCUMENTATION
-- =======================

comment on table folders is 'User-created folders for organizing courses';
comment on table folder_courses is 'Junction table linking courses to folders';
comment on column courses.editable_title is 'User-customizable course title (overrides default title)';
comment on function delete_course_cascade is 'Safely deletes a course and all related data (chapters, questions, progress, folder associations, log events)';
