'use client';

import { motion } from 'framer-motion';
import { ChevronRight, BookOpen, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChapterMastery } from '@/hooks/useChapterMastery';
import MasteryBar from './MasteryBar';

interface MasteryPreviewProps {
  limit?: number;
}

export default function MasteryPreview({ limit = 3 }: MasteryPreviewProps) {
  const router = useRouter();
  const { courseSummaries, chaptersInDanger, isLoading } = useChapterMastery();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            <div className="h-8 bg-gray-100 rounded" />
            <div className="h-8 bg-gray-100 rounded" />
            <div className="h-8 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Get top courses by mastery
  const topCourses = courseSummaries.slice(0, limit);

  if (topCourses.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-gray-100 bg-white p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Maîtrise des cours</h3>
        </div>
        <p className="text-sm text-gray-500 text-center py-4">
          Commence à réviser pour voir ta progression !
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-gray-100 bg-white p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Maîtrise des cours</h3>
        </div>
        <button
          onClick={() => router.push('/mastery')}
          className="flex items-center gap-1 text-sm text-orange-500 hover:text-orange-600 font-medium"
        >
          Voir tout
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Warning for chapters in danger */}
      {chaptersInDanger.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">
              {chaptersInDanger.length} chapitre{chaptersInDanger.length > 1 ? 's' : ''} en danger
            </p>
            <p className="text-xs text-red-600">
              Révise-les pour éviter la régression !
            </p>
          </div>
        </div>
      )}

      {/* Course list */}
      <div className="space-y-1">
        {topCourses.map((course) => (
          <div key={course.course_id}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
                {course.course_title}
              </span>
              <span className="text-xs text-gray-500">
                {course.mastered_count}/{course.total_chapters} maîtrisés
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
          </div>
        ))}
      </div>
    </motion.div>
  );
}
