'use client';

import { useCallback } from 'react';
import { useCoursesRefresh } from '@/contexts/CoursesRefreshContext';

interface CreateFolderResult {
  success: boolean;
  folderId?: string;
  error?: string;
}

interface UseFoldersManagementReturn {
  createFolder: (name: string, color?: string, icon?: string) => Promise<CreateFolderResult>;
  deleteFolder: (folderId: string, moveCourses?: 'delete' | 'uncategorize') => Promise<boolean>;
  updateFolder: (folderId: string, updates: { name?: string; color?: string; icon?: string }) => Promise<boolean>;
  toggleFolderCollapse: (folderId: string) => Promise<boolean>;
}

export function useFoldersManagement(): UseFoldersManagementReturn {
  const { triggerRefresh } = useCoursesRefresh();

  const createFolder = useCallback(async (
    name: string,
    color: string = '#F97316',
    icon: string = 'folder'
  ): Promise<CreateFolderResult> => {
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, icon }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to create folder' };
      }

      triggerRefresh();
      return { success: true, folderId: data.folder?.id || data.id };
    } catch (err) {
      console.error('Error creating folder:', err);
      return { success: false, error: 'Une erreur est survenue' };
    }
  }, [triggerRefresh]);

  const deleteFolder = useCallback(async (
    folderId: string,
    moveCourses: 'delete' | 'uncategorize' = 'uncategorize'
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moveCourses }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete folder');
      }

      triggerRefresh();
      return true;
    } catch (err) {
      console.error('Error deleting folder:', err);
      return false;
    }
  }, [triggerRefresh]);

  const updateFolder = useCallback(async (
    folderId: string,
    updates: { name?: string; color?: string; icon?: string }
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update folder');
      }

      triggerRefresh();
      return true;
    } catch (err) {
      console.error('Error updating folder:', err);
      return false;
    }
  }, [triggerRefresh]);

  const toggleFolderCollapse = useCallback(async (folderId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/folders/${folderId}/toggle-collapse`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to toggle folder collapse');
      }

      // Don't trigger refresh here - the local state is already updated in FolderSection
      // Calling triggerRefresh would cause the entire courses list to reload and reset expand states
      return true;
    } catch (err) {
      console.error('Error toggling folder collapse:', err);
      return false;
    }
  }, []);

  return {
    createFolder,
    deleteFolder,
    updateFolder,
    toggleFolderCollapse,
  };
}
