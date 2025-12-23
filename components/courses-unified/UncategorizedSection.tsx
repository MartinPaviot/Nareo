'use client';

import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDroppable } from '@dnd-kit/core';
import { useTheme } from '@/contexts/ThemeContext';
import { Course } from '@/lib/courses/types';
import DraggableCourseCard from './DraggableCourseCard';

interface UncategorizedSectionProps {
  courses: Course[];
}

export default function UncategorizedSection({ courses }: UncategorizedSectionProps) {
  const router = useRouter();
  const { isDark } = useTheme();

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
      className={`rounded-2xl border overflow-hidden transition-all ${
        isDark ? 'border-neutral-800' : 'border-gray-100'
      } ${isOver ? 'ring-2 ring-orange-500 ring-offset-2' : ''}`}
    >
      {/* Header */}
      <div className={`p-4 flex items-center gap-3 ${
        isDark ? 'bg-neutral-900' : 'bg-gray-50'
      }`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          isDark ? 'bg-neutral-800' : 'bg-gray-200'
        }`}>
          <FileText className={`w-4 h-4 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
        </div>
        <span className={`font-medium ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
          Non classés
        </span>
        <span className={`text-sm px-2 py-0.5 rounded-full ${
          isDark
            ? 'bg-neutral-800 text-neutral-400'
            : 'bg-gray-200 text-gray-600'
        }`}>
          {courses.length} cours
        </span>
      </div>

      {/* Courses grid */}
      <div className={`p-4 ${isDark ? 'bg-neutral-950' : 'bg-white'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </section>
  );
}
