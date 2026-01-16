// Types based on Supabase schema

export type CourseStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type AccessTier = 'free' | 'paid';
export type QuestionType = 'mcq' | 'open';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed';

export interface Profile {
  user_id: string;
  email: string | null;
  full_name: string | null;
  locale: string;
  created_at: string;
}

export interface Course {
  id: string;
  user_id: string;
  title: string | null;
  original_filename: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  source_file_path: string | null;
  status: CourseStatus;
  language: string;
  pages_count: number | null;
  error_message: string | null;
  created_at: string;
}

export interface Chapter {
  id: string;
  course_id: string;
  user_id: string;
  order_index: number | null;
  difficulty: string | null;
  title: string | null;
  summary: string | null;
  importance: number | null;
  source_text: string | null;
  extracted_text: string | null;
  created_at: string;
}

export interface Concept {
  id: string;
  chapter_id: string;
  course_id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  importance: number | null;
  source_text: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  chapter_id: string;
  concept_id: string | null;
  question_number: number | null;
  question_text: string | null;
  answer_text: string | null;
  options: any | null; // JSON field
  type: QuestionType;
  difficulty: number | null;
  phase: string | null;
  points: number | null;
  explanation: string | null;
  source_excerpt: string | null;
  page_number: number | null;
  correct_option_index: number | null;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  course_id: string;
  chapter_id: string;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  answers: any | null; // JSON field
}

export interface UserCourseAccess {
  user_id: string;
  course_id: string;
  access_tier: AccessTier;
  granted_at: string;
  expires_at: string | null;
}

export interface Payment {
  id: string;
  user_id: string;
  course_id: string;
  stripe_session_id: string | null;
  amount_cents: number | null;
  currency: string;
  status: PaymentStatus;
  created_at: string;
}

// Extended types for frontend use

export interface CourseWithProgress extends Course {
  chapter_count: number;
  completed_chapters: number;
  in_progress_chapters: number;
  total_questions: number;
  user_score: number;
  has_access: boolean;
  access_tier?: AccessTier;
}

export interface ChapterWithProgress extends Chapter {
  question_count: number;
  completed: boolean;
  in_progress: boolean;
  score: number | null;
  has_access: boolean;
}

export interface QuestionWithAnswer extends Question {
  user_answer?: string;
  is_correct?: boolean;
  feedback?: string;
}
