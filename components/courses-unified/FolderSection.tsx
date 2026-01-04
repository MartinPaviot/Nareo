'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Trash2, Upload, Check, X } from 'lucide-react';
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
import DeleteFolderDialog from '@/components/course-management/DeleteFolderDialog';

interface FolderSectionProps {
  folder: Folder;
}

export default function FolderSection({ folder }: FolderSectionProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const { toggleFolderCollapse, updateFolder } = useFoldersManagement();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

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

  const handleDelete = () => {
    setShowDeleteDialog(true);
    setShowMenu(false);
  };

  const handleStartRename = () => {
    setNewName(folder.name);
    setIsRenaming(true);
    setShowMenu(false);
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setNewName(folder.name);
  };

  const handleConfirmRename = async () => {
    if (newName.trim() && newName.trim() !== folder.name) {
      await updateFolder(folder.id, { name: newName.trim() });
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmRename();
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
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
          {isRenaming ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                ref={renameInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                className={`px-2 py-1 rounded-lg border text-sm font-medium ${
                  isDark
                    ? 'bg-neutral-800 border-neutral-600 text-white focus:border-orange-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-orange-500'
                } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
              />
              <button
                onClick={handleConfirmRename}
                className="p-1 rounded-lg bg-green-500/20 text-green-500 hover:bg-green-500/30"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancelRename}
                className={`p-1 rounded-lg ${isDark ? 'hover:bg-neutral-700' : 'hover:bg-gray-200'}`}
              >
                <X className={`w-4 h-4 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
              </button>
            </div>
          ) : (
            <span className={`font-medium ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
              {folder.name}
            </span>
          )}

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
        <div
          className="relative"
          onClick={(e) => e.stopPropagation()}
          onMouseLeave={() => setShowMenu(false)}
        >
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
                  onClick={handleStartRename}
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
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm ${
                    isDark ? 'hover:bg-neutral-800' : 'hover:bg-gray-50'
                  }`}
                  style={{ color: '#d91a1c' }}
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

      {/* Delete Folder Dialog */}
      <DeleteFolderDialog
        folderId={folder.id}
        folderName={folder.name}
        courseCount={folder.course_count}
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
      />
    </section>
  );
}
