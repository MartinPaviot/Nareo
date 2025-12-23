export type SessionType = 'quiz' | 'flashcards' | 'revision_sheet';

export type FreshnessLevel = 'fresh' | 'moderate' | 'stale' | 'critical';

export type MasteryLevel = 'not_started' | 'discovery' | 'learning' | 'acquired' | 'mastered';

export interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_collapsed: boolean;
  display_order: number;
  courses: Course[];
  course_count: number;
}

export interface Course {
  id: string;
  name: string;
  file_name: string;
  created_at: string;
  last_studied_at: string | null;
  days_since_study: number | null;
  total_chapters: number;
  mastered_chapters: number;
  mastery_percentage: number;
  current_chapter: CurrentChapter | null;
  cards_to_review: number;
  display_order: number;
  status: string;
}

export interface CurrentChapter {
  id: string;
  name: string;
  chapter_number: number;
}

export interface PriorityItem {
  id: string;
  item_type: 'chapter' | 'course' | 'flashcard_deck';
  item_id: string;
  course_id: string;
  priority_score: number;
  reason: string;
  days_since_review: number | null;
  mastery_level: string | null;
  course_name?: string;
  chapter_name?: string;
}

export interface SmartCTA {
  type: 'flashcards' | 'start_chapter' | 'continue_chapter' | 'review';
  label: string;
  target_id: string;
  target_type: 'flashcards' | 'chapter' | 'course';
  cards_to_review: number;
}

export interface StudySession {
  id: string;
  course_id: string;
  chapter_id: string | null;
  session_type: SessionType;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  questions_answered: number;
  correct_answers: number;
  cards_reviewed: number;
}

export interface CoursesData {
  folders: Folder[];
  uncategorized: Course[];
}

export interface FolderIcon {
  id: string;
  icon: string;
  label: string;
}

export interface FolderColor {
  id: string;
  color: string;
  label: string;
}

export interface FreshnessConfig {
  maxDays: number;
  color: string;
  bgColor: string;
  label: string;
  icon: string;
}
