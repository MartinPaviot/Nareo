'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  X,
  Loader2,
  Bell,
  BookOpen,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTodayReviewCounts, ReviewCount } from '@/hooks/useFlashcardReviews';

interface ReviewSelectModalProps {
  onClose: () => void;
}

export default function ReviewSelectModal({ onClose }: ReviewSelectModalProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const { counts, totalCount, isLoading } = useTodayReviewCounts();

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSelectCourse = (courseId: string) => {
    router.push(`/flashcards/review/${courseId}`);
    onClose();
  };

  const handleReviewAll = () => {
    router.push('/flashcards/review/all');
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-2xl shadow-xl ${
          isDark ? 'bg-neutral-900' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div
          className={`sticky top-0 z-10 flex items-center justify-between p-4 border-b ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {translate('review_select_title', 'Révision du jour')}
              </h2>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {totalCount > 0
                  ? translate('review_select_subtitle', '{count} cartes à réviser', { count: totalCount })
                  : translate('review_no_cards', 'Aucune carte à réviser')
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : totalCount === 0 ? (
            /* No cards to review */
            <div
              className={`p-4 rounded-xl text-center ${
                isDark ? 'bg-neutral-800' : 'bg-gray-50'
              }`}
            >
              <Bell
                className={`w-10 h-10 mx-auto mb-3 ${
                  isDark ? 'text-neutral-600' : 'text-gray-300'
                }`}
              />
              <h3
                className={`text-sm font-semibold mb-1 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {translate('review_empty_title', 'Rien à réviser !')}
              </h3>
              <p
                className={`text-xs ${
                  isDark ? 'text-neutral-400' : 'text-gray-500'
                }`}
              >
                {translate('review_empty_subtitle', 'Toutes tes cartes sont à jour. Reviens demain !')}
              </p>
            </div>
          ) : (
            <>
              {/* Review all button */}
              <button
                onClick={handleReviewAll}
                className="w-full p-3 rounded-xl text-white flex items-center justify-between group transition-all hover:scale-[1.01]"
                style={{
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold">
                      {translate('review_all_courses', 'Tous les cours')}
                    </div>
                    <div className="text-[11px] opacity-90">
                      {translate('review_cards_count', '{count} cartes', { count: totalCount })} • ~{Math.max(1, Math.round(totalCount * 0.5))} min
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/80 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Divider */}
              {counts.length > 1 && (
                <div className="flex items-center gap-2 py-1">
                  <div className={`flex-1 h-px ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`} />
                  <span className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                    {translate('review_or_select', 'ou sélectionne un cours')}
                  </span>
                  <div className={`flex-1 h-px ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`} />
                </div>
              )}

              {/* Course list */}
              <div className="space-y-1.5">
                {counts.map((item: ReviewCount) => (
                  <button
                    key={item.course_id}
                    onClick={() => handleSelectCourse(item.course_id)}
                    className={`w-full p-2.5 rounded-lg flex items-center justify-between transition-all group ${
                      isDark
                        ? 'bg-neutral-800 hover:bg-neutral-700'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isDark ? 'bg-neutral-700' : 'bg-white'
                        }`}
                      >
                        <BookOpen className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
                      </div>
                      <div className="text-left min-w-0">
                        <div className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {item.course_title}
                        </div>
                        <div className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                          {translate('review_cards_count', '{count} cartes', { count: item.count })}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 group-hover:translate-x-1 transition-transform ${
                      isDark ? 'text-neutral-500' : 'text-gray-400'
                    }`} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className={`sticky bottom-0 p-4 border-t ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-100'
          }`}
        >
          <button
            onClick={onClose}
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDark
                ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {translate('cancel', 'Annuler')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
