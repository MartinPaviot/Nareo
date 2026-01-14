'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronDown, ChevronRight, Check, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTodayReviewCounts } from '@/hooks/useFlashcardReviews';

interface ReviewsSectionProps {
  onClose?: () => void;
}

export default function ReviewsSection({ onClose }: ReviewsSectionProps) {
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
        className="w-full flex items-center justify-between px-2 py-1 rounded-lg transition-colors duration-150"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div className="flex items-center gap-1.5">
          <Bell
            className="w-3.5 h-3.5"
            style={{ color: totalCount > 0 ? 'var(--color-nareo)' : 'var(--sidebar-text-muted)' }}
          />
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            {translate('sidebar_reviews_title', 'Révisions du jour')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-nareo)' }} />
          ) : totalCount > 0 ? (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center text-white"
              style={{ backgroundColor: 'var(--color-nareo)' }}
            >
              {totalCount}
            </span>
          ) : null}
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--sidebar-text-muted)' }} />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--sidebar-text-muted)' }} />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-1 space-y-0.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--color-nareo)' }} />
            </div>
          ) : totalCount === 0 ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ backgroundColor: 'var(--sidebar-hover)' }}
            >
              <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
              <span className="text-[11px]" style={{ color: 'var(--sidebar-text-muted)' }}>
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
                  className="flex items-center justify-between px-2 py-1 rounded-lg text-[11px] transition-colors duration-150"
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span className="truncate pr-2">{course.course_title}</span>
                  <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: 'var(--sidebar-text-muted)' }}>
                    {course.count}
                  </span>
                </Link>
              ))}

              {/* Review all button */}
              <Link
                href="/flashcards/review/all"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors duration-150"
                style={{
                  backgroundColor: 'var(--sidebar-active-bg)',
                  color: 'var(--color-nareo)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
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
