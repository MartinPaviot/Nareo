'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { PriorityItem } from '@/lib/courses/types';

interface UsePriorityItemsReturn {
  priorityItems: PriorityItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  dismissItem: (itemId: string) => Promise<boolean>;
}

export function usePriorityItems(): UsePriorityItemsReturn {
  const { user } = useAuth();
  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPriorityItems = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/courses/priority');
      if (!response.ok) {
        throw new Error('Failed to fetch priority items');
      }

      const data = await response.json();
      setPriorityItems(data.items || []);
    } catch (err) {
      console.error('Error fetching priority items:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const dismissItem = useCallback(async (itemId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const response = await fetch(`/api/courses/priority/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss item');
      }

      // Optimistic update
      setPriorityItems(prev => prev.filter(item => item.id !== itemId));
      return true;
    } catch (err) {
      console.error('Error dismissing item:', err);
      return false;
    }
  }, [user]);

  useEffect(() => {
    fetchPriorityItems();
  }, [fetchPriorityItems]);

  return {
    priorityItems,
    isLoading,
    error,
    refetch: fetchPriorityItems,
    dismissItem,
  };
}
