'use client';

import { useState } from 'react';
import { FileText, ChevronRight, FolderOutput } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Course } from '@/lib/courses/types';
import DraggableCourseCard from './DraggableCourseCard';

interface UncategorizedSectionProps {
  courses: Course[];
}

export default function UncategorizedSection({ courses }: UncategorizedSectionProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const { isOver, setNodeRef } = useDroppable({
    id: 'uncategorized',
    data: {
      type: 'uncategorized',
    },
  });

  if (courses.length === 0) return null;

  return (
    <section
      ref={setNodeRef}
      className={`rounded-lg border overflow-hidden transition-all ${
        isDark ? 'border-neutral-800' : 'border-gray-100'
      } ${isOver ? 'ring-2 ring-orange-500 ring-offset-2' : ''}`}
    >
      {/* Header - clickable to toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`w-full px-3 py-3 flex items-center gap-2 relative transition-all ${
          isOver
            ? 'bg-orange-500/20'
            : isDark
              ? 'bg-neutral-900 hover:bg-neutral-800'
              : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        {/* Drop indicator overlay */}
        {isOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500 text-white text-xs font-medium shadow-lg">
              <FolderOutput className="w-3.5 h-3.5" />
              {translate('folder_drop_here_uncategorized')}
            </div>
          </div>
        )}
        <motion.div
          animate={{ rotate: isCollapsed ? 0 : 90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
        </motion.div>
        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
          isDark ? 'bg-neutral-800' : 'bg-gray-200'
        }`}>
          <FileText className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
        </div>
        <span className={`text-sm font-medium ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
          {translate('courses_uncategorized')}
        </span>
        <span className={`text-xs px-1.5 py-0 rounded-full ${
          isDark
            ? 'bg-neutral-800 text-neutral-400'
            : 'bg-gray-200 text-gray-600'
        }`}>
          {courses.length} {translate(courses.length === 1 ? 'course_count_singular' : 'courses_count')}
        </span>
      </button>

      {/* Courses grid - collapsible */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`p-3 ${isDark ? 'bg-neutral-950' : 'bg-white'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {courses.map((course) => (
                  <DraggableCourseCard
                    key={course.id}
                    course={course}
                    onClick={() => router.push(`/courses/${course.id}/learn`)}
                    folderId={null}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
