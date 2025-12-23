'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursesRefresh } from '@/contexts/CoursesRefreshContext';
import type { SmartCTA } from '@/lib/courses/types';

interface UseSmartCTAReturn {
  smartCTA: SmartCTA | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useSmartCTA(courseId: string): UseSmartCTAReturn {
  const { user } = useAuth();
  const { subscribe } = useCoursesRefresh();
  const [smartCTA, setSmartCTA] = useState<SmartCTA | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSmartCTA = useCallback(async () => {
    if (!user || !courseId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(`/api/courses/${courseId}/smart-cta`);
      if (!response.ok) {
        throw new Error('Failed to fetch smart CTA');
      }

      const data = await response.json();
      setSmartCTA(data.cta);
    } catch (err) {
      console.error('Error fetching smart CTA:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, courseId]);

  useEffect(() => {
    fetchSmartCTA();
  }, [fetchSmartCTA]);

  // Subscribe to global refresh events
  useEffect(() => {
    const unsubscribe = subscribe(fetchSmartCTA);
    return unsubscribe;
  }, [subscribe, fetchSmartCTA]);

  return {
    smartCTA,
    isLoading,
    refetch: fetchSmartCTA,
  };
}
