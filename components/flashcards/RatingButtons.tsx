'use client';

import { Archive } from 'lucide-react';
import { Rating, RATING_CONFIG, FlashcardProgress, calculateNextReview } from '@/lib/spaced-repetition';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface RatingButtonsProps {
  onRate: (rating: Rating) => void;
  currentProgress: FlashcardProgress | null;
  disabled?: boolean;
  compact?: boolean;
  onArchive?: () => void;
}

const RATINGS: Rating[] = ['hard', 'good', 'easy'];

// Translation keys for rating labels
const RATING_TRANSLATION_KEYS: Record<Rating, string> = {
  hard: 'flashcard_rating_hard',
  good: 'flashcard_rating_good',
  easy: 'flashcard_rating_easy',
};

export default function RatingButtons({
  onRate,
  currentProgress,
  disabled = false,
  compact = false,
  onArchive,
}: RatingButtonsProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  // Get translated interval label
  const getTranslatedIntervalLabel = (
    progress: FlashcardProgress | null,
    rating: Rating
  ): string => {
    const { interval_days } = calculateNextReview(progress, rating);

    if (interval_days === 0) return translate('flashcard_interval_to_review') || 'À revoir';
    if (interval_days === 1) return translate('flashcard_interval_1_day') || '1 jour';
    if (interval_days < 7) {
      const template = translate('flashcard_interval_days') || '{count} jours';
      return template.replace('{count}', String(interval_days));
    }
    if (interval_days < 30) {
      const weeks = Math.round(interval_days / 7);
      if (weeks === 1) return translate('flashcard_interval_1_week') || '1 sem.';
      const template = translate('flashcard_interval_weeks') || '{count} sem.';
      return template.replace('{count}', String(weeks));
    }
    const months = Math.round(interval_days / 30);
    if (months === 1) return translate('flashcard_interval_1_month') || '1 mois';
    const template = translate('flashcard_interval_months') || '{count} mois';
    return template.replace('{count}', String(months));
  };

  return (
    <div className={`flex ${compact ? 'gap-1.5' : 'gap-2'} justify-center items-stretch`}>
      {RATINGS.map((rating, index) => {
        const config = RATING_CONFIG[rating];
        const interval = getTranslatedIntervalLabel(currentProgress, rating);
        const translatedLabel = translate(RATING_TRANSLATION_KEYS[rating]) || config.label;
        const keyNumber = index + 1; // 1, 2, 3

        return (
          <button
            key={rating}
            onClick={() => onRate(rating)}
            disabled={disabled}
            className={`
              flex flex-col items-center justify-center relative
              ${compact ? 'px-2.5 py-2 min-w-[70px]' : 'px-4 py-3 min-w-[85px]'}
              rounded-xl
              transition-all duration-200
              ${isDark ? config.bgDark : config.bgLight}
              disabled:opacity-50 disabled:cursor-not-allowed
              active:scale-95
            `}
          >
            {/* Keyboard shortcut indicator */}
            <span className={`absolute ${compact ? 'top-0.5 right-1' : 'top-1 right-1.5'} text-[10px] font-medium ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
              {keyNumber}
            </span>
            <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'} ${isDark ? config.textDark : config.textLight}`}>
              {translatedLabel}
            </span>
            <span className={`${compact ? 'text-[10px]' : 'text-xs'} mt-0.5 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              {interval}
            </span>
          </button>
        );
      })}

      {/* Archive button - mark as acquired */}
      {onArchive && (
        <button
          onClick={onArchive}
          disabled={disabled}
          className={`
            flex flex-col items-center justify-center relative
            ${compact ? 'px-2.5 py-2 min-w-[70px]' : 'px-4 py-3 min-w-[85px]'}
            rounded-xl
            transition-all duration-200
            ${isDark ? 'bg-orange-500/10 hover:bg-orange-500/20' : 'bg-orange-50 hover:bg-orange-100'}
            disabled:opacity-50 disabled:cursor-not-allowed
            active:scale-95
          `}
        >
          {/* Keyboard shortcut indicator */}
          <span className={`absolute ${compact ? 'top-0.5 right-1' : 'top-1 right-1.5'} text-[10px] font-medium ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
            A
          </span>
          <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'} ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
            {translate('flashcard_archive_short') || 'Acquis'}
          </span>
          <span className={`${compact ? 'text-[10px]' : 'text-xs'} mt-0.5 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
            {translate('flashcard_archive_action') || 'Retirer'}
          </span>
        </button>
      )}
    </div>
  );
}
