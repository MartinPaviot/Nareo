// Enhanced memory storage with persistence support
// In production, this would be replaced with a real database

import { ChapterQuestion, ChapterProgress, ChapterData } from '@/types/concept.types';

interface Chapter {
  id: string;
  title: string; // Kept for backward compatibility
  summary: string; // Kept for backward compatibility
  englishTitle: string;
  englishDescription: string;
  frenchTitle: string;
  frenchDescription: string;
  pdfText: string;
  extractedText?: string; // Raw text extracted from images/PDFs
  difficulty?: 'easy' | 'medium' | 'hard';
  orderIndex?: number;
  questions?: ChapterQuestion[]; // Pre-generated questions for chapter-based learning
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
  sourceText?: string; // Original text from image/PDF related to this concept
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

// Global storage for server-side persistence
const globalForMemoryStore = global as typeof globalThis & {
  memoryStoreData?: {
    chapters: Map<string, Chapter>;
    concepts: Map<string, Concept>;
    progress: Map<string, UserProgress>;
    chatHistory: Map<string, ChatMessage>;
    chapterProgress: Map<string, ChapterProgress>;
    translations: Map<string, any>;
  };
};

class MemoryStore {
  private chapters: Map<string, Chapter>;
  private concepts: Map<string, Concept>;
  private progress: Map<string, UserProgress>;
  private chatHistory: Map<string, ChatMessage>;
  private chapterProgress: Map<string, ChapterProgress>;
  private translations: Map<string, any>;
  private isServer: boolean;

  constructor() {
    this.isServer = typeof window === 'undefined';
    
    // On server, use global object to persist across module reloads
    if (this.isServer) {
      if (!globalForMemoryStore.memoryStoreData) {
        globalForMemoryStore.memoryStoreData = {
          chapters: new Map(),
          concepts: new Map(),
          progress: new Map(),
          chatHistory: new Map(),
          chapterProgress: new Map(),
          translations: new Map(),
        };
      }
      
      this.chapters = globalForMemoryStore.memoryStoreData.chapters;
      this.concepts = globalForMemoryStore.memoryStoreData.concepts;
      this.progress = globalForMemoryStore.memoryStoreData.progress;
      this.chatHistory = globalForMemoryStore.memoryStoreData.chatHistory;
      this.chapterProgress = globalForMemoryStore.memoryStoreData.chapterProgress;
      this.translations = globalForMemoryStore.memoryStoreData.translations;
    } else {
      // Client side: use local Maps and load from localStorage
      this.chapters = new Map();
      this.concepts = new Map();
      this.progress = new Map();
      this.chatHistory = new Map();
      this.chapterProgress = new Map();
      this.translations = new Map();
      this.loadFromStorage();
    }
  }

