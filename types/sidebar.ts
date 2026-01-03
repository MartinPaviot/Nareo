// Sidebar navigation types

export type SidebarLevel = 'folders' | 'courses';

export interface SidebarState {
  isOpen: boolean;
  level: SidebarLevel;
  selectedFolderId: string | null;
  selectedFolderName: string | null;
}

export interface SidebarNavigationContextValue extends SidebarState {
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  goToFolderLevel: () => void;
  goToCourseLevel: (folderId: string, folderName: string) => void;
  openToFolder: (folderId: string, folderName: string) => void;
}

export interface BreadcrumbData {
  folderId: string | null;
  folderName: string | null;
  courseName: string;
  courseId: string;
}
