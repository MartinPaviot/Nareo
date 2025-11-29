'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Award, ArrowLeft, RotateCcw, Trophy, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useGamification } from '@/hooks/useGamification';
import Mascot from '@/components/gamification/Mascot';
import { trackEvent } from '@/lib/posthog';

interface BadgeEarned {
  id: string;
  badge: {
    code: string;
    name_fr: string;
    name_en: string;
    name_de: string;
    icon: string | null;
    rarity: string;
  };
}

export default function QuizResultsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { translate, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const { recordActivity } = useGamification();

  const [newBadges, setNewBadges] = useState<BadgeEarned[]>([]);
  const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);

  const courseId = params?.courseId as string;
  const chapterId = params?.chapterId as string;

  const score = parseInt(searchParams?.get('score') || '0');
  const total = parseInt(searchParams?.get('total') || '0');
  const correct = parseInt(searchParams?.get('correct') || '0');
  const totalQuestions = parseInt(searchParams?.get('totalQuestions') || '0');

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const isPerfectScore = percentage === 100;

  // Record activity and check for new badges
  useEffect(() => {
    const recordQuizCompletion = async () => {
      if (!user) return;

      const badges = await recordActivity({
        quizzes_completed: 1,
        questions_answered: totalQuestions,
        questions_correct: correct,
        points_earned: score,
      });

      if (badges.length > 0) {
        setNewBadges(badges);
        setShowBadgeCelebration(true);
      }
    };

    recordQuizCompletion();
    trackEvent('quiz_results_viewed', {
      userId: user?.id,
      courseId,
      chapterId,
      score,
      total,
      percentage,
    });
  }, [user?.id, courseId, chapterId, score, total, percentage, correct, totalQuestions, recordActivity, user]);

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

  const getBadgeName = (badge: BadgeEarned['badge']) => {
    if (currentLanguage === 'fr') return badge.name_fr;
    if (currentLanguage === 'de') return badge.name_de;
    return badge.name_en;
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-purple-500 to-pink-500';
      case 'epic': return 'from-purple-400 to-indigo-400';
      case 'rare': return 'from-blue-400 to-cyan-400';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Badge Celebration Modal */}
        {showBadgeCelebration && newBadges.length > 0 && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6 animate-in zoom-in duration-300">
              <div className="flex justify-center">
                <Sparkles className="w-20 h-20 text-yellow-500 animate-pulse" />
              </div>

              <h2 className="text-3xl font-bold text-gray-900">
                {translate('mascot_new_badge')}
              </h2>

              <div className="space-y-4">
                {newBadges.map((badgeEarned) => (
                  <div
                    key={badgeEarned.id}
                    className={`bg-gradient-to-br ${getRarityColor(badgeEarned.badge.rarity)} rounded-2xl p-6 text-white shadow-lg`}
                  >
                    <div className="text-6xl mb-3">{badgeEarned.badge.icon || '🏆'}</div>
                    <h3 className="text-xl font-bold">{getBadgeName(badgeEarned.badge)}</h3>
                    <p className="text-sm opacity-90 mt-1 capitalize">{badgeEarned.badge.rarity}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowBadgeCelebration(false)}
                className="w-full px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                {translate('close')}
              </button>
            </div>
          </div>
        )}

        {/* Header Card with Mascot */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-lg text-center space-y-4">
          <div className="flex justify-center">
            {isPerfectScore ? (
              <Mascot
                mood="celebrating"
                context="perfect_score"
                size="large"
                animated={true}
              />
            ) : percentage >= 75 ? (
              <Mascot
                mood="celebrating"
                context="quiz_complete"
                size="large"
                animated={true}
              />
            ) : (
              <div className="flex justify-center">
                {getPerformanceIcon()}
              </div>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {translate('results_title')}
          </h1>

          <p className={`text-xl font-semibold ${getPerformanceColor()}`}>
            {getPerformanceMessage()}
          </p>

          {isPerfectScore && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full">
              <Trophy className="w-5 h-5" />
              <span className="font-semibold">Score Parfait ! 🎉</span>
            </div>
          )}
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
