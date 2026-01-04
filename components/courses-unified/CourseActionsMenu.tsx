'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, FolderInput, FolderMinus, Trash2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useCoursesOrganized } from '@/hooks/useCoursesOrganized';
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
  const { folders, moveCourse, refetch } = useCoursesOrganized();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      }, 300); // Small delay to prevent accidental closes
    }
  };

  const handleMoveTo = async (folderId: string | null) => {
    await moveCourse(courseId, folderId);
    setShowMenu(false);
  };

  const availableFolders = folders.filter(f => f.id !== currentFolderId);
  const hasFolders = availableFolders.length > 0 || currentFolderId;

  return (
    <div
      ref={containerRef}
      className="relative"
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Menu button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`p-2 rounded-lg transition-colors ${
          isDark
            ? 'hover:bg-neutral-700 text-neutral-400'
            : 'hover:bg-gray-100 text-gray-400'
        }`}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {showMenu && (
          <>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className={`absolute right-0 top-full mt-1 w-56 rounded-xl shadow-lg border z-50 overflow-hidden max-h-80 overflow-y-auto ${
                isDark
                  ? 'bg-neutral-900 border-neutral-800'
                  : 'bg-white border-gray-200'
              }`}
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

      {/* Delete confirmation dialog */}
      <DeleteCourseDialog
        courseId={courseId}
        courseTitle={courseName}
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onDeleted={() => {
          refetch();
        }}
      />
    </div>
  );
}
