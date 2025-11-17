// Supabase-based storage with SSR authentication support
// All methods are async to support database operations

import { supabase } from './supabase';
import { createSupabaseServerClient } from './supabase-server';
import { ChapterQuestion, ChapterProgress, ChapterData } from '@/types/concept.types';

interface Chapter {
  id: string;
  title: string;
  summary: string;
  englishTitle: string;
  englishDescription: string;
  frenchTitle: string;
  frenchDescription: string;
  pdfText: string;
  extractedText?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  orderIndex?: number;
  questions?: ChapterQuestion[];
  sourceText?: string;
  createdAt: Date;
}

interface Concept {
  id: string;
  chapterId: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  orderIndex: number;
  sourceText?: string;
}

interface UserProgress {
  conceptId: string;
  phase1Score: number;
  phase2Score: number;
  phase3Score: number;
  totalScore: number;
  badge: 'bronze' | 'silver' | 'gold' | null;
  completed: boolean;
}

interface ChatMessage {
  conceptId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}

class MemoryStoreSupabase {
  constructor() {
    console.log('✅ MemoryStore initialized with Supabase + SSR Auth');
  }

  // Helper method to get current user ID with SSR support
  // Can optionally accept a user ID directly from authenticated API routes
  private async getUserId(providedUserId?: string): Promise<string | null> {
    // If user ID is provided directly (from API route auth), use it
    if (providedUserId) {
      console.log('✅ Using provided user ID:', providedUserId);
      return providedUserId;
    }

    console.log('🔍 Getting user ID...');
    
    try {
      // Try server-side client first (for API routes)
      try {
        console.log('🔍 Trying SSR client...');
        const serverClient = await createSupabaseServerClient();
        const { data: { user }, error } = await serverClient.auth.getUser();
        
        if (error) {
          console.log('⚠️ SSR auth error:', error.message);
        }
        
        if (user?.id) {
          console.log('✅ User authenticated (SSR):', user.id);
          return user.id;
        }
        
        console.log('⚠️ No user from SSR client');
      } catch (serverError: any) {
        console.log('⚠️ SSR client error:', serverError?.message || 'Unknown error');
      }

      // Fallback to regular client (for client-side)
      console.log('🔍 Trying regular client...');
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.log('⚠️ Regular client auth error:', error.message);
      }
      
      if (user?.id) {
        console.log('✅ User authenticated (client):', user.id);
        return user.id;
      }

      console.warn('❌ No authenticated user found in either client');
      console.warn('💡 Make sure user is logged in via Supabase Auth');
      return null;
    } catch (error: any) {
      console.error('❌ Error getting user ID:', error?.message || error);
      return null;
    }
  }

  // ============================================================================
  // CHAPTERS
  // ============================================================================

  async addChapter(chapter: Chapter, userId?: string): Promise<void> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      if (!resolvedUserId) {
        throw new Error('User not authenticated');
      }

      console.log('📝 Inserting chapter with user_id:', resolvedUserId);
      console.log('📝 Chapter ID:', chapter.id);

      // Use authenticated server client for RLS
      const serverClient = await createSupabaseServerClient();
      
      const { error } = await serverClient
        .from('chapters')
        .upsert({
          id: chapter.id,
          user_id: resolvedUserId,
          title: chapter.title,
          summary: chapter.summary,
          english_title: chapter.englishTitle,
          english_description: chapter.englishDescription,
          french_title: chapter.frenchTitle,
          french_description: chapter.frenchDescription,
          pdf_text: chapter.pdfText,
          extracted_text: chapter.extractedText,
          difficulty: chapter.difficulty,
          order_index: chapter.orderIndex ?? 0,
          questions: chapter.questions ?? [],
          source_text: chapter.sourceText,
          created_at: chapter.createdAt.toISOString(),
        });

      if (error) {
        console.error('❌ RLS Error inserting chapter:', error);
        throw error;
      }
      console.log('✅ Chapter saved to Supabase:', chapter.id);
    } catch (error) {
      console.error('❌ Error saving chapter:', error);
      throw error;
    }
  }

  async getChapter(id: string): Promise<Chapter | undefined> {
    try {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw error;
      }

      if (!data) return undefined;

      return {
        id: data.id,
        title: data.title,
        summary: data.summary,
        englishTitle: data.english_title,
        englishDescription: data.english_description,
        frenchTitle: data.french_title,
        frenchDescription: data.french_description,
        pdfText: data.pdf_text,
        extractedText: data.extracted_text,
        difficulty: data.difficulty,
        orderIndex: data.order_index,
        questions: data.questions,
        sourceText: data.source_text,
        createdAt: new Date(data.created_at),
      };
    } catch (error) {
      console.error('❌ Error fetching chapter:', error);
      return undefined;
    }
  }

  async getAllChapters(userId?: string): Promise<Chapter[]> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      if (!resolvedUserId) {
        console.warn('⚠️ No user ID for getAllChapters, returning empty array');
        return [];
      }

      const serverClient = await createSupabaseServerClient();
      
      const { data, error } = await serverClient
        .from('chapters')
        .select('*')
        .eq('user_id', resolvedUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching chapters:', error);
        throw error;
      }

      return (data || []).map((ch: any) => ({
        id: ch.id,
        title: ch.title,
        summary: ch.summary,
        englishTitle: ch.english_title,
        englishDescription: ch.english_description,
        frenchTitle: ch.french_title,
        frenchDescription: ch.french_description,
        pdfText: ch.pdf_text || '',
        extractedText: ch.extracted_text,
        difficulty: ch.difficulty,
        orderIndex: ch.order_index,
        questions: ch.questions || [],
        sourceText: ch.source_text,
        createdAt: new Date(ch.created_at),
      }));
    } catch (error) {
      console.error('❌ Error in getAllChapters:', error);
      return [];
    }
  }

  async getAllChaptersOld(): Promise<Chapter[]> {
    try {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        englishTitle: row.english_title,
        englishDescription: row.english_description,
        frenchTitle: row.french_title,
        frenchDescription: row.french_description,
        pdfText: row.pdf_text,
        extractedText: row.extracted_text,
        difficulty: row.difficulty,
        orderIndex: row.order_index,
        questions: row.questions,
        sourceText: row.source_text,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      console.error('❌ Error fetching all chapters:', error);
      return [];
    }
  }

  async deleteChapter(id: string): Promise<boolean> {
    try {
      const chapter = await this.getChapter(id);
      if (!chapter) {
        console.warn('⚠️ Chapter not found for deletion:', id);
        return false;
      }

      const { error } = await supabase
        .from('chapters')
        .delete()
        .eq('id', id);

      if (error) throw error;

      console.log('✅ Chapter and all associated data deleted:', id);
      return true;
    } catch (error) {
      console.error('❌ Error deleting chapter:', error);
      return false;
    }
  }

  // ============================================================================
  // CONCEPTS
  // ============================================================================

  async addConcept(concept: Concept, userId?: string): Promise<void> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      if (!resolvedUserId) {
        throw new Error('User not authenticated');
      }

      console.log('📝 Inserting concept with user_id:', resolvedUserId, 'concept_id:', concept.id);

      // Use authenticated server client for RLS
      const serverClient = await createSupabaseServerClient();

      const { error } = await serverClient
        .from('concepts')
        .upsert({
          id: concept.id,
          user_id: resolvedUserId,
          chapter_id: concept.chapterId,
          title: concept.title,
          description: concept.description,
          difficulty: concept.difficulty,
          order_index: concept.orderIndex,
          source_text: concept.sourceText,
        });

      if (error) {
        console.error('❌ RLS Error inserting concept:', error);
        throw error;
      }
      console.log('✅ Concept saved to Supabase:', concept.id);
    } catch (error) {
      console.error('❌ Error saving concept:', error);
      throw error;
    }
  }

  async getConcept(id: string, userId?: string): Promise<Concept | undefined> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      if (!resolvedUserId) {
        console.warn('⚠️ No user ID for getConcept');
        return undefined;
      }

      // Use authenticated server client for RLS
      const serverClient = await createSupabaseServerClient();

      const { data, error } = await serverClient
        .from('concepts')
        .select('*')
        .eq('id', id)
        .eq('user_id', resolvedUserId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching concept:', error);
        throw error;
      }

      if (!data) return undefined;

      return {
        id: data.id,
        chapterId: data.chapter_id,
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        orderIndex: data.order_index,
        sourceText: data.source_text,
      };
    } catch (error) {
      console.error('❌ Error fetching concept:', error);
      return undefined;
    }
  }

  async getConceptsByChapter(chapterId: string, userId?: string): Promise<Concept[]> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      if (!resolvedUserId) {
        console.warn('⚠️ No user ID for getConceptsByChapter');
        return [];
      }

      // Use authenticated server client for RLS
      const serverClient = await createSupabaseServerClient();

      const { data, error } = await serverClient
        .from('concepts')
        .select('*')
        .eq('chapter_id', chapterId)
        .eq('user_id', resolvedUserId)
        .order('order_index', { ascending: true });

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        chapterId: row.chapter_id,
        title: row.title,
        description: row.description,
        difficulty: row.difficulty,
        orderIndex: row.order_index,
        sourceText: row.source_text,
      }));
    } catch (error) {
      console.error('❌ Error fetching concepts by chapter:', error);
      return [];
    }
  }

  // ============================================================================
  // USER PROGRESS
  // ============================================================================

  async updateProgress(conceptId: string, progress: Partial<UserProgress>, userId?: string): Promise<void> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      if (!resolvedUserId) {
        throw new Error('User not authenticated');
      }

      const existing = await this.getProgress(conceptId);
      const merged = {
        concept_id: conceptId,
        user_id: resolvedUserId,
        phase1_score: progress.phase1Score ?? existing?.phase1Score ?? 0,
        phase2_score: progress.phase2Score ?? existing?.phase2Score ?? 0,
        phase3_score: progress.phase3Score ?? existing?.phase3Score ?? 0,
        total_score: progress.totalScore ?? existing?.totalScore ?? 0,
        badge: progress.badge !== undefined ? progress.badge : (existing?.badge ?? null),
        completed: progress.completed ?? existing?.completed ?? false,
      };

      const { error } = await supabase
        .from('user_progress')
        .upsert(merged);

      if (error) throw error;
      console.log('✅ Progress updated for concept:', conceptId);
    } catch (error) {
      console.error('❌ Error updating progress:', error);
      throw error;
    }
  }

  async getProgress(conceptId: string): Promise<UserProgress | undefined> {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('concept_id', conceptId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw error;
      }

      if (!data) return undefined;

      return {
        conceptId: data.concept_id,
        phase1Score: data.phase1_score,
        phase2Score: data.phase2_score,
        phase3Score: data.phase3_score,
        totalScore: data.total_score,
        badge: data.badge,
        completed: data.completed,
      };
    } catch (error) {
      console.error('❌ Error fetching progress:', error);
      return undefined;
    }
  }

  async getAllProgress(): Promise<UserProgress[]> {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*');

      if (error) throw error;

      return (data || []).map(row => ({
        conceptId: row.concept_id,
        phase1Score: row.phase1_score,
        phase2Score: row.phase2_score,
        phase3Score: row.phase3_score,
        totalScore: row.total_score,
        badge: row.badge,
        completed: row.completed,
      }));
    } catch (error) {
      console.error('❌ Error fetching all progress:', error);
      return [];
    }
  }

  // ============================================================================
  // CHAT HISTORY
  // ============================================================================

  async addChatMessage(conceptId: string, role: 'user' | 'assistant', content: string, userId?: string): Promise<void> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      if (!resolvedUserId) {
        throw new Error('User not authenticated');
      }

      const existing = await this.getChatHistory(conceptId);
      const messages = existing?.messages || [];

      messages.push({
        role,
        content,
        timestamp: new Date(),
      });

      const { error } = await supabase
        .from('chat_history')
        .upsert({
          concept_id: conceptId,
          user_id: resolvedUserId,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
          })),
        });

      if (error) throw error;
      console.log('✅ Chat message added for concept:', conceptId);
    } catch (error) {
      console.error('❌ Error adding chat message:', error);
      throw error;
    }
  }

  async getChatHistory(conceptId: string): Promise<ChatMessage | undefined> {
    try {
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('concept_id', conceptId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw error;
      }

      if (!data) return undefined;

      return {
        conceptId: data.concept_id,
        messages: (data.messages || []).map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        })),
      };
    } catch (error) {
      console.error('❌ Error fetching chat history:', error);
      return undefined;
    }
  }

  async clearChatHistory(conceptId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_history')
        .delete()
        .eq('concept_id', conceptId);

      if (error) throw error;
      console.log('✅ Chat history cleared for concept:', conceptId);
    } catch (error) {
      console.error('❌ Error clearing chat history:', error);
      throw error;
    }
  }

  // ============================================================================
  // CHAPTER PROGRESS
  // ============================================================================

  async initializeChapterProgress(chapterId: string, userId?: string): Promise<void> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      if (!resolvedUserId) {
        throw new Error('User not authenticated');
      }

      const existing = await this.getChapterProgress(chapterId, resolvedUserId);
      if (existing) return;

      console.log('📝 Inserting chapter_progress with user_id:', resolvedUserId, 'chapter_id:', chapterId);

      // Use authenticated server client for RLS
      const serverClient = await createSupabaseServerClient();

      const { error } = await serverClient
        .from('chapter_progress')
        .insert({
          chapter_id: chapterId,
          user_id: resolvedUserId,
          current_question: 1,
          questions_answered: 0,
          score: 0,
          completed: false,
          answers: [],
        });

      if (error) {
        console.error('❌ RLS Error inserting chapter_progress:', error);
        throw error;
      }
      console.log('✅ Chapter progress initialized:', chapterId);
    } catch (error) {
      console.error('❌ Error initializing chapter progress:', error);
      throw error;
    }
  }

  async getChapterProgress(chapterId: string, userId?: string): Promise<ChapterProgress | undefined> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      if (!resolvedUserId) {
        console.warn('⚠️ No user ID for getChapterProgress');
        return undefined;
      }

      // Use authenticated server client for RLS
      const serverClient = await createSupabaseServerClient();

      const { data, error } = await serverClient
        .from('chapter_progress')
        .select('*')
        .eq('chapter_id', chapterId)
        .eq('user_id', resolvedUserId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching chapter progress:', error);
        throw error;
      }

      if (!data) return undefined;

      return {
        chapterId: data.chapter_id,
        currentQuestion: data.current_question,
        questionsAnswered: data.questions_answered,
        score: data.score,
        completed: data.completed,
        answers: data.answers || [],
      };
    } catch (error) {
      console.error('❌ Error fetching chapter progress:', error);
      return undefined;
    }
  }

  async updateChapterProgress(chapterId: string, update: Partial<ChapterProgress>, userId?: string): Promise<void> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      if (!resolvedUserId) {
        throw new Error('User not authenticated');
      }

      const existing = await this.getChapterProgress(chapterId, resolvedUserId);
      if (!existing) {
        await this.initializeChapterProgress(chapterId, resolvedUserId);
      }

      console.log('📝 Updating chapter_progress with user_id:', resolvedUserId, 'chapter_id:', chapterId);

      // Use authenticated server client for RLS
      const serverClient = await createSupabaseServerClient();

      const merged = {
        chapter_id: chapterId,
        user_id: resolvedUserId,
        current_question: update.currentQuestion ?? existing?.currentQuestion ?? 1,
        questions_answered: update.questionsAnswered ?? existing?.questionsAnswered ?? 0,
        score: update.score ?? existing?.score ?? 0,
        completed: update.completed ?? existing?.completed ?? false,
        answers: update.answers ?? existing?.answers ?? [],
      };

      const { error } = await serverClient
        .from('chapter_progress')
        .upsert(merged);

      if (error) {
        console.error('❌ RLS Error updating chapter_progress:', error);
        throw error;
      }
      console.log('✅ Chapter progress updated:', chapterId);
    } catch (error) {
      console.error('❌ Error updating chapter progress:', error);
      throw error;
    }
  }

  async addChapterAnswer(
    chapterId: string,
    questionId: string,
    questionNumber: number,
    answer: string,
    correct: boolean | undefined,
    score: number,
    feedback?: string,
    userId?: string
  ): Promise<void> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      if (!resolvedUserId) {
        throw new Error('User not authenticated');
      }

      const progress = await this.getChapterProgress(chapterId, resolvedUserId) || {
        chapterId,
        currentQuestion: 1,
        questionsAnswered: 0,
        score: 0,
        completed: false,
        answers: [],
      };

      progress.answers.push({
        questionId,
        questionNumber,
        answer,
        correct,
        score,
        feedback,
      });

      progress.questionsAnswered = progress.answers.length;
      progress.score += score;
      progress.currentQuestion = Math.min(questionNumber + 1, 5);
      progress.completed = progress.questionsAnswered >= 5;

      console.log('📝 Upserting chapter_progress with user_id:', resolvedUserId, 'chapter_id:', chapterId);

      // Use authenticated server client for RLS
      const serverClient = await createSupabaseServerClient();

      const { error } = await serverClient
        .from('chapter_progress')
        .upsert({
          chapter_id: chapterId,
          user_id: resolvedUserId,
          current_question: progress.currentQuestion,
          questions_answered: progress.questionsAnswered,
          score: progress.score,
          completed: progress.completed,
          answers: progress.answers,
        });

      if (error) {
        console.error('❌ RLS Error upserting chapter_progress:', error);
        throw error;
      }
      console.log('✅ Chapter answer added:', chapterId);
    } catch (error) {
      console.error('❌ Error adding chapter answer:', error);
      throw error;
    }
  }

  async getAllChapterProgress(userId?: string): Promise<ChapterProgress[]> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      if (!resolvedUserId) {
        console.warn('⚠️ No user ID for getAllChapterProgress');
        return [];
      }

      // Use authenticated server client for RLS
      const serverClient = await createSupabaseServerClient();

      const { data, error } = await serverClient
        .from('chapter_progress')
        .select('*')
        .eq('user_id', resolvedUserId);

      if (error) throw error;

      return (data || []).map(row => ({
        chapterId: row.chapter_id,
        currentQuestion: row.current_question,
        questionsAnswered: row.questions_answered,
        score: row.score,
        completed: row.completed,
        answers: row.answers || [],
      }));
    } catch (error) {
      console.error('❌ Error fetching all chapter progress:', error);
      return [];
    }
  }

  async deleteChapterProgress(chapterId: string, userId?: string): Promise<void> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      if (!resolvedUserId) {
        throw new Error('User not authenticated');
      }

      console.log('📝 Deleting chapter_progress with user_id:', resolvedUserId, 'chapter_id:', chapterId);

      // Use authenticated server client for RLS
      const serverClient = await createSupabaseServerClient();

      const { error } = await serverClient
        .from('chapter_progress')
        .delete()
        .eq('chapter_id', chapterId)
        .eq('user_id', resolvedUserId);

      if (error) {
        console.error('❌ RLS Error deleting chapter_progress:', error);
        throw error;
      }
      console.log('✅ Chapter progress deleted:', chapterId);
    } catch (error) {
      console.error('❌ Error deleting chapter progress:', error);
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  async deleteConceptsByChapter(chapterId: string): Promise<void> {
    console.log('✅ Concepts deleted by CASCADE for chapter:', chapterId);
  }

  async deleteChatHistoryByChapter(chapterId: string): Promise<void> {
    console.log('✅ Chat history deleted by CASCADE for chapter:', chapterId);
  }

  // ============================================================================
  // TRANSLATIONS
  // ============================================================================

  async getTranslation(key: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('translations')
        .select('value')
        .eq('key', key)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw error;
      }

      return data?.value;
    } catch (error) {
      console.error('❌ Error fetching translation:', error);
      return undefined;
    }
  }

  async setTranslation(key: string, value: any, userId?: string): Promise<void> {
    try {
      const resolvedUserId = await this.getUserId(userId);
      
      const { error } = await supabase
        .from('translations')
        .upsert({
          key,
          value,
          user_id: resolvedUserId,
        });

      if (error) throw error;
      console.log('✅ Translation cached:', key);
    } catch (error) {
      console.error('❌ Error setting translation:', error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  async clear(): Promise<void> {
    try {
      await supabase.from('translations').delete().neq('key', '');
      await supabase.from('chapter_progress').delete().neq('chapter_id', '');
      await supabase.from('chat_history').delete().neq('concept_id', '');
      await supabase.from('user_progress').delete().neq('concept_id', '');
      await supabase.from('concepts').delete().neq('id', '');
      await supabase.from('chapters').delete().neq('id', '');
      
      console.log('✅ All data cleared from Supabase');
    } catch (error) {
      console.error('❌ Error clearing data:', error);
      throw error;
    }
  }

  async getAllData() {
    try {
      const [chapters, concepts, progress, chatHistory, chapterProgress, translations] = await Promise.all([
        this.getAllChapters(),
        supabase.from('concepts').select('*').then(r => r.data || []),
        this.getAllProgress(),
        supabase.from('chat_history').select('*').then(r => r.data || []),
        this.getAllChapterProgress(),
        supabase.from('translations').select('*').then(r => r.data || []),
      ]);

      return {
        chapters: chapters.map(c => [c.id, c]),
        concepts: concepts.map((c: any) => [c.id, {
          id: c.id,
          chapterId: c.chapter_id,
          title: c.title,
          description: c.description,
          difficulty: c.difficulty,
          orderIndex: c.order_index,
          sourceText: c.source_text,
        }]),
        progress: progress.map(p => [p.conceptId, p]),
        chatHistory: chatHistory.map((ch: any) => [ch.concept_id, {
          conceptId: ch.concept_id,
          messages: (ch.messages || []).map((msg: any) => ({
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
          })),
        }]),
        chapterProgress: chapterProgress.map(cp => [cp.chapterId, cp]),
        translations: translations.map((t: any) => [t.key, t.value]),
      };
    } catch (error) {
      console.error('❌ Error fetching all data:', error);
      return {
        chapters: [],
        concepts: [],
        progress: [],
        chatHistory: [],
        chapterProgress: [],
        translations: [],
      };
    }
  }
}

// Singleton instance
export const memoryStore = new MemoryStoreSupabase();
