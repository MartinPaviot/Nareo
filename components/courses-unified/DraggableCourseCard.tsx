'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Course } from '@/lib/courses/types';
import CourseCard from './CourseCard';

interface DraggableCourseCardProps {
  course: Course;
  onClick: () => void;
  folderId?: string | null;
}

export default function DraggableCourseCard({ course, onClick, folderId }: DraggableCourseCardProps) {
  const { isDark } = useTheme();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: course.id,
    data: {
      type: 'course',
      course,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-lg cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity ${
          isDark
            ? 'bg-neutral-800 hover:bg-neutral-700'
            : 'bg-gray-100 hover:bg-gray-200'
        }`}
      >
        <GripVertical className={`w-4 h-4 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
      </div>

      {/* Course card */}
      <div className={isDragging ? 'pointer-events-none' : ''}>
        <CourseCard course={course} onClick={onClick} folderId={folderId} />
      </div>
    </div>
  );
}
