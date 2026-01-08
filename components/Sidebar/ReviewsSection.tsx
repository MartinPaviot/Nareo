'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronDown, ChevronRight, Check, Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTodayReviewCounts } from '@/hooks/useFlashcardReviews';

interface ReviewsSectionProps {
  onClose?: () => void;
}

export default function ReviewsSection({ onClose }: ReviewsSectionProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const { user } = useAuth();
  const { counts, totalCount, isLoading } = useTodayReviewCounts();
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't show section if user is not logged in
  if (!user) return null;

  return (
    <div className="pb-0.5">
      {/* Section header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-2 py-1 rounded-lg transition-colors ${
          isDark ? 'hover:bg-neutral-800' : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Bell className={`w-3.5 h-3.5 ${totalCount > 0 ? 'text-orange-500' : isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${
            isDark ? 'text-neutral-500' : 'text-gray-500'
          }`}>
            {translate('sidebar_reviews_title', 'Révisions du jour')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
          ) : totalCount > 0 ? (
            <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0 rounded-full min-w-[18px] text-center">
              {totalCount}
            </span>
          ) : null}
          {isExpanded ? (
            <ChevronDown className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
          ) : (
            <ChevronRight className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-1 space-y-0.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
            </div>
          ) : totalCount === 0 ? (
            <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${
              isDark ? 'bg-neutral-800/50' : 'bg-gray-50'
            }`}>
              <Check className="w-3 h-3 text-green-500" />
              <span className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                {translate('sidebar_no_reviews', 'Rien à réviser !')}
              </span>
            </div>
          ) : (
            <>
              {/* List of courses with due cards */}
              {counts.map((course) => (
                <Link
                  key={course.course_id}
                  href={`/flashcards/review/${course.course_id}`}
                  onClick={onClose}
                  className={`flex items-center justify-between px-2 py-0.5 rounded-md text-xs transition-colors ${
                    isDark
                      ? 'hover:bg-neutral-800 text-neutral-300'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className="truncate pr-2">{course.course_title}</span>
                  <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                    ({course.count})
                  </span>
                </Link>
              ))}

              {/* Review all button */}
              <Link
                href="/flashcards/review/all"
                onClick={onClose}
                className={`flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  isDark
                    ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                    : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                }`}
              >
                {translate('sidebar_review_all', 'Tout réviser')} ({totalCount})
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
