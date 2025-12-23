'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Layers, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCoursesOrganized } from '@/hooks/useCoursesOrganized';
import { getMasteryColor } from '@/lib/courses/utils';
import type { Course, Folder } from '@/lib/courses/types';

interface CourseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentCourseId?: string;
}

function CourseItem({
  course,
  isCurrentCourse,
  onClick
}: {
  course: Course;
  isCurrentCourse: boolean;
  onClick: () => void;
}) {
  const { isDark } = useTheme();
  const masteryColor = getMasteryColor(course.mastery_percentage);
  const masteryPercentage = Math.round(course.mastery_percentage);

  return (
    <button
      onClick={onClick}
      disabled={isCurrentCourse}
      className={`w-full text-left p-3 rounded-xl transition-all ${
        isCurrentCourse
          ? isDark
            ? 'bg-orange-500/20 border border-orange-500/30 cursor-default'
            : 'bg-orange-50 border border-orange-200 cursor-default'
          : isDark
            ? 'hover:bg-neutral-800 active:bg-neutral-750'
            : 'hover:bg-gray-50 active:bg-gray-100'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate text-sm ${
            isCurrentCourse
              ? 'text-orange-500'
              : isDark ? 'text-neutral-100' : 'text-gray-900'
          }`}>
            {course.name}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              {course.mastered_chapters}/{course.total_chapters} ch.
            </span>
            {course.cards_to_review > 0 && (
              <span className="flex items-center gap-1 text-xs text-purple-500">
                <Layers className="w-3 h-3" />
                {course.cards_to_review}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mini progress bar */}
          <div className={`w-12 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-neutral-700' : 'bg-gray-200'}`}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${masteryPercentage}%`,
                backgroundColor: masteryColor
              }}
            />
          </div>
          {!isCurrentCourse && (
            <ChevronRight className={`w-4 h-4 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
          )}
        </div>
      </div>
    </button>
  );
}

function FolderSection({
  folder,
  currentCourseId,
  onCourseClick
}: {
  folder: Folder;
  currentCourseId?: string;
  onCourseClick: (courseId: string) => void;
}) {
  const { isDark } = useTheme();

  if (folder.courses.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-1 mb-2">
        <div
          className="w-5 h-5 rounded flex items-center justify-center text-xs"
          style={{ backgroundColor: `${folder.color}30` }}
        >
          {folder.icon || '📁'}
        </div>
        <span className={`text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
          {folder.name}
        </span>
      </div>
      <div className="space-y-1">
        {folder.courses.map((course) => (
          <CourseItem
            key={course.id}
            course={course}
            isCurrentCourse={course.id === currentCourseId}
            onClick={() => onCourseClick(course.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default function CourseDrawer({ isOpen, onClose, currentCourseId }: CourseDrawerProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const { folders, uncategorized, isLoading } = useCoursesOrganized();

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleCourseClick = useCallback((courseId: string) => {
    if (courseId !== currentCourseId) {
      router.push(`/courses/${courseId}/learn`);
      onClose();
    }
  }, [currentCourseId, router, onClose]);

  const allCourses = [
    ...folders.flatMap(f => f.courses),
    ...uncategorized
  ];

  const hasNoCourses = allCourses.length === 0 && !isLoading;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`fixed top-0 right-0 h-full w-full max-w-sm z-[61] shadow-2xl ${
              isDark ? 'bg-neutral-900' : 'bg-white'
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-4 border-b ${
              isDark ? 'border-neutral-800' : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-2">
                <BookOpen className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} />
                <h2 className={`font-semibold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
                  {translate('drawer_my_courses')}
                </h2>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-xl transition-colors ${
                  isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 h-[calc(100%-65px)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
                </div>
              ) : hasNoCourses ? (
                <div className={`text-center py-12 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">{translate('drawer_no_courses')}</p>
                </div>
              ) : (
                <>
                  {/* Folders with courses */}
                  {folders.map((folder) => (
                    <FolderSection
                      key={folder.id}
                      folder={folder}
                      currentCourseId={currentCourseId}
                      onCourseClick={handleCourseClick}
                    />
                  ))}

                  {/* Uncategorized courses */}
                  {uncategorized.length > 0 && (
                    <div>
                      {folders.length > 0 && (
                        <p className={`text-xs font-medium px-1 mb-2 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                          {translate('drawer_other_courses')}
                        </p>
                      )}
                      <div className="space-y-1">
                        {uncategorized.map((course) => (
                          <CourseItem
                            key={course.id}
                            course={course}
                            isCurrentCourse={course.id === currentCourseId}
                            onClick={() => handleCourseClick(course.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
