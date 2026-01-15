'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, FolderInput, FolderMinus, Trash2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useCoursesOrganized } from '@/hooks/useCoursesOrganized';
import { useCoursesRefresh } from '@/contexts/CoursesRefreshContext';
import { useLanguage } from '@/contexts/LanguageContext';
import DeleteCourseDialog from '@/components/course-management/DeleteCourseDialog';

interface CourseActionsMenuProps {
  courseId: string;
  courseName: string;
  currentFolderId?: string | null;
}

export default function CourseActionsMenu({
  courseId,
  courseName,
  currentFolderId,
}: CourseActionsMenuProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const { folders, moveCourse } = useCoursesOrganized();
  const { removeCourse } = useCoursesRefresh();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update menu position after it renders (using real dimensions)
  // useLayoutEffect runs synchronously before paint, preventing flash
  useLayoutEffect(() => {
    if (showMenu && buttonRef.current && menuRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      const padding = 8;

      const menuHeight = menuRect.height;
      const menuWidth = menuRect.width;

      // Check if menu would overflow bottom of viewport
      const spaceBelow = window.innerHeight - buttonRect.bottom - padding;
      const spaceAbove = buttonRect.top - padding;

      let top: number;
      if (spaceBelow >= menuHeight) {
        // Enough space below - show menu below button
        top = buttonRect.bottom + 4;
      } else if (spaceAbove >= menuHeight) {
        // Not enough space below, but enough above - show menu above button
        top = buttonRect.top - menuHeight - 4;
      } else {
        // Not enough space either way - position to fit in viewport
        top = Math.max(padding, window.innerHeight - menuHeight - padding);
      }

      // Check horizontal overflow
      let left = buttonRect.right - menuWidth;
      if (left < padding) {
        left = padding;
      }
      if (left + menuWidth > window.innerWidth - padding) {
        left = window.innerWidth - menuWidth - padding;
      }

      menuRef.current.style.top = `${top}px`;
      menuRef.current.style.left = `${left}px`;
      menuRef.current.style.visibility = 'visible';
    }
  }, [showMenu]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (showMenu) {
      closeTimeoutRef.current = setTimeout(() => {
        setShowMenu(false);
      }, 300);
    }
  };

  const handleMoveTo = async (folderId: string | null) => {
    await moveCourse(courseId, folderId);
    setShowMenu(false);
  };

  const availableFolders = folders.filter(f => f.id !== currentFolderId);

  const menuContent = (
    <AnimatePresence>
      {showMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowMenu(false)}
          />
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`fixed w-56 rounded-xl shadow-lg border z-[9999] overflow-hidden max-h-80 overflow-y-auto ${
              isDark
                ? 'bg-neutral-900 border-neutral-800'
                : 'bg-white border-gray-200'
            }`}
            style={{
              top: 0,
              left: 0,
              visibility: 'hidden',
            }}
          >
            {/* Header */}
            <div className={`px-4 py-2 border-b ${
              isDark ? 'border-neutral-800' : 'border-gray-100'
            }`}>
              <div className="flex items-center gap-2">
                <FolderInput className={`w-4 h-4 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
                <span className={`text-xs font-medium uppercase tracking-wide ${
                  isDark ? 'text-neutral-500' : 'text-gray-500'
                }`}>
                  Déplacer vers
                </span>
              </div>
            </div>

            {/* Remove from folder option if in a folder */}
            {currentFolderId && (
              <button
                onClick={() => handleMoveTo(null)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm ${
                  isDark
                    ? 'hover:bg-neutral-800 text-orange-400'
                    : 'hover:bg-orange-50 text-orange-600'
                }`}
              >
                <FolderMinus className="w-4 h-4" />
                <span className="font-medium">Retirer du dossier</span>
              </button>
            )}

            {/* Divider if both remove option and folders exist */}
            {currentFolderId && availableFolders.length > 0 && (
              <div className={`h-px ${isDark ? 'bg-neutral-800' : 'bg-gray-100'}`} />
            )}

            {/* Folder options */}
            {availableFolders.length > 0 ? (
              availableFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleMoveTo(folder.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm ${
                    isDark
                      ? 'hover:bg-neutral-800 text-neutral-200'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-xs"
                    style={{ backgroundColor: `${folder.color}30` }}
                  >
                    {folder.icon || '📁'}
                  </div>
                  <span className="truncate">{folder.name}</span>
                </button>
              ))
            ) : !currentFolderId ? (
              <div className={`px-4 py-3 text-sm ${
                isDark ? 'text-neutral-500' : 'text-gray-400'
              }`}>
                Aucun dossier disponible
              </div>
            ) : null}

            {/* Divider before delete */}
            <div className={`h-px ${isDark ? 'bg-neutral-800' : 'bg-gray-100'}`} />

            {/* Delete option */}
            <button
              onClick={() => {
                setShowMenu(false);
                setShowDeleteDialog(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors"
              style={{ color: '#d91a1c' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(217, 26, 28, 0.1)' : '#fff6f3'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Trash2 className="w-4 h-4" />
              <span className="font-medium">{translate('delete_course_button') || 'Supprimer'}</span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div
      className="relative"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Menu button */}
      <button
        ref={buttonRef}
        onClick={() => setShowMenu(!showMenu)}
        className={`p-2 rounded-lg transition-colors ${
          isDark
            ? 'hover:bg-neutral-700 text-neutral-400'
            : 'hover:bg-gray-100 text-gray-400'
        }`}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {/* Dropdown menu - rendered via portal */}
      {mounted && createPortal(menuContent, document.body)}

      {/* Delete confirmation dialog */}
      <DeleteCourseDialog
        courseId={courseId}
        courseTitle={courseName}
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onDeleted={() => {
          removeCourse(courseId);
        }}
      />
    </div>
  );
}
