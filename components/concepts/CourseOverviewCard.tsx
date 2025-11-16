'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedChapterTitle } from '@/lib/content-translator';
import { BookOpen, Clock, TrendingUp } from 'lucide-react';

interface Chapter {
  id: string;
  title: string;
  summary: string;
  englishTitle: string;
  englishDescription: string;
  frenchTitle: string;
  frenchDescription: string;
  difficulty: 'easy' | 'medium' | 'hard';
  orderIndex: number;
  questions: any[];
  sourceText: string;
}

interface ChapterProgress {
  chapterId: string;
  score: number;
  currentQuestion: number;
  questionsAnswered: number;
  completed: boolean;
}

interface CourseOverviewCardProps {
  chapter: Chapter;
  progress: ChapterProgress | null | undefined;
  onClick: () => void;
}

export default function CourseOverviewCard({ chapter, progress, onClick }: CourseOverviewCardProps) {
  const { translate, currentLanguage } = useLanguage();

  // Get localized title and description
  const localizedTitle = getLocalizedChapterTitle(chapter, currentLanguage);
  const localizedDescription = currentLanguage === 'fr' 
    ? (chapter.frenchDescription || chapter.summary)
    : (chapter.englishDescription || chapter.summary);

  // Determine status
  const getStatus = () => {
    if (!progress || progress.questionsAnswered === 0) {
      return {
        label: translate('dashboard_course_not_started'),
        color: 'bg-gray-100 text-gray-700',
      };
    }
    if (progress.completed) {
      return {
        label: translate('dashboard_course_completed'),
        color: 'bg-green-100 text-green-700',
      };
    }
    return {
      label: translate('dashboard_course_in_progress'),
      color: 'bg-orange-100 text-orange-700',
    };
  };

  const status = getStatus();

  // Get difficulty badge
  const getDifficultyBadge = () => {
    const badges = {
      easy: { label: translate('chapter_difficulty_easy'), color: 'bg-green-100 text-green-700' },
      medium: { label: translate('chapter_difficulty_medium'), color: 'bg-yellow-100 text-yellow-700' },
      hard: { label: translate('chapter_difficulty_hard'), color: 'bg-red-100 text-red-700' },
    };
    return badges[chapter.difficulty] || badges.medium;
  };

  const difficultyBadge = getDifficultyBadge();

  // Calculate progress percentage
  const progressPercentage = progress ? progress.score : 0;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-200 hover:border-orange-300 hover:shadow-lg transition-all cursor-pointer overflow-hidden group"
    >
      {/* Header with difficulty badge */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors line-clamp-2">
              {localizedTitle}
            </h3>
            <p className="text-sm text-gray-600 line-clamp-3 mb-3">
              {localizedDescription}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${difficultyBadge.color}`}>
            {difficultyBadge.label}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.color}`}>
            {status.label}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
          <div className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />
            <span>{chapter.questions?.length || 0} {translate('dashboard_course_questions')}</span>
          </div>
          {progress && progress.questionsAnswered > 0 && (
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              <span>{progress.score} pts</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {progress && progress.questionsAnswered > 0 && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-600">{translate('sidebar_progress_label')}</span>
              <span className="text-xs font-bold text-gray-900">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-orange-500 to-orange-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <button className="w-full px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 group-hover:scale-105 transition-transform">
          {progress && progress.questionsAnswered > 0 ? (
            <>
              <Clock className="w-4 h-4" />
              {translate('dashboard_course_continue')}
            </>
          ) : (
            <>
              <BookOpen className="w-4 h-4" />
              {translate('dashboard_course_start')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
