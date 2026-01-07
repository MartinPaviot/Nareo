'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { SessionStats, getMasteredCount, getDifficultCount, getSessionDuration } from '@/lib/spaced-repetition';
import { RotateCcw, Check, Calendar, Clock, Star, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

interface SessionRecapProps {
  stats: SessionStats;
  onRetryDifficult?: () => void;
  onFinish: () => void;
  nextReviewInfo?: {
    date: string;
    count: number;
  };
}

// Color schemes based on mastery percentage - Orange theme like quiz
const getScoreColors = (percentage: number, isDark: boolean) => {
  if (percentage < 40) {
    // Low score - still orange but darker shade
    return isDark
      ? { primary: '#F97316', secondary: '#7c2d12', bg: 'rgba(249, 115, 22, 0.1)' }
      : { primary: '#F97316', secondary: '#FED7AA', bg: '#FFF7ED' };
  } else if (percentage <= 70) {
    // Medium score - orange (changed from yellow)
    return isDark
      ? { primary: '#F97316', secondary: '#7c2d12', bg: 'rgba(249, 115, 22, 0.1)' }
      : { primary: '#F97316', secondary: '#FED7AA', bg: '#FFF7ED' };
  } else {
    // High score - green
    return isDark
      ? { primary: '#379f5a', secondary: '#14532d', bg: 'rgba(55, 159, 90, 0.1)' }
      : { primary: '#379f5a', secondary: '#b8dfc6', bg: '#edf7f1' };
  }
};

// Star calculation
const getStars = (percentage: number): number => {
  if (percentage >= 80) return 3;
  if (percentage >= 50) return 2;
  if (percentage >= 20) return 1;
  return 0;
};

// Circular Progress Component
const CircularProgress = ({
  percentage,
  masteredCount,
  total,
  colors,
}: {
  percentage: number;
  masteredCount: number;
  total: number;
  colors: { primary: string; secondary: string; bg: string };
}) => {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="relative w-28 h-28 mx-auto">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={colors.secondary}
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={colors.primary}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: colors.primary }}>
          {Math.round(animatedPercentage)}%
        </span>
        <span className="text-xs text-gray-500">
          {masteredCount}/{total}
        </span>
      </div>
    </div>
  );
};

// Star Rating Component
const StarRating = ({ earnedStars }: { earnedStars: number }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex justify-center gap-1 mt-2">
      {[1, 2, 3].map((star) => {
        const isEarned = star <= earnedStars;
        return (
          <Star
            key={star}
            className={`w-6 h-6 transition-all duration-500 ${
              visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
            } ${isEarned ? '' : 'opacity-30 scale-75'}`}
            style={{
              transitionDelay: `${star * 150}ms`,
              fill: isEarned ? '#FBBF24' : '#D1D5DB',
              color: isEarned ? '#FBBF24' : '#D1D5DB'
            }}
          />
        );
      })}
    </div>
  );
};

