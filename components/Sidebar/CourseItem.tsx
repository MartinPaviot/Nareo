'use client';

import { useState, useRef, useEffect } from 'react';
import { FileText, Check, MoreHorizontal, FolderInput, Inbox, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Folder } from '@/lib/courses/types';
import DeleteCourseDialog from '@/components/course-management/DeleteCourseDialog';

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
  onCourseDeleted?: () => void;
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
  onCourseDeleted,
}: CourseItemProps) {
  const { translate } = useLanguage();
  const isCompleted = masteryPercentage >= 100;

  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
  const showMenuButton = canMove || onCourseDeleted;

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-nareo)] focus-visible:ring-offset-2"
        style={{
          backgroundColor: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
          border: isActive ? '1px solid var(--sidebar-active-border)' : '1px solid transparent',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {/* File icon */}
        <FileText
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: isActive ? 'var(--color-nareo)' : 'var(--sidebar-text-muted)' }}
        />

        {/* Course name and subtitle */}
        <div className="flex-1 min-w-0 text-left">
          <span
            className="text-[11px] font-medium truncate block"
            style={{ color: isActive ? 'var(--color-nareo)' : 'var(--sidebar-text)' }}
          >
            {name}
          </span>
          {subtitle && (
            <span
              className="text-[10px] truncate block"
              style={{ color: 'var(--sidebar-text-muted)' }}
            >
              {subtitle}
            </span>
          )}
        </div>

        {/* Progress - simplified text */}
        <span
          className="text-[11px] tabular-nums flex-shrink-0"
          style={{ color: isCompleted ? 'var(--color-success)' : 'var(--sidebar-text-muted)' }}
        >
          {masteredChapters}<span style={{ opacity: 0.4 }}>/</span>{totalChapters}
        </span>

        {/* Completed checkmark */}
        {isCompleted && (
          <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
        )}
      </button>

      {/* Menu button - appears on hover */}
      {showMenuButton && (
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={`absolute top-1/2 -translate-y-1/2 right-1.5 p-1 rounded-md transition-all duration-150 ${
            showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          style={{
            backgroundColor: 'var(--sidebar-bg)',
            color: 'var(--sidebar-text-muted)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
            e.currentTarget.style.color = 'var(--sidebar-text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-bg)';
            e.currentTarget.style.color = 'var(--sidebar-text-muted)';
          }}
          title={translate('sidebar_move_course') || 'Déplacer vers...'}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      )}

      {/* Dropdown menu */}
      {showMenu && showMenuButton && (
        <div
          ref={menuRef}
          className="absolute right-0 top-9 z-50 w-40 rounded-lg shadow-lg py-1"
          style={{
            backgroundColor: 'var(--sidebar-bg)',
            border: '1px solid var(--sidebar-border)',
          }}
        >
          {canMove && (
            <>
              <div
                className="px-3 py-2 text-xs font-medium"
                style={{ color: 'var(--sidebar-text-muted)' }}
              >
                <div className="flex items-center gap-1.5">
                  <FolderInput className="w-3.5 h-3.5" />
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
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors duration-150 ${isMoving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
                    <div className="my-1" style={{ borderTop: '1px solid var(--sidebar-border)' }} />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMove(null);
                    }}
                    disabled={isMoving}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors duration-150 ${isMoving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ color: 'var(--sidebar-text-muted)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Inbox className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{translate('sidebar_no_folder') || 'Sans dossier'}</span>
                  </button>
                </>
              )}
            </>
          )}

          {/* Delete option */}
          {onCourseDeleted && (
            <>
              {canMove && (
                <div className="my-1" style={{ borderTop: '1px solid var(--sidebar-border)' }} />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  setShowDeleteDialog(true);
                }}
                className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors duration-150 text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{translate('delete_course_button') || 'Supprimer'}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <DeleteCourseDialog
        courseId={id}
        courseTitle={name}
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onDeleted={() => {
          onCourseDeleted?.();
        }}
      />
    </div>
  );
}
