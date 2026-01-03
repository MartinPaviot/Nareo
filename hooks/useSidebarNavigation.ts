'use client';

import { useState, useCallback, useEffect } from 'react';
import type { SidebarState, SidebarLevel } from '@/types/sidebar';

const STORAGE_KEY = 'nareo-sidebar-open';

interface UseSidebarNavigationReturn extends SidebarState {
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  goToFolderLevel: () => void;
  goToCourseLevel: (folderId: string, folderName: string) => void;
  openToFolder: (folderId: string, folderName: string) => void;
}

export function useSidebarNavigation(): UseSidebarNavigationReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [level, setLevel] = useState<SidebarLevel>('folders');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);

  // Load persisted open state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') {
        setIsOpen(true);
      }
    }
  }, []);

  // Persist open state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(isOpen));
    }
  }, [isOpen]);

  const openSidebar = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsOpen(false);
    // Reset to folders level when closing
    setLevel('folders');
    setSelectedFolderId(null);
    setSelectedFolderName(null);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        // Closing - reset level
        setLevel('folders');
        setSelectedFolderId(null);
        setSelectedFolderName(null);
      }
      return !prev;
    });
  }, []);

  const goToFolderLevel = useCallback(() => {
    setLevel('folders');
    setSelectedFolderId(null);
    setSelectedFolderName(null);
  }, []);

  const goToCourseLevel = useCallback((folderId: string, folderName: string) => {
    setSelectedFolderId(folderId);
    setSelectedFolderName(folderName);
    setLevel('courses');
  }, []);

  // Open sidebar directly to a specific folder's courses
  const openToFolder = useCallback((folderId: string, folderName: string) => {
    setIsOpen(true);
    setSelectedFolderId(folderId);
    setSelectedFolderName(folderName);
    setLevel('courses');
  }, []);

  return {
    isOpen,
    level,
    selectedFolderId,
    selectedFolderName,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    goToFolderLevel,
    goToCourseLevel,
    openToFolder,
  };
}
