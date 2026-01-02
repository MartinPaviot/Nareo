'use client';

import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursesOrganized } from './useCoursesOrganized';

interface UseFoldersManagementReturn {
  createFolder: (name: string, color?: string, icon?: string) => Promise<string | null>;
  deleteFolder: (folderId: string, moveCourses?: 'delete' | 'uncategorize') => Promise<boolean>;
  updateFolder: (folderId: string, updates: { name?: string; color?: string; icon?: string }) => Promise<boolean>;
  toggleFolderCollapse: (folderId: string) => Promise<boolean>;
}

export function useFoldersManagement(): UseFoldersManagementReturn {
  const { user } = useAuth();
  const { refetch } = useCoursesOrganized();

  const createFolder = useCallback(async (
    name: string,
    color: string = '#F97316',
    icon: string = 'folder'
  ): Promise<string | null> => {
    if (!user) return null;

    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, icon }),
      });

      if (!response.ok) {
        throw new Error('Failed to create folder');
      }

      const data = await response.json();
      await refetch();
      return data.folder?.id || data.id;
    } catch (err) {
      console.error('Error creating folder:', err);
      return null;
    }
  }, [user, refetch]);

  const deleteFolder = useCallback(async (
    folderId: string,
    moveCourses: 'delete' | 'uncategorize' = 'uncategorize'
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moveCourses }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete folder');
      }

      await refetch();
      return true;
    } catch (err) {
      console.error('Error deleting folder:', err);
      return false;
    }
  }, [user, refetch]);

  const updateFolder = useCallback(async (
    folderId: string,
    updates: { name?: string; color?: string; icon?: string }
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update folder');
      }

      await refetch();
      return true;
    } catch (err) {
      console.error('Error updating folder:', err);
      return false;
    }
  }, [user, refetch]);

  const toggleFolderCollapse = useCallback(async (folderId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const response = await fetch(`/api/folders/${folderId}/toggle-collapse`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to toggle folder collapse');
      }

      await refetch();
      return true;
    } catch (err) {
      console.error('Error toggling folder collapse:', err);
      return false;
    }
  }, [user, refetch]);

  return {
    createFolder,
    deleteFolder,
    updateFolder,
    toggleFolderCollapse,
  };
}