export default function SessionRecap({
  stats,
  onRetryDifficult,
  onFinish,
  nextReviewInfo,
}: SessionRecapProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  const masteredCount = getMasteredCount(stats);
  const difficultCount = getDifficultCount(stats);
  const duration = getSessionDuration(stats);
  const masteryPercentage = stats.total > 0 ? Math.round((masteredCount / stats.total) * 100) : 0;
  const colors = getScoreColors(masteryPercentage, isDark);
  const earnedStars = getStars(masteryPercentage);

  // Format duration
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // Get encouragement message based on performance
  const getEncouragementMessage = (): string => {
    if (masteryPercentage >= 90) return translate('flashcard_session_excellent') || 'Excellent travail !';
    if (masteryPercentage >= 70) return translate('flashcard_session_good') || 'Bien joué !';
    if (masteryPercentage >= 50) return translate('flashcard_session_keep_going') || 'Continue comme ça !';
    return translate('flashcard_session_practice_more') || 'La pratique rend parfait !';
  };

  // Get mascot image based on score
  const getMascotImage = () => {
    if (masteryPercentage < 40) return '/chat/Disappointed.png';
    if (masteryPercentage < 70) return '/chat/Drag_and_Drop.png';
    return '/chat/Happy.png';
  };

  return (
    <div className={`p-4 sm:p-6 space-y-4 rounded-2xl ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
      {/* Score Card */}
      <div className={`rounded-2xl border p-4 ${
        isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
      }`}>
        <h1 className={`text-lg font-bold text-center mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {translate('flashcard_session_complete') || 'Session terminée !'}
        </h1>

        {/* Circular Progress */}
        <CircularProgress
          percentage={masteryPercentage}
          masteredCount={masteredCount}
          total={stats.total}
          colors={colors}
        />

        {/* Star Rating */}
        <StarRating earnedStars={earnedStars} />

        {/* Duration */}
        <div className={`flex items-center justify-center gap-2 mt-3 text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
          <Clock className="w-4 h-4" />
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Mascot Message */}
      <div
        className="rounded-xl p-3 border"
        style={{ backgroundColor: colors.bg, borderColor: colors.secondary }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <Image
              src={getMascotImage()}
              alt="Nareo"
              width={48}
              height={48}
              className="w-12 h-12 object-contain"
            />
          </div>
          <p className="text-sm font-medium leading-snug" style={{ color: colors.primary }}>
            {getEncouragementMessage()}
          </p>
        </div>
      </div>

      {/* Stats breakdown */}
      <div className={`rounded-2xl border p-4 ${
        isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
      }`}>
        <div className="grid grid-cols-2 gap-3">
          {/* Mastered */}
          <div
            className="rounded-xl p-3 border"
            style={{
              backgroundColor: isDark ? 'rgba(55, 159, 90, 0.1)' : '#edf7f1',
              borderColor: isDark ? 'rgba(55, 159, 90, 0.3)' : '#b8dfc6'
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#379f5a' }}>
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
              <h4 className="text-sm font-semibold" style={{ color: isDark ? '#6ee7a0' : '#256838' }}>
                {translate('flashcard_cards_mastered') || 'Cartes maîtrisées'}
              </h4>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold" style={{ color: '#379f5a' }}>
                {stats.good + stats.easy}
              </span>
              <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                ({stats.good} {translate('flashcard_rating_good') || 'Bien'} + {stats.easy} {translate('flashcard_rating_easy') || 'Facile'})
              </span>
            </div>
          </div>

          {/* To Review */}
          <div
            className="rounded-xl p-3 border"
            style={{
              backgroundColor: isDark ? 'rgba(249, 115, 22, 0.1)' : '#FFF7ED',
              borderColor: isDark ? 'rgba(249, 115, 22, 0.3)' : '#FED7AA'
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center leading-none">
                <span className="text-white text-[11px] font-bold -mt-px">!</span>
              </div>
              <h4 className="text-sm font-semibold" style={{ color: isDark ? '#fdba74' : '#c2410c' }}>
                {translate('flashcard_to_review') || 'À revoir'}
              </h4>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-orange-500">
                {stats.hard}
              </span>
              {stats.hard > 0 && (
                <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                  ({translate('flashcard_review_soon') || 'bientôt'})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {/* Retry difficult cards */}
        {difficultCount > 0 && onRetryDifficult && (
          <button
            onClick={onRetryDifficult}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors border ${
              isDark
                ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20'
                : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            {translate('flashcard_retry_difficult') || 'Retravailler les'} {difficultCount} {translate('flashcard_difficult_cards') || 'cartes difficiles'}
          </button>
        )}

        {/* Finish button - always orange */}
        <button
          onClick={onFinish}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold shadow-md transition-colors bg-orange-500 hover:bg-orange-600"
        >
          <Check className="w-4 h-4" />
          {translate('flashcard_finish_session') || 'Terminer la session'}
        </button>
      </div>

      {/* Next review info */}
      {nextReviewInfo && nextReviewInfo.count > 0 && (
        <div className={`flex items-center justify-center gap-2 text-sm ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
          <Calendar className="w-4 h-4" />
          <span>
            {translate('flashcard_next_review') || 'Prochaine révision'} : {nextReviewInfo.date} ({nextReviewInfo.count} {translate('flashcard_cards') || 'cartes'})
          </span>
        </div>
      )}
    </div>
  );
}
