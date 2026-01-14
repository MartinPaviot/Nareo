'use client';

import TopBarActions from './TopBarActions';
import { CourseBreadcrumb } from '@/components/Sidebar';
import { useTheme } from '@/contexts/ThemeContext';

interface LearnPageHeaderProps {
  courseName: string;
  folderName: string | null;
  folderId: string | null;
  onFolderClick: () => void;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
}

export default function LearnPageHeader({
  courseName,
  folderName,
  onFolderClick,
  maxWidth = '4xl',
}: LearnPageHeaderProps) {
  const { isDark } = useTheme();

  const maxWidthClass = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  }[maxWidth];

  return (
    <header className={`border-b transition-colors sticky top-0 z-30 h-[52px] ${
      isDark
        ? 'bg-neutral-900 border-neutral-800'
        : 'bg-white border-gray-200'
    }`}>
      <div className={`${maxWidthClass} mx-auto px-3 sm:px-4 h-full flex items-center justify-between gap-3`}>
        {/* Left side: Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CourseBreadcrumb
            folderName={folderName}
            courseName={courseName}
            onFolderClick={onFolderClick}
          />
        </div>

        {/* Right side: TopBarActions */}
        <div className="flex-shrink-0">
          <TopBarActions showDarkModeToggle />
        </div>
      </div>
    </header>
  );
}
