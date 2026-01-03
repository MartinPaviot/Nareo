'use client';

import { useState, useRef, useEffect } from 'react';
import { FileText, Check, MoreHorizontal, FolderInput, Inbox } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getMasteryColor } from '@/lib/courses/utils';
import type { Folder } from '@/lib/courses/types';

interface CourseItemProps {
  id: string;
  name: string;
  masteredChapters: number;
  totalChapters: number;
  masteryPercentage: number;
  isActive: boolean;
  onClick: () => void;
  subtitle?: string;
  folders?: Folder[];
  currentFolderId?: string | null;
  onMoveCourse?: (courseId: string, folderId: string | null) => Promise<boolean>;
}

export default function CourseItem({
  id,
  name,
  masteredChapters,
  totalChapters,
  masteryPercentage,
  isActive,
  onClick,
  subtitle,
  folders = [],
  currentFolderId,
  onMoveCourse,
}: CourseItemProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const isCompleted = masteryPercentage >= 100;
  const masteryColor = getMasteryColor(masteryPercentage);

  const [showMenu, setShowMenu] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleMove = async (folderId: string | null) => {
    if (!onMoveCourse || isMoving) return;

    setIsMoving(true);
    await onMoveCourse(id, folderId);
    setIsMoving(false);
    setShowMenu(false);
  };

  // Filter out current folder from options
  const availableFolders = folders.filter(f => f.id !== currentFolderId);

  const canMove = onMoveCourse && (availableFolders.length > 0 || currentFolderId);

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`w-full text-left rounded-lg transition-all ${
          isActive
            ? isDark
              ? 'bg-orange-500/10 border-l-2 border-l-orange-500 pl-3 pr-3 py-2.5'
              : 'bg-orange-50 border-l-2 border-l-orange-500 pl-3 pr-3 py-2.5'
            : isDark
              ? 'hover:bg-neutral-800 pl-4 pr-3 py-2.5'
              : 'hover:bg-gray-50 pl-4 pr-3 py-2.5'
        }`}
      >
        <div className="flex items-start gap-2.5">
          {/* File icon */}
          <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
            isActive
              ? 'text-orange-500'
              : isDark
                ? 'text-neutral-500'
                : 'text-gray-400'
          }`} />

          <div className="flex-1 min-w-0">
            {/* Course name */}
            <p className={`text-sm font-medium truncate pr-6 ${
              isActive
                ? 'text-orange-500'
                : isDark
                  ? 'text-neutral-100'
                  : 'text-gray-900'
            }`}>
              {name}
            </p>

            {/* Folder name subtitle (when searching) */}
            {subtitle && (
              <p className={`text-xs truncate mt-0.5 ${
                isDark ? 'text-neutral-500' : 'text-gray-500'
              }`}>
                {subtitle}
              </p>
            )}

            {/* Progress bar and stats */}
            <div className="mt-1.5 flex items-center gap-2">
              {/* Progress bar */}
              <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${
                isDark ? 'bg-neutral-700' : 'bg-gray-200'
              }`}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, masteryPercentage)}%`,
                    backgroundColor: masteryColor,
                  }}
                />
              </div>

              {/* Progress text */}
              <span className={`text-xs whitespace-nowrap ${
                isDark ? 'text-neutral-500' : 'text-gray-500'
              }`}>
                {masteredChapters}/{totalChapters}
              </span>

              {/* Completed checkmark */}
              {isCompleted && (
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Move menu button - appears on hover */}
      {canMove && (
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={`absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
            showMenu ? 'opacity-100' : ''
          } ${
            isDark
              ? 'hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200'
              : 'hover:bg-gray-200 text-gray-400 hover:text-gray-600'
          }`}
          title={translate('sidebar_move_course') || 'Déplacer vers...'}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      )}

      {/* Dropdown menu */}
      {showMenu && canMove && (
        <div
          ref={menuRef}
          className={`absolute right-0 top-8 z-50 w-48 rounded-lg shadow-lg border py-1 ${
            isDark
              ? 'bg-neutral-800 border-neutral-700'
              : 'bg-white border-gray-200'
          }`}
        >
          <div className={`px-3 py-1.5 text-xs font-medium ${
            isDark ? 'text-neutral-500' : 'text-gray-500'
          }`}>
            <div className="flex items-center gap-1.5">
              <FolderInput className="w-3 h-3" />
              {translate('sidebar_move_to') || 'Déplacer vers'}
            </div>
          </div>

          {/* Folder options */}
          {availableFolders.map((folder) => (
            <button
              key={folder.id}
              onClick={(e) => {
                e.stopPropagation();
                handleMove(folder.id);
              }}
              disabled={isMoving}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                isDark
                  ? 'hover:bg-neutral-700 text-neutral-200'
                  : 'hover:bg-gray-100 text-gray-700'
              } ${isMoving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: folder.color }}
              />
              <span className="truncate">{folder.name}</span>
            </button>
          ))}

          {/* Move to uncategorized (if currently in a folder) */}
          {currentFolderId && (
            <>
              {availableFolders.length > 0 && (
                <div className={`border-t my-1 ${isDark ? 'border-neutral-700' : 'border-gray-200'}`} />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMove(null);
                }}
                disabled={isMoving}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  isDark
                    ? 'hover:bg-neutral-700 text-neutral-400'
                    : 'hover:bg-gray-100 text-gray-500'
                } ${isMoving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Inbox className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{translate('sidebar_no_folder') || 'Sans dossier'}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
