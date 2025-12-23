'use client';

import { motion } from 'framer-motion';
import { ArrowRight, X, Clock, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { PriorityItem } from '@/lib/courses/types';
import { usePriorityItems } from '@/hooks/usePriorityItems';

interface PriorityCardProps {
  item: PriorityItem;
}

export default function PriorityCard({ item }: PriorityCardProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { dismissItem } = usePriorityItems();

  const handleStart = () => {
    if (item.item_type === 'chapter') {
      router.push(`/courses/${item.course_id}/learn`);
    } else {
      router.push(`/courses/${item.course_id}/learn`);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissItem(item.id);
  };

  // Determine icon based on reason
  const ReasonIcon = item.reason?.includes('regress') ? AlertTriangle : Clock;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={handleStart}
      className={`rounded-xl p-4 border cursor-pointer transition-shadow relative group ${
        isDark
          ? 'bg-neutral-900 border-orange-900/50 hover:shadow-lg hover:shadow-orange-900/20'
          : 'bg-white border-orange-200 hover:shadow-md'
      }`}
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className={`absolute top-2 right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all ${
          isDark ? 'hover:bg-neutral-800' : 'hover:bg-gray-100'
        }`}
      >
        <X className={`w-4 h-4 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
      </button>

      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {/* Chapter/course name */}
          <h3 className={`font-medium truncate ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
            {item.chapter_name || item.course_name}
          </h3>

          {/* Reason */}
          <div className="flex items-center gap-1.5 mt-1">
            <ReasonIcon className={`w-3.5 h-3.5 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} />
            <span className={`text-sm ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
              {item.reason}
            </span>
          </div>

          {/* Parent course if it's a chapter */}
          {item.chapter_name && item.course_name && (
            <p className={`text-xs mt-1 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
              {item.course_name}
            </p>
          )}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-2 ml-4">
          <span className={`text-sm font-medium ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
            Réviser
          </span>
          <div className="p-2 bg-orange-500 rounded-full">
            <ArrowRight className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
