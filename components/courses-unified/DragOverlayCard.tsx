'use client';

import { motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Course } from '@/lib/courses/types';
import { getMasteryColor } from '@/lib/courses/utils';

interface DragOverlayCardProps {
  course: Course;
}

export default function DragOverlayCard({ course }: DragOverlayCardProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const masteryColor = getMasteryColor(course.mastery_percentage);
  const masteryPercentage = Math.round(course.mastery_percentage);

  return (
    <motion.div
      initial={{ scale: 1, opacity: 0.9, rotate: 0 }}
      animate={{ scale: 1.02, opacity: 1, rotate: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`w-56 rounded-lg px-2.5 py-2 border-2 shadow-xl cursor-grabbing ${
        isDark
          ? 'bg-neutral-900/95 border-orange-500'
          : 'bg-white/95 border-orange-500'
      }`}
      style={{ backdropFilter: 'blur(4px)' }}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className={`text-xs font-medium truncate ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
            {course.name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              {course.total_chapters} {translate('courses_chapters_label')}
            </span>
            <div className="flex items-center gap-1">
              <div className={`w-12 h-1 rounded-full overflow-hidden ${isDark ? 'bg-neutral-700' : 'bg-gray-200'}`}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${masteryPercentage}%`, backgroundColor: masteryColor }}
                />
              </div>
              <span className={`text-[9px] ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                {masteryPercentage}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
