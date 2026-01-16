'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Archive, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useArchivedFlashcards, ArchivedFlashcard } from '@/hooks/useFlashcardReviews';

interface AcquiredCardsSectionProps {
  courseId: string;
  onCardRestored?: () => void;
}

export default function AcquiredCardsSection({ courseId, onCardRestored }: AcquiredCardsSectionProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const { cards, isLoading, restoreCard, isRestoring } = useArchivedFlashcards(courseId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [restoringCardId, setRestoringCardId] = useState<string | null>(null);

  const handleRestore = async (cardId: string) => {
    setRestoringCardId(cardId);
    try {
      await restoreCard(cardId);
      onCardRestored?.();
    } finally {
      setRestoringCardId(null);
    }
  };

  // Don't show section while loading or if no archived cards
  // This prevents the flash of "loading" state when there are no cards
  if (isLoading || cards.length === 0) {
    return null;
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className={`mt-6 rounded-xl border ${
      isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-gray-50 border-gray-200'
    }`}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-4 transition-colors ${
          isDark ? 'hover:bg-neutral-800/50' : 'hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            isDark ? 'bg-green-500/20' : 'bg-green-100'
          }`}>
            <Archive className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
          </div>
          <div className="text-left">
            <h3 className={`font-medium ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>
              {translate('flashcard_acquired_section', 'Cartes acquises')}
            </h3>
            <p className={`text-sm ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              {isLoading ? (
                translate('loading', 'Chargement...')
              ) : (
                `${cards.length} ${cards.length === 1 ? 'carte' : 'cartes'}`
              )}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
        ) : (
          <ChevronDown className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className={`border-t ${isDark ? 'border-neutral-800' : 'border-gray-200'}`}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
            </div>
          ) : cards.length === 0 ? (
            <div className="py-8 text-center">
              <p className={`text-sm ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                {translate('flashcard_acquired_empty', 'Aucune carte acquise')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className={`p-4 flex items-start justify-between gap-4 ${
                    isDark ? 'hover:bg-neutral-800/30' : 'hover:bg-gray-100/50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      isDark ? 'text-neutral-200' : 'text-gray-800'
                    }`}>
                      {card.front}
                    </p>
                    <p className={`text-xs mt-1 ${
                      isDark ? 'text-neutral-500' : 'text-gray-500'
                    }`}>
                      {translate('flashcard_archived_on', 'Acquis le')} {formatDate(card.progress?.archived_at || '')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(card.id)}
                    disabled={isRestoring && restoringCardId === card.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isDark
                        ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                    } ${isRestoring && restoringCardId === card.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isRestoring && restoringCardId === card.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    {translate('flashcard_unarchive', 'Restaurer')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
