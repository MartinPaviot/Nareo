'use client';

import { Rating, RATING_CONFIG, getIntervalLabel, FlashcardProgress } from '@/lib/spaced-repetition';
import { useTheme } from '@/contexts/ThemeContext';

interface RatingButtonsProps {
  onRate: (rating: Rating) => void;
  currentProgress: FlashcardProgress | null;
  disabled?: boolean;
  compact?: boolean;
}

const RATINGS: Rating[] = ['hard', 'good', 'easy'];

export default function RatingButtons({
  onRate,
  currentProgress,
  disabled = false,
  compact = false,
}: RatingButtonsProps) {
  const { isDark } = useTheme();

  return (
    <div className={`flex ${compact ? 'gap-1.5' : 'gap-2'} justify-center`}>
      {RATINGS.map((rating, index) => {
        const config = RATING_CONFIG[rating];
        const interval = getIntervalLabel(currentProgress, rating);
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
              {compact ? config.labelShort : config.label}
            </span>
            <span className={`${compact ? 'text-[10px]' : 'text-xs'} mt-0.5 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              {interval}
            </span>
          </button>
        );
      })}
    </div>
  );
}
