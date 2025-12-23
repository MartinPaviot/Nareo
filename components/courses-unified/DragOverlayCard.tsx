'use client';

import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Course } from '@/lib/courses/types';
import { getMasteryColor } from '@/lib/courses/utils';

interface DragOverlayCardProps {
  course: Course;
}

export default function DragOverlayCard({ course }: DragOverlayCardProps) {
  const { isDark } = useTheme();
  const masteryColor = getMasteryColor(course.mastery_percentage);

  return (
    <motion.div
      initial={{ scale: 1.05, rotate: 2 }}
      animate={{ scale: 1.05, rotate: 2 }}
      className={`w-80 rounded-xl p-4 border shadow-2xl cursor-grabbing ${
        isDark
          ? 'bg-neutral-900 border-orange-500'
          : 'bg-white border-orange-500'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${masteryColor}20` }}
        >
          <BookOpen className="w-5 h-5" style={{ color: masteryColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium truncate ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
            {course.name}
          </h3>
          <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            {course.total_chapters} chapitres
          </p>
        </div>
      </div>
    </motion.div>
  );
}
