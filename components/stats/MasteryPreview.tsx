'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, BookOpen, AlertTriangle } from 'lucide-react';
import { useChapterMastery } from '@/hooks/useChapterMastery';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import MasteryBar from './MasteryBar';

interface MasteryPreviewProps {
  limit?: number;
}

export default function MasteryPreview({ limit = 3 }: MasteryPreviewProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const { courseSummaries, chaptersInDanger, isLoading } = useChapterMastery();
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className={`rounded-2xl border p-5 ${
        isDark ? 'border-neutral-700 bg-neutral-800' : 'border-gray-100 bg-white'
      }`}>
        <div className="animate-pulse">
          <div className={`h-4 rounded w-1/3 mb-4 ${isDark ? 'bg-neutral-700' : 'bg-gray-200'}`} />
          <div className="space-y-3">
            <div className={`h-8 rounded ${isDark ? 'bg-neutral-700' : 'bg-gray-100'}`} />
            <div className={`h-8 rounded ${isDark ? 'bg-neutral-700' : 'bg-gray-100'}`} />
            <div className={`h-8 rounded ${isDark ? 'bg-neutral-700' : 'bg-gray-100'}`} />
          </div>
        </div>
      </div>
    );
  }

  // Get courses to display - show all if expanded, otherwise just the limit
  const visibleCourses = isExpanded ? courseSummaries : courseSummaries.slice(0, limit);
  const hasMoreCourses = courseSummaries.length > limit;

  if (courseSummaries.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`rounded-2xl border p-5 ${
          isDark ? 'border-neutral-700 bg-neutral-800' : 'border-gray-100 bg-white'
        }`}
      >
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{translate('stats_mastery_title')}</h3>
        </div>
        <p className={`text-sm text-center py-4 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
          {translate('stats_mastery_empty')}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={`rounded-2xl border p-5 ${
        isDark ? 'border-neutral-700 bg-neutral-800' : 'border-gray-100 bg-white'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{translate('stats_mastery_title')}</h3>
        </div>
        {hasMoreCourses && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm text-orange-500 hover:text-orange-600 font-medium transition-colors"
          >
            {isExpanded ? translate('stats_mastery_show_less') : translate('stats_mastery_see_all')}
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Warning for chapters in danger */}
      {chaptersInDanger.length > 0 && (
        <div className={`mb-4 p-3 border rounded-xl flex items-start gap-2 ${
          isDark ? 'bg-red-900/30 border-red-800' : 'bg-red-50 border-red-100'
        }`}>
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-700'}`}>
              {translate('stats_mastery_chapters_danger', { count: String(chaptersInDanger.length) })}
            </p>
            <p className={`text-xs ${isDark ? 'text-red-500' : 'text-red-600'}`}>
              {translate('stats_mastery_chapters_danger_hint')}
            </p>
          </div>
        </div>
      )}

      {/* Course list */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {visibleCourses.map((course, index) => (
            <motion.div
              key={course.course_id}
              initial={index >= limit ? { opacity: 0, height: 0 } : false}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, delay: index >= limit ? (index - limit) * 0.05 : 0 }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium truncate max-w-[200px] ${
                  isDark ? 'text-neutral-200' : 'text-gray-700'
                }`}>
                  {course.course_title}
                </span>
                <span className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  {course.mastered_count}/{course.total_chapters} {translate('stats_mastery_mastered')}
                </span>
              </div>
              {course.chapters.slice(0, 2).map((chapter) => (
                <MasteryBar
                  key={chapter.chapter_id}
                  chapterTitle={chapter.chapter_title || 'Chapitre'}
                  masteryLevel={chapter.mastery_level}
                  totalQuestions={chapter.total_questions_answered}
                  correctAnswers={chapter.correct_answers}
                  daysUntilDegradation={chapter.days_until_degradation}
                  compact
                />
              ))}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
