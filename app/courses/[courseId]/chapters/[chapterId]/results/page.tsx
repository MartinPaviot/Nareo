'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Award, ArrowLeft, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { trackEvent } from '@/lib/posthog';

export default function QuizResultsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { translate } = useLanguage();
  const { user } = useAuth();

  const courseId = params?.courseId as string;
  const chapterId = params?.chapterId as string;

  const score = parseInt(searchParams?.get('score') || '0');
  const total = parseInt(searchParams?.get('total') || '0');
  const correct = parseInt(searchParams?.get('correct') || '0');
  const totalQuestions = parseInt(searchParams?.get('totalQuestions') || '0');

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  useEffect(() => {
    trackEvent('quiz_results_viewed', {
      userId: user?.id,
      courseId,
      chapterId,
      score,
      total,
      percentage,
    });
  }, [user?.id, courseId, chapterId, score, total, percentage]);

  const getPerformanceMessage = () => {
    if (percentage >= 90) return translate('results_excellent');
    if (percentage >= 75) return translate('results_great');
    if (percentage >= 60) return translate('results_good');
    if (percentage >= 50) return translate('results_pass');
    return translate('results_retry');
  };

  const getPerformanceColor = () => {
    if (percentage >= 75) return 'text-green-600';
    if (percentage >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getPerformanceIcon = () => {
    if (percentage >= 75) return <Award className="w-16 h-16 text-green-500" />;
    if (percentage >= 50) return <CheckCircle2 className="w-16 h-16 text-orange-500" />;
    return <XCircle className="w-16 h-16 text-red-500" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-lg text-center space-y-4">
          <div className="flex justify-center">
            {getPerformanceIcon()}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {translate('results_title')}
          </h1>

          <p className={`text-xl font-semibold ${getPerformanceColor()}`}>
            {getPerformanceMessage()}
          </p>
        </div>

        {/* Score Card */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-lg space-y-6">
          <div className="text-center">
            <div className="inline-flex items-baseline gap-2">
              <span className="text-5xl sm:text-6xl font-bold text-orange-600">
                {percentage}
              </span>
              <span className="text-3xl font-semibold text-gray-400">%</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-orange-50 rounded-2xl p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">{translate('results_score')}</p>
              <p className="text-2xl font-bold text-orange-600">
                {score} / {total}
              </p>
              <p className="text-xs text-gray-500">{translate('learn_pts')}</p>
            </div>

            <div className="bg-green-50 rounded-2xl p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">{translate('results_correct')}</p>
              <p className="text-2xl font-bold text-green-600">
                {correct} / {totalQuestions}
              </p>
              <p className="text-xs text-gray-500">{translate('results_questions')}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>{translate('results_progress')}</span>
              <span className="font-semibold">{percentage}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${
                  percentage >= 75 ? 'bg-green-500' : percentage >= 50 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => router.push(`/courses/${courseId}/learn`)}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 shadow-md"
          >
            <ArrowLeft className="w-5 h-5" />
            {translate('results_back_to_course')}
          </button>

          <button
            onClick={() => router.push(`/courses/${courseId}/chapters/${chapterId}`)}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl border-2 border-orange-200 text-orange-700 font-semibold bg-white hover:bg-orange-50"
          >
            <RotateCcw className="w-5 h-5" />
            {translate('results_retry')}
          </button>
        </div>
      </div>
    </div>
  );
}