  // Persistence methods
  private saveToStorage() {
    if (this.isServer) return;
    
    try {
      const data = {
        chapters: Array.from(this.chapters.entries()),
        concepts: Array.from(this.concepts.entries()),
        progress: Array.from(this.progress.entries()),
        chatHistory: Array.from(this.chatHistory.entries()),
        chapterProgress: Array.from(this.chapterProgress.entries()),
        translations: Array.from(this.translations.entries()),
      };
      localStorage.setItem('levelup_data', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  private loadFromStorage() {
    if (this.isServer) return;
    
    try {
      const stored = localStorage.getItem('levelup_data');
      if (stored) {
        const data = JSON.parse(stored);
        this.chapters = new Map(data.chapters);
        this.concepts = new Map(data.concepts);
        this.progress = new Map(data.progress);
        this.chatHistory = new Map(data.chatHistory);
        this.chapterProgress = new Map(data.chapterProgress || []);
        this.translations = new Map(data.translations || []);
        console.log('✅ Loaded data from localStorage');
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
  }

  // Chapters
  addChapter(chapter: Chapter) {
    this.chapters.set(chapter.id, chapter);
    this.saveToStorage();
    console.log('✅ Chapter saved:', chapter.id);
  }

  getChapter(id: string): Chapter | undefined {
    return this.chapters.get(id);
  }

  // Concepts
  addConcept(concept: Concept) {
    this.concepts.set(concept.id, concept);
    this.saveToStorage();
  }

  getConcept(id: string): Concept | undefined {
    return this.concepts.get(id);
  }

  getConceptsByChapter(chapterId: string): Concept[] {
    return Array.from(this.concepts.values())
      .filter(c => c.chapterId === chapterId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  // Progress
  updateProgress(conceptId: string, progress: Partial<UserProgress>) {
    const existing = this.progress.get(conceptId) || {
      conceptId,
      phase1Score: 0,
      phase2Score: 0,
      phase3Score: 0,
      totalScore: 0,
      badge: null,
      completed: false,
    };
    
    this.progress.set(conceptId, { ...existing, ...progress });
    this.saveToStorage();
  }

  getProgress(conceptId: string): UserProgress | undefined {
    return this.progress.get(conceptId);
  }

  getAllProgress(): UserProgress[] {
    return Array.from(this.progress.values());
  }

  // Chat History
  addChatMessage(conceptId: string, role: 'user' | 'assistant', content: string) {
    const existing = this.chatHistory.get(conceptId) || {
      conceptId,
      messages: [],
    };
    
    existing.messages.push({
      role,
      content,
      timestamp: new Date(),
    });
    
    this.chatHistory.set(conceptId, existing);
    this.saveToStorage();
  }

  getChatHistory(conceptId: string): ChatMessage | undefined {
    return this.chatHistory.get(conceptId);
  }

  clearChatHistory(conceptId: string) {
    this.chatHistory.delete(conceptId);
    this.saveToStorage();
  }

  // Chapter Progress (New methods for chapter-based learning)
  initializeChapterProgress(chapterId: string) {
    if (!this.chapterProgress.has(chapterId)) {
      this.chapterProgress.set(chapterId, {
        chapterId,
        currentQuestion: 1,
        questionsAnswered: 0,
        score: 0,
        completed: false,
        answers: [],
      });
      this.saveToStorage();
    }
  }

  getChapterProgress(chapterId: string): ChapterProgress | undefined {
    return this.chapterProgress.get(chapterId);
  }

  updateChapterProgress(chapterId: string, update: Partial<ChapterProgress>) {
    const existing = this.chapterProgress.get(chapterId) || {
      chapterId,
      currentQuestion: 1,
      questionsAnswered: 0,
      score: 0,
      completed: false,
      answers: [],
    };
    
    this.chapterProgress.set(chapterId, { ...existing, ...update });
    this.saveToStorage();
  }

  addChapterAnswer(
    chapterId: string,
    questionId: string,
    questionNumber: number,
    answer: string,
    correct: boolean | undefined,
    score: number,
    feedback?: string
  ) {
    const progress = this.getChapterProgress(chapterId) || {
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

    this.chapterProgress.set(chapterId, progress);
    this.saveToStorage();
  }

  getAllChapterProgress(): ChapterProgress[] {
    return Array.from(this.chapterProgress.values());
  }

  // Get all chapters (for sidebar display)
  getAllChapters(): Chapter[] {
    return Array.from(this.chapters.values()).sort((a, b) => 
      (a.orderIndex || 0) - (b.orderIndex || 0)
    );
  }

  // Translation cache methods
  getTranslation(key: string): any {
    return this.translations.get(key);
  }

  setTranslation(key: string, value: any) {
    this.translations.set(key, value);
    this.saveToStorage();
  }

  // Utility
  clear() {
    this.chapters.clear();
    this.concepts.clear();
    this.progress.clear();
    this.chatHistory.clear();
    this.chapterProgress.clear();
    this.translations.clear();
    this.saveToStorage();
  }

  // Debug method
  getAllData() {
    return {
      chapters: Array.from(this.chapters.entries()),
      concepts: Array.from(this.concepts.entries()),
      progress: Array.from(this.progress.entries()),
      chatHistory: Array.from(this.chatHistory.entries()),
      chapterProgress: Array.from(this.chapterProgress.entries()),
      translations: Array.from(this.translations.entries()),
    };
  }
}

// Singleton instance
export const memoryStore = new MemoryStore();
