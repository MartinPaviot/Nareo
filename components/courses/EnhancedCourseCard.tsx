'use client';

import { useRouter } from 'next/navigation';
import { BookOpen, CheckCircle2, Clock, Lock, Play, Trophy } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface EnhancedCourseCardProps {
  course: {
    id: string;
    title: string;
    status: string;
    chapter_count: number;
    completed_chapters: number;
    in_progress_chapters: number;
    user_score: number;
    created_at: string;
  };
  hideStatusBadge?: boolean;
}

/**
 * Enhanced Course Card with visual progress indicators
 * Shows completion status, score, and motivational elements
 */
export default function EnhancedCourseCard({ course, hideStatusBadge = false }: EnhancedCourseCardProps) {
  const router = useRouter();
  const { translate } = useLanguage();
  const { isDark } = useTheme();

  const progressPercentage = course.chapter_count > 0
    ? Math.round((course.completed_chapters / course.chapter_count) * 100)
    : 0;

  const isProcessing = course.status === 'pending' || course.status === 'processing';
  const isFailed = course.status === 'failed';
  const isReady = course.status === 'ready';

  const getProgressColor = () => {
    if (progressPercentage === 100) return 'bg-green-500';
    if (progressPercentage >= 50) return 'bg-orange-500';
    return 'bg-orange-400';
  };

  const getStatusBadge = () => {
    if (isFailed) {
      return (
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
          isDark ? 'bg-red-950/50 text-red-400' : 'bg-red-100 text-red-700'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          {translate('course_status_failed')}
        </div>
      );
    }

    if (isProcessing) {
      return (
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
          isDark ? 'bg-yellow-950/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
          {translate('course_status_preparing')}
        </div>
      );
    }

    if (progressPercentage === 100) {
      return (
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
          isDark ? 'bg-green-950/50 text-green-400' : 'bg-green-100 text-green-700'
        }`}>
          <CheckCircle2 className="w-3 h-3" />
          {translate('course_status_completed')}
        </div>
      );
    }

    if (course.in_progress_chapters > 0) {
      return (
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
          isDark ? 'bg-orange-950/50 text-orange-400' : 'bg-orange-100 text-orange-700'
        }`}>
          <Clock className="w-3 h-3" />
          {translate('course_status_in_progress')}
        </div>
      );
    }

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
        isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-gray-100 text-gray-700'
      }`}>
        <Play className="w-3 h-3" />
        {translate('course_status_ready')}
      </div>
    );
  };

  return (
    <button
      onClick={() => router.push(`/courses/${course.id}/learn`)}
      disabled={isFailed}
      className={`group text-left rounded-3xl border-2 transition-all p-5 flex flex-col gap-4 w-full ${
        isDark
          ? 'bg-neutral-900 border-neutral-700 hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/10'
          : 'bg-white border-gray-200 hover:border-orange-400 hover:shadow-xl'
      } ${isFailed ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 pr-10">
          <h3 className={`text-base font-bold line-clamp-1 mb-2 group-hover:text-orange-500 transition-colors ${
            isDark ? 'text-neutral-100' : 'text-gray-900'
          }`}>
            {course.title}
          </h3>
          <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
            {translate('course_card_last_updated')}: {new Date(course.created_at).toLocaleDateString()}
          </p>
        </div>
        {!hideStatusBadge && getStatusBadge()}
      </div>

      {/* Progress Section */}
      {isReady && course.chapter_count > 0 && (
        <div className="space-y-3">
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className={`font-medium ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                {translate('course_card_progress')}
              </span>
              <span className={`font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>{progressPercentage}%</span>
            </div>
            <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-100'}`}>
              <div
                className={`h-full ${getProgressColor()} transition-all duration-500 rounded-full`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Total Chapters */}
            <div className={`rounded-xl p-2.5 text-center ${isDark ? 'bg-neutral-800' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <BookOpen className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`} />
                <span className={`text-lg font-bold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>{course.chapter_count}</span>
              </div>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>{translate('course_card_chapters')}</p>
            </div>

            {/* Completed */}
            <div className={`rounded-xl p-2.5 text-center ${isDark ? 'bg-green-950/40' : 'bg-green-50'}`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle2 className={`w-3.5 h-3.5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                <span className={`text-lg font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>{course.completed_chapters}</span>
              </div>
              <p className={`text-xs ${isDark ? 'text-green-400' : 'text-green-700'}`}>{translate('course_card_completed')}</p>
            </div>

            {/* Score */}
            <div className={`rounded-xl p-2.5 text-center ${isDark ? 'bg-purple-950/40' : 'bg-purple-50'}`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Trophy className={`w-3.5 h-3.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                <span className={`text-lg font-bold ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>{course.user_score || 0}</span>
              </div>
              <p className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>{translate('learn_pts')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className={`flex items-center gap-2 text-sm rounded-xl p-3 ${
          isDark
            ? 'text-neutral-300 bg-yellow-950/30'
            : 'text-gray-600 bg-yellow-50'
        }`}>
          <Lock className={`w-4 h-4 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
          <span>{translate('course_card_processing_message')}</span>
        </div>
      )}

      {/* CTA */}
      {isReady && (
        <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-neutral-700' : 'border-gray-100'}`}>
          <span className={`text-sm font-semibold ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
            {progressPercentage === 100
              ? translate('course_card_review')
              : course.in_progress_chapters > 0
              ? translate('course_card_continue')
              : translate('course_card_start')}
          </span>
          <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center group-hover:bg-orange-600 transition-colors">
            <Play className="w-4 h-4 ml-0.5" />
          </div>
        </div>
      )}
    </button>
  );
}
