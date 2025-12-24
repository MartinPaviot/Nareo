'use client';

import { useState } from 'react';
import {
  Loader2,
  ChevronDown,
  Check,
  Sparkles,
  Zap,
  BookOpen,
  Target,
  Layers,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  FlashcardConfig,
  FlashcardNiveau,
  DEFAULT_FLASHCARD_CONFIG,
  FLASHCARD_NIVEAU_OPTIONS,
} from '@/types/flashcard-config';

interface FlashcardPersonnalisationScreenProps {
  onGenerate: (config: FlashcardConfig) => void;
  onCancel?: () => void;
  isGenerating?: boolean;
  initialConfig?: FlashcardConfig;
}

// Niveaux avec icônes Lucide - les labels/descriptions sont traduits dans le composant
const NIVEAUX = [
  {
    value: 'essentiel' as const,
    labelKey: 'flashcards_level_essential',
    icon: Zap,
    descriptionKey: 'flashcards_level_essential_desc',
    iconColor: 'text-yellow-500',
  },
  {
    value: 'complet' as const,
    labelKey: 'flashcards_level_complete',
    icon: BookOpen,
    descriptionKey: 'flashcards_level_complete_desc',
    iconColor: 'text-blue-500',
  },
  {
    value: 'exhaustif' as const,
    labelKey: 'flashcards_level_exhaustive',
    icon: Target,
    descriptionKey: 'flashcards_level_exhaustive_desc',
    iconColor: 'text-purple-500',
  },
];

export default function FlashcardPersonnalisationScreen({
  onGenerate,
  onCancel,
  isGenerating = false,
  initialConfig,
}: FlashcardPersonnalisationScreenProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  // Utiliser initialConfig si fournie, sinon les défauts
  const [niveau, setNiveau] = useState<FlashcardNiveau>(
    initialConfig?.niveau ?? DEFAULT_FLASHCARD_CONFIG.niveau
  );

  // Accordion state
  const [isOpen, setIsOpen] = useState(false);

  const handleGenerate = () => {
    onGenerate({ niveau });
  };

  const selectedNiveau = NIVEAUX.find((n) => n.value === niveau);

  return (
    <div
      className={`rounded-2xl border shadow-sm p-4 transition-colors ${
        isDark
          ? 'bg-neutral-900 border-neutral-800'
          : 'bg-white border-gray-200'
      }`}
    >
      {/* Header */}
      <div className="mb-4">
        <h3
          className={`text-lg font-semibold ${
            isDark ? 'text-neutral-100' : 'text-gray-900'
          }`}
        >
          {translate('flashcards_personalization_title')}
        </h3>
        <p
          className={`text-sm mt-1 ${
            isDark ? 'text-neutral-400' : 'text-gray-500'
          }`}
        >
          {translate('flashcards_personalization_subtitle')}
        </p>
      </div>

      {/* Section Niveau (seule option de personnalisation) */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
            isOpen
              ? isDark
                ? 'bg-neutral-800 border border-orange-500/50'
                : 'bg-orange-50/50 border border-orange-200'
              : isDark
              ? 'bg-neutral-800 border border-neutral-700 hover:border-neutral-600'
              : 'bg-gray-50 border border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isDark
                  ? 'bg-neutral-700'
                  : 'bg-white shadow-sm border border-gray-100'
              }`}
            >
              {selectedNiveau ? (
                <selectedNiveau.icon
                  className={`w-[18px] h-[18px] ${selectedNiveau.iconColor}`}
                />
              ) : (
                <Layers
                  className={`w-[18px] h-[18px] ${
                    isDark ? 'text-neutral-400' : 'text-gray-400'
                  }`}
                />
              )}
            </div>
            <div className="flex flex-col items-start">
              <span
                className={`text-xs ${
                  isDark ? 'text-neutral-400' : 'text-gray-500'
                }`}
              >
                {translate('flashcards_card_count_label')}
              </span>
              <span
                className={`text-sm font-semibold ${
                  isDark ? 'text-neutral-100' : 'text-gray-900'
                }`}
              >
                {selectedNiveau ? translate(selectedNiveau.labelKey) : translate('flashcards_card_count_select')}
              </span>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 flex-shrink-0 transition-transform ${
              isOpen ? 'rotate-180' : ''
            } ${isDark ? 'text-neutral-400' : 'text-gray-400'}`}
          />
        </button>

        {isOpen && (
          <div
            className={`mt-1 rounded-xl border overflow-hidden ${
              isDark
                ? 'bg-neutral-800 border-neutral-700'
                : 'bg-white border-gray-200'
            }`}
          >
            {NIVEAUX.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setNiveau(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 transition-all ${
                  niveau === option.value
                    ? isDark
                      ? 'bg-neutral-700/50'
                      : 'bg-gray-50'
                    : isDark
                    ? 'hover:bg-neutral-700/30'
                    : 'hover:bg-gray-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isDark ? 'bg-neutral-700' : 'bg-gray-100'
                      }`}
                    >
                      <option.icon
                        className={`w-5 h-5 ${option.iconColor}`}
                      />
                    </div>
                    <div>
                      <p
                        className={`text-sm font-semibold ${
                          niveau === option.value
                            ? isDark
                              ? 'text-white'
                              : 'text-gray-900'
                            : isDark
                            ? 'text-neutral-200'
                            : 'text-gray-900'
                        }`}
                      >
                        {translate(option.labelKey)}
                      </p>
                      <p
                        className={`text-xs ${
                          isDark ? 'text-neutral-400' : 'text-gray-500'
                        }`}
                      >
                        {translate(option.descriptionKey)}
                      </p>
                    </div>
                  </div>
                  {niveau === option.value && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center bg-orange-500">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info sur les types de cartes */}
      <div
        className={`mb-4 px-3 py-2 rounded-lg text-xs ${
          isDark
            ? 'bg-neutral-800 text-neutral-400'
            : 'bg-gray-50 text-gray-500'
        }`}
      >
        {translate('flashcards_card_types_info')}
      </div>

      {/* Buttons */}
      <div className={`flex gap-2 ${onCancel ? '' : ''}`}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isGenerating}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50 ${
              isDark
                ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {translate('cancel')}
          </button>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`${
            onCancel ? 'flex-1' : 'w-full'
          } inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-all disabled:opacity-50 shadow-sm`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {translate('flashcards_generating_text')}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {onCancel ? translate('flashcards_regenerating') : translate('flashcards_generate_button')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
