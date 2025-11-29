'use client';

import { useState, useCallback } from 'react';
import {
  Folder,
  FolderWithCourses,
  Course,
  DeleteCourseResponse,
  RenameCourseResponse,
  CreateFolderResponse,
  AddCourseToFolderResponse,
  GetFoldersResponse,
} from '@/types/course-management';

export function useCourseManagement() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Delete a course and all its related data
   */
  const deleteCourse = useCallback(async (courseId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: 'DELETE',
      });

      const data: DeleteCourseResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete course');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error deleting course:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Rename a course (update editable_title)
   */
  const renameCourse = useCallback(
    async (courseId: string, newTitle: string): Promise<Course | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/courses/${courseId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ editable_title: newTitle }),
        });

        const data: RenameCourseResponse = await response.json();

        if (!response.ok || !data.success || !data.course) {
          throw new Error(data.error || 'Failed to rename course');
        }

        return data.course;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('Error renaming course:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Create a new folder
   */
  const createFolder = useCallback(
    async (name: string, color?: string, icon?: string): Promise<Folder | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/folders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, color, icon }),
        });

        const data: CreateFolderResponse = await response.json();

        if (!response.ok || !data.success || !data.folder) {
          throw new Error(data.error || 'Failed to create folder');
        }

        return data.folder;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('Error creating folder:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Add a course to a folder
   */
  const addCourseToFolder = useCallback(
    async (folderId: string, courseId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/folders/courses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ folder_id: folderId, course_id: courseId }),
        });

        const data: AddCourseToFolderResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to add course to folder');
        }

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('Error adding course to folder:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Remove a course from a folder
   */
  const removeCourseFromFolder = useCallback(
    async (folderId: string, courseId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/folders/courses', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ folder_id: folderId, course_id: courseId }),
        });

        const data: AddCourseToFolderResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to remove course from folder');
        }

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('Error removing course from folder:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Fetch all folders with their courses
   */
  const getFolders = useCallback(async (): Promise<FolderWithCourses[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/folders');
      const data: GetFoldersResponse = await response.json();

      if (!response.ok || !data.success || !data.folders) {
        throw new Error(data.error || 'Failed to fetch folders');
      }

      return data.folders;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error fetching folders:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Delete a folder (removes folder but keeps courses)
   */
  const deleteFolder = useCallback(async (folderId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete folder');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error deleting folder:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    deleteCourse,
    renameCourse,
    createFolder,
    addCourseToFolder,
    removeCourseFromFolder,
    getFolders,
    deleteFolder,
  };
}
