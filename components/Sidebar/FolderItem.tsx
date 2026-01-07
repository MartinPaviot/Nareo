'use client';

import { Folder, ChevronRight } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface FolderItemProps {
  id: string;
  name: string;
  courseCount: number;
  color?: string;
  icon?: string;
  isActive: boolean;
  onClick: () => void;
}

export default function FolderItem({
  name,
  courseCount,
  color = '#F97316',
  icon,
  isActive,
  onClick,
}: FolderItemProps) {
  const { isDark } = useTheme();

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-1 rounded-md transition-all group ${
        isActive
          ? isDark
            ? 'bg-orange-500/20 border border-orange-500/30'
            : 'bg-orange-50 border border-orange-200'
          : isDark
            ? 'hover:bg-neutral-800 border border-transparent'
            : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      {/* Folder icon */}
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        {icon ? (
          <span className="text-sm">{icon}</span>
        ) : (
          <Folder
            className="w-3.5 h-3.5"
            style={{ color }}
          />
        )}
      </div>

      {/* Folder name */}
      <span className={`flex-1 text-left text-sm font-medium truncate ${
        isActive
          ? 'text-orange-500'
          : isDark
            ? 'text-neutral-100'
            : 'text-gray-900'
      }`}>
        {name}
      </span>

      {/* Course count badge */}
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
        isActive
          ? isDark
            ? 'bg-orange-500/30 text-orange-400'
            : 'bg-orange-100 text-orange-600'
          : isDark
            ? 'bg-neutral-700 text-neutral-400'
            : 'bg-gray-100 text-gray-500'
      }`}>
        {courseCount}
      </span>

      {/* Chevron */}
      <ChevronRight className={`w-4 h-4 transition-transform ${
        isActive
          ? 'text-orange-500'
          : isDark
            ? 'text-neutral-500 group-hover:text-neutral-400'
            : 'text-gray-400 group-hover:text-gray-500'
      } group-hover:translate-x-0.5`} />
    </button>
  );
}
