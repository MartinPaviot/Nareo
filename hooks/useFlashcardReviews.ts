'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { calculateNextReview, getMasteryLevel, Rating, SessionStats } from '@/lib/spaced-repetition';

// Types
export interface FlashcardWithProgress {
  id: string;
  front: string;
  back: string;
  type: string;
  course_id: string;
  chapter_id: string | null;
  cloze_text?: string | null;
  cloze_answer?: string | null;
  reversed_term?: string | null;
  reversed_def?: string | null;
  course?: {
    id: string;
    title: string;
  };
  progress: {
    ease_factor: number;
    interval_days: number;
    next_review_at: string;
    review_count: number;
    correct_count: number;
    incorrect_count: number;
    last_rating: Rating | null;
    mastery: string;
  } | null;
}

export interface ReviewCount {
  course_id: string;
  course_title: string;
  count: number;
}

interface UseTodayReviewsReturn {
  cards: FlashcardWithProgress[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseTodayReviewCountsReturn {
  counts: ReviewCount[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseUpdateCardProgressReturn {
  updateProgress: (flashcardId: string, rating: Rating, currentProgress: FlashcardWithProgress['progress']) => Promise<void>;
  isUpdating: boolean;
  error: string | null;
}

interface UseCourseFlashcardsReturn {
  cards: FlashcardWithProgress[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch cards due for review today
 */
export function useTodayReviews(courseId?: string): UseTodayReviewsReturn {
  const { user } = useAuth();
  const [cards, setCards] = useState<FlashcardWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    if (!user) {
      setCards([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const url = courseId
        ? `/api/flashcards/reviews?courseId=${courseId}`
        : '/api/flashcards/reviews';

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch review cards');
      }

      const data = await response.json();
      setCards(data.cards || []);
    } catch (err) {
      console.error('Error fetching review cards:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [user, courseId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  return {
    cards,
    isLoading,
    error,
    refetch: fetchCards,
  };
}

/**
 * Hook to get today's review counts grouped by course
 */
export function useTodayReviewCounts(): UseTodayReviewCountsReturn {
  const { user } = useAuth();
  const [counts, setCounts] = useState<ReviewCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!user) {
      setCounts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/flashcards/reviews/counts');
      if (!response.ok) {
        throw new Error('Failed to fetch review counts');
      }

      const data = await response.json();
      setCounts(data.counts || []);
    } catch (err) {
      console.error('Error fetching review counts:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const totalCount = counts.reduce((sum, c) => sum + c.count, 0);

  return {
    counts,
    totalCount,
    isLoading,
    error,
    refetch: fetchCounts,
  };
}

/**
 * Hook to update card progress after a review
 */
export function useUpdateCardProgress(): UseUpdateCardProgressReturn {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProgress = useCallback(async (
    flashcardId: string,
    rating: Rating,
    currentProgress: FlashcardWithProgress['progress']
  ) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);

      // Calculate new progress using SM-2 algorithm
      const newProgress = calculateNextReview(
        currentProgress ? {
          ease_factor: currentProgress.ease_factor,
          interval_days: currentProgress.interval_days,
          next_review_at: new Date(currentProgress.next_review_at)
        } : null,
        rating
      );

      const mastery = getMasteryLevel(newProgress.interval_days);

      const response = await fetch('/api/flashcards/reviews/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flashcardId,
          rating,
          easeFactor: newProgress.ease_factor,
          intervalDays: newProgress.interval_days,
          nextReviewAt: newProgress.next_review_at.toISOString(),
          mastery,
          reviewCount: (currentProgress?.review_count ?? 0) + 1,
          correctCount: (currentProgress?.correct_count ?? 0) + (rating === 'good' || rating === 'easy' ? 1 : 0),
          incorrectCount: (currentProgress?.incorrect_count ?? 0) + (rating === 'hard' ? 1 : 0),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update card progress');
      }
    } catch (err) {
      console.error('Error updating card progress:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [user]);

  return {
    updateProgress,
    isUpdating,
    error,
  };
}

/**
 * Hook to fetch all flashcards for a course with progress
 */
export function useCourseFlashcards(courseId: string): UseCourseFlashcardsReturn {
  const { user } = useAuth();
  const [cards, setCards] = useState<FlashcardWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    if (!courseId) {
      setCards([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/courses/${courseId}/flashcards?withProgress=true`);
      if (!response.ok) {
        throw new Error('Failed to fetch course flashcards');
      }

      const data = await response.json();
      setCards(data.flashcards || []);
    } catch (err) {
      console.error('Error fetching course flashcards:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  return {
    cards,
    isLoading,
    error,
    refetch: fetchCards,
  };
}

/**
 * Hook to save a flashcard session
 */
export function useSaveSession() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveSession = useCallback(async (courseId: string, stats: SessionStats) => {
    if (!user) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch('/api/flashcards/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          totalCards: stats.total,
          cardsHard: stats.hard,
          cardsGood: stats.good,
          cardsEasy: stats.easy,
          durationSeconds: stats.completedAt
            ? Math.floor((stats.completedAt.getTime() - stats.startedAt.getTime()) / 1000)
            : null,
          startedAt: stats.startedAt.toISOString(),
          completedAt: stats.completedAt?.toISOString() || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save session');
      }
    } catch (err) {
      console.error('Error saving session:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  return {
    saveSession,
    isSaving,
    error,
  };
}
