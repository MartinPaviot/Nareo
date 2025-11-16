export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  user_id: string;
  title: string;
  pdf_url: string;
  summary: string;
  total_concepts: number;
  extracted_text?: string; // Raw text extracted from images/PDFs
  created_at: string;
  updated_at: string;
}

export interface Concept {
  id: string;
  chapter_id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  order_index: number;
  content: string;
  definitions: string[];
  key_ideas: string[];
  source_text?: string; // Original text from image/PDF related to this concept
  created_at: string;
  updated_at: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  concept_id: string;
  phase_1_score: number;
  phase_2_score: number;
  phase_3_score: number;
  total_score: number;
  badge: 'bronze' | 'silver' | 'gold' | null;
  completed: boolean;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  concept_id: string;
  role: 'user' | 'assistant';
  content: string;
  phase: 1 | 2 | 3;
  timestamp: string;
}

export interface Session {
  id: string;
  user_id: string;
  chapter_id: string;
  started_at: string;
  ended_at: string | null;
  total_time_minutes: number;
  concepts_mastered: number;
  voice_used: boolean;
}

export interface LearningSession {
  id: string;
  user_id: string;
  chapter_id: string;
  current_question: number;
  chat_messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    aristoState?: string;
  }>;
  session_state: 'active' | 'paused' | 'completed';
  last_activity: string;
  created_at: string;
  updated_at: string;
}
