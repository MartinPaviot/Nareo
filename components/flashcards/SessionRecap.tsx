'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { SessionStats, getMasteredCount, getDifficultCount, getSessionDuration, getWeightedScore, Rating } from '@/lib/spaced-repetition';
import { RotateCcw, Check, Calendar, Clock, Star, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import Image from 'next/image';

// Card result with rating and next review date
export interface CardResult {
  id: string;
  front: string;
  back: string;
  rating: Rating;
  nextReviewAt: Date;
}

interface SessionRecapProps {
  stats: SessionStats;
  cardResults?: CardResult[];
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
  cardResults = [],
  onRetryDifficult,
  onFinish,
  nextReviewInfo,
}: SessionRecapProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const [showDetails, setShowDetails] = useState(false);

  const masteredCount = getMasteredCount(stats);
  const difficultCount = getDifficultCount(stats);
  const duration = getSessionDuration(stats);
  // Use weighted score based on attempts instead of simple mastery percentage
  const masteryPercentage = getWeightedScore(stats);
  const colors = getScoreColors(masteryPercentage, isDark);
  const earnedStars = getStars(masteryPercentage);

  // Group cards by rating
  const easyCards = cardResults.filter(c => c.rating === 'easy');
  const goodCards = cardResults.filter(c => c.rating === 'good');
  const hardCards = cardResults.filter(c => c.rating === 'hard');

  // Format duration
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // Get encouragement message based on performance
  const getEncouragementMessage = (): string => {
    if (masteryPercentage >= 90) return translate('flashcard_session_excellent');
    if (masteryPercentage >= 70) return translate('flashcard_session_good');
    if (masteryPercentage >= 50) return translate('flashcard_session_keep_going');
    return translate('flashcard_session_practice_more');
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
          {translate('flashcard_session_complete')}
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
        <div className="grid grid-cols-3 gap-2">
          {/* Easy - blue-500 #3b82f6 */}
          <div
            className={`rounded-xl p-3 border ${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-4 h-4 rounded-full flex items-center justify-center bg-blue-500">
                <Star className="w-2.5 h-2.5 text-white fill-white" />
              </div>
              <h4 className={`text-xs font-semibold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                {translate('flashcard_rating_easy')}
              </h4>
            </div>
            <span className="text-2xl font-bold text-blue-500">
              {stats.easy}
            </span>
          </div>

          {/* Good - green-500 #22c55e */}
          <div
            className={`rounded-xl p-3 border ${isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-4 h-4 rounded-full flex items-center justify-center bg-green-500">
                <CheckCircle2 className="w-2.5 h-2.5 text-white" />
              </div>
              <h4 className={`text-xs font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                {translate('flashcard_rating_good')}
              </h4>
            </div>
            <span className="text-2xl font-bold text-green-500">
              {stats.good}
            </span>
          </div>

          {/* Hard - red-500 #ef4444 */}
          <div
            className={`rounded-xl p-3 border ${isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center leading-none">
                <span className="text-white text-[9px] font-bold">!</span>
              </div>
              <h4 className={`text-xs font-semibold ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                {translate('flashcard_rating_hard')}
              </h4>
            </div>
            <span className="text-2xl font-bold text-red-500">
              {stats.hard}
            </span>
          </div>
        </div>
      </div>

      {/* Detailed card breakdown - collapsible */}
      {cardResults.length > 0 && (
        <div className={`rounded-2xl border overflow-hidden ${
          isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
        }`}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`w-full flex items-center justify-between p-4 transition-colors ${
              isDark ? 'hover:bg-neutral-700/50' : 'hover:bg-gray-50'
            }`}
          >
            <span className={`text-sm font-semibold ${isDark ? 'text-neutral-200' : 'text-gray-700'}`}>
              {translate('flashcard_detailed_results')}
            </span>
            {showDetails ? (
              <ChevronUp className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
            )}
          </button>

          {showDetails && (
            <div className={`border-t ${isDark ? 'border-neutral-700' : 'border-gray-200'}`}>
              {/* Easy cards */}
              {easyCards.length > 0 && (
                <CardGroup
                  title={translate('flashcard_rating_easy')}
                  cards={easyCards}
                  colorClass="text-blue-500"
                  bgClass={isDark ? 'bg-blue-500/5' : 'bg-blue-50/50'}
                  icon={<Star className="w-3 h-3 fill-current" />}
                  isDark={isDark}
                />
              )}

              {/* Good cards */}
              {goodCards.length > 0 && (
                <CardGroup
                  title={translate('flashcard_rating_good')}
                  cards={goodCards}
                  colorClass="text-green-500"
                  bgClass={isDark ? 'bg-green-500/5' : 'bg-green-50/50'}
                  icon={<CheckCircle2 className="w-3 h-3" />}
                  isDark={isDark}
                />
              )}

              {/* Hard cards */}
              {hardCards.length > 0 && (
                <CardGroup
                  title={translate('flashcard_rating_hard')}
                  cards={hardCards}
                  colorClass="text-red-500"
                  bgClass={isDark ? 'bg-red-500/5' : 'bg-red-50/50'}
                  icon={<span className="text-[10px] font-bold">!</span>}
                  isDark={isDark}
                />
              )}
            </div>
          )}
        </div>
      )}

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
            {translate('flashcard_retry_difficult')} {difficultCount} {translate('flashcard_difficult_cards')}
          </button>
        )}

        {/* Finish button - always orange */}
        <button
          onClick={onFinish}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold shadow-md transition-colors bg-orange-500 hover:bg-orange-600"
        >
          <Check className="w-4 h-4" />
          {translate('flashcard_finish_session')}
        </button>
      </div>
    </div>
  );
}

// Helper component to display a group of cards
function CardGroup({
  title,
  cards,
  colorClass,
  bgClass,
  icon,
  isDark,
}: {
  title: string;
  cards: CardResult[];
  colorClass: string;
  bgClass: string;
  icon: React.ReactNode;
  isDark: boolean;
}) {
  const formatNextReview = (date: Date): string => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Aujourd\'hui';
    if (diffDays === 1) return 'Demain';
    if (diffDays < 7) return `Dans ${diffDays} jours`;
    if (diffDays < 30) {
      const weeks = Math.round(diffDays / 7);
      return `Dans ${weeks} sem.`;
    }
    const months = Math.round(diffDays / 30);
    return `Dans ${months} mois`;
  };

  return (
    <div className={bgClass}>
      <div className={`flex items-center gap-2 px-4 py-2 border-b ${isDark ? 'border-neutral-700' : 'border-gray-200'}`}>
        <span className={colorClass}>{icon}</span>
        <span className={`text-xs font-semibold ${colorClass}`}>{title}</span>
        <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>({cards.length})</span>
      </div>
      <div className="divide-y divide-neutral-700/30">
        {cards.map((card) => (
          <div key={card.id} className={`px-4 py-2 flex items-center justify-between gap-3`}>
            <p className={`text-sm flex-1 truncate ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
              {card.front}
            </p>
            <span className={`text-xs whitespace-nowrap ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
              {formatNextReview(card.nextReviewAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
