'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Folder } from '@/lib/courses/types';
import { useFoldersManagement } from '@/hooks/useFoldersManagement';
import CourseCard from './CourseCard';
import DraggableCourseCard from './DraggableCourseCard';
import FolderEmptyState from './FolderEmptyState';

interface FolderSectionProps {
  folder: Folder;
}

export default function FolderSection({ folder }: FolderSectionProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const { toggleFolderCollapse, deleteFolder } = useFoldersManagement();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  // Droppable for accepting dragged courses
  const { isOver, setNodeRef } = useDroppable({
    id: `folder-${folder.id}`,
    data: {
      type: 'folder',
      folderId: folder.id,
      folderName: folder.name,
    },
  });

  const handleToggle = async () => {
    setIsCollapsed(!isCollapsed);
    await toggleFolderCollapse(folder.id);
  };

  const handleDelete = async () => {
    if (confirm(translate('folder_delete_confirm'))) {
      await deleteFolder(folder.id, 'uncategorize');
    }
    setShowMenu(false);
  };

  // Get folder icon emoji or use default
  const folderIcon = folder.icon || '📁';

  return (
    <section
      ref={setNodeRef}
      className={`rounded-2xl border transition-all ${
        isDark ? 'border-neutral-800' : 'border-gray-100'
      } ${isOver ? 'ring-2 ring-orange-500 ring-offset-2' : ''}`}
    >
      {/* Folder header */}
      <div
        onClick={handleToggle}
        className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
          isDark
            ? 'bg-neutral-900 hover:bg-neutral-800'
            : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Chevron */}
          <motion.div
            animate={{ rotate: isCollapsed ? 0 : 90 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
          </motion.div>

          {/* Icon with color */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
            style={{ backgroundColor: `${folder.color}20` }}
          >
            {folderIcon}
          </div>

          {/* Folder name */}
          <span className={`font-medium ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
            {folder.name}
          </span>

          {/* Course count badge */}
          <span className={`text-sm px-2 py-0.5 rounded-full ${
            isDark
              ? 'bg-neutral-800 text-neutral-400'
              : 'bg-gray-200 text-gray-600'
          }`}>
            {folder.course_count} {folder.course_count === 1 ? translate('course_count_singular') : translate('courses_count_label')}
          </span>
        </div>

        {/* Actions menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-neutral-700' : 'hover:bg-gray-200'
            }`}
          >
            <MoreHorizontal className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
          </button>

          {/* Dropdown menu */}
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`absolute right-0 top-full mt-1 w-48 rounded-xl shadow-lg border z-10 ${
                  isDark
                    ? 'bg-neutral-900 border-neutral-800'
                    : 'bg-white border-gray-200'
                }`}
              >
                <button
                  onClick={() => {
                    // TODO: Open rename modal
                    setShowMenu(false);
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm ${
                    isDark
                      ? 'hover:bg-neutral-800 text-neutral-200'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <Pencil className="w-4 h-4" />
                  {translate('folder_rename')}
                </button>
                <button
                  onClick={handleDelete}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-red-500 ${
                    isDark ? 'hover:bg-neutral-800' : 'hover:bg-gray-50'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  {translate('folder_delete')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Folder content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`overflow-hidden ${isDark ? 'bg-neutral-950' : 'bg-white'}`}
          >
            <div className="p-4">
              {folder.courses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {folder.courses.map((course) => (
                    <DraggableCourseCard
                      key={course.id}
                      course={course}
                      folderId={folder.id}
                      onClick={() => router.push(`/courses/${course.id}/learn`)}
                    />
                  ))}
                </div>
              ) : (
                <FolderEmptyState folderId={folder.id} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
