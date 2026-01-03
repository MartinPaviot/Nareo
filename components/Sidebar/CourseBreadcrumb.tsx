'use client';

import { Folder, FileText, ChevronRight } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface CourseBreadcrumbProps {
  folderName: string | null;
  courseName: string;
  onFolderClick?: () => void;
}

export default function CourseBreadcrumb({
  folderName,
  courseName,
  onFolderClick,
}: CourseBreadcrumbProps) {
  const { isDark } = useTheme();

  if (!folderName) {
    // Course without folder - just show course name
    return (
      <div className="flex items-center gap-2 min-w-0">
        <FileText className={`w-4 h-4 flex-shrink-0 ${
          isDark ? 'text-orange-400' : 'text-orange-500'
        }`} />
        <span className={`text-sm font-semibold truncate ${
          isDark ? 'text-orange-400' : 'text-orange-600'
        }`}>
          {courseName}
        </span>
      </div>
    );
  }

  // Course with folder - show folder > course
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {/* Folder */}
      <button
        onClick={onFolderClick}
        className={`flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-md transition-colors min-w-0 ${
          isDark
            ? 'text-neutral-300 hover:bg-neutral-800 hover:text-orange-400'
            : 'text-gray-600 hover:bg-gray-100 hover:text-orange-600'
        }`}
      >
        <Folder className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-sm font-medium truncate max-w-[120px]">{folderName}</span>
      </button>

      {/* Separator */}
      <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${
        isDark ? 'text-neutral-600' : 'text-gray-400'
      }`} />

      {/* Course (active) */}
      <div className="flex items-center gap-1.5 min-w-0">
        <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${
          isDark ? 'text-orange-400' : 'text-orange-500'
        }`} />
        <span className={`text-sm font-semibold truncate max-w-[150px] ${
          isDark ? 'text-orange-400' : 'text-orange-600'
        }`}>
          {courseName}
        </span>
      </div>
    </div>
  );
}
