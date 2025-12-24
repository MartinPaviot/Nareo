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
  ListChecks,
  ToggleLeft,
  TextCursor,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  QuizConfig,
  NiveauQuantite,
  QuizTypesConfig,
  DEFAULT_QUIZ_CONFIG,
  NIVEAU_QUANTITE_OPTIONS,
  QUIZ_TYPES_OPTIONS,
} from '@/types/quiz-personnalisation';

interface QuizPersonnalisationScreenProps {
  onGenerate: (config: QuizConfig) => void;
  onCancel?: () => void;
  isGenerating?: boolean;
  initialConfig?: QuizConfig;
}

// Niveau translation keys mapping
const NIVEAU_TRANSLATION_KEYS: Record<NiveauQuantite, { label: string; description: string }> = {
  synthetique: { label: 'quiz_perso_level_synthetic', description: 'quiz_perso_level_synthetic_desc' },
  standard: { label: 'quiz_perso_level_standard', description: 'quiz_perso_level_standard_desc' },
  exhaustif: { label: 'quiz_perso_level_exhaustive', description: 'quiz_perso_level_exhaustive_desc' },
};

// Niveaux avec icônes Lucide
const NIVEAUX = [
  {
    value: 'synthetique' as const,
    icon: Zap,
    iconColor: 'text-yellow-500',
  },
  {
    value: 'standard' as const,
    icon: BookOpen,
    iconColor: 'text-blue-500',
  },
  {
    value: 'exhaustif' as const,
    icon: Target,
    iconColor: 'text-purple-500',
  },
];

// Question type translation keys mapping
const TYPE_TRANSLATION_KEYS: Record<keyof QuizTypesConfig, { label: string; description: string }> = {
  qcm: { label: 'quiz_perso_type_mcq', description: 'quiz_perso_type_mcq_desc' },
  vrai_faux: { label: 'quiz_perso_type_tf', description: 'quiz_perso_type_tf_desc' },
  texte_trous: { label: 'quiz_perso_type_fill', description: 'quiz_perso_type_fill_desc' },
};

// Types de questions avec icônes
const TYPES_QUESTIONS = [
  {
    key: 'qcm' as const,
    icon: ListChecks,
    iconColor: 'text-emerald-500',
  },
  {
    key: 'vrai_faux' as const,
    icon: ToggleLeft,
    iconColor: 'text-orange-500',
  },
  {
    key: 'texte_trous' as const,
    icon: TextCursor,
    iconColor: 'text-cyan-500',
  },
];

export default function QuizPersonnalisationScreen({
  onGenerate,
  onCancel,
  isGenerating = false,
  initialConfig,
}: QuizPersonnalisationScreenProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  // Utiliser initialConfig si fournie, sinon les défauts
  const [niveau, setNiveau] = useState<NiveauQuantite>(
    initialConfig?.niveau ?? DEFAULT_QUIZ_CONFIG.niveau
  );
  const [types, setTypes] = useState<QuizTypesConfig>(
    initialConfig?.types ?? DEFAULT_QUIZ_CONFIG.types
  );

  // Accordion states
  const [openSection, setOpenSection] = useState<'niveau' | 'types' | null>(null);

  const handleTypeToggle = (key: keyof QuizTypesConfig) => {
    const newTypes = { ...types, [key]: !types[key] };
    // S'assurer qu'au moins un type est coché
    const hasAtLeastOne = Object.values(newTypes).some(Boolean);
    if (hasAtLeastOne) {
      setTypes(newTypes);
    }
  };

  const handleGenerate = () => {
    onGenerate({ niveau, types });
  };

  const toggleSection = (section: 'niveau' | 'types') => {
    setOpenSection(openSection === section ? null : section);
  };

  const selectedNiveau = NIVEAUX.find((n) => n.value === niveau);
  const selectedTypesCount = Object.values(types).filter(Boolean).length;

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
          {translate('quiz_perso_title')}
        </h3>
        <p
          className={`text-sm mt-1 ${
            isDark ? 'text-neutral-400' : 'text-gray-500'
          }`}
        >
          {translate('quiz_perso_subtitle')}
        </p>
      </div>

      {/* Section Niveau */}
      <div className="mb-2">
        <button
          type="button"
          onClick={() => toggleSection('niveau')}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
            openSection === 'niveau'
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
                <BookOpen
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
                {translate('quiz_perso_question_count')}
              </span>
              <span
                className={`text-sm font-semibold ${
                  isDark ? 'text-neutral-100' : 'text-gray-900'
                }`}
              >
                {selectedNiveau ? translate(NIVEAU_TRANSLATION_KEYS[selectedNiveau.value].label) : translate('quiz_perso_select')}
              </span>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 flex-shrink-0 transition-transform ${
              openSection === 'niveau' ? 'rotate-180' : ''
            } ${isDark ? 'text-neutral-400' : 'text-gray-400'}`}
          />
        </button>

        {openSection === 'niveau' && (
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
                  setOpenSection(null);
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
                        {translate(NIVEAU_TRANSLATION_KEYS[option.value].label)}
                      </p>
                      <p
                        className={`text-xs ${
                          isDark ? 'text-neutral-400' : 'text-gray-500'
                        }`}
                      >
                        {translate(NIVEAU_TRANSLATION_KEYS[option.value].description)}
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

      {/* Section Types de questions */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => toggleSection('types')}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
            openSection === 'types'
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
              <ListChecks
                className={`w-[18px] h-[18px] ${
                  selectedTypesCount > 0
                    ? 'text-orange-500'
                    : isDark
                    ? 'text-neutral-400'
                    : 'text-gray-400'
                }`}
              />
            </div>
            <div className="flex flex-col items-start">
              <span
                className={`text-xs ${
                  isDark ? 'text-neutral-400' : 'text-gray-500'
                }`}
              >
                {translate('quiz_perso_question_types')}
              </span>
              <span
                className={`text-sm font-semibold ${
                  isDark ? 'text-neutral-100' : 'text-gray-900'
                }`}
              >
                {selectedTypesCount > 0
                  ? translate('quiz_perso_selected', { count: selectedTypesCount.toString() })
                  : translate('quiz_perso_none')}
              </span>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 flex-shrink-0 transition-transform ${
              openSection === 'types' ? 'rotate-180' : ''
            } ${isDark ? 'text-neutral-400' : 'text-gray-400'}`}
          />
        </button>

        {openSection === 'types' && (
          <div
            className={`mt-1 rounded-xl border overflow-hidden ${
              isDark
                ? 'bg-neutral-800 border-neutral-700'
                : 'bg-white border-gray-200'
            }`}
          >
            {TYPES_QUESTIONS.map((option) => {
              const isChecked = types[option.key];
              const canUncheck =
                Object.values(types).filter(Boolean).length > 1;

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleTypeToggle(option.key)}
                  disabled={isChecked && !canUncheck}
                  className={`w-full text-left px-4 py-3 transition-all ${
                    isChecked
                      ? isDark
                        ? 'bg-neutral-700/50'
                        : 'bg-gray-50'
                      : isDark
                      ? 'hover:bg-neutral-700/30'
                      : 'hover:bg-gray-50/50'
                  } ${
                    isChecked && !canUncheck
                      ? 'cursor-not-allowed opacity-60'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isChecked
                          ? 'bg-orange-500 border-orange-500'
                          : isDark
                          ? 'border-neutral-500 bg-transparent'
                          : 'border-gray-300 bg-transparent'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isDark ? 'bg-neutral-700' : 'bg-gray-100'
                      }`}
                    >
                      <option.icon
                        className={`w-[18px] h-[18px] ${option.iconColor}`}
                      />
                    </div>
                    <div className="flex-1">
                      <span
                        className={`text-sm font-medium ${
                          isChecked
                            ? isDark
                              ? 'text-white'
                              : 'text-gray-900'
                            : isDark
                            ? 'text-neutral-300'
                            : 'text-gray-700'
                        }`}
                      >
                        {translate(TYPE_TRANSLATION_KEYS[option.key].label)}
                      </span>
                      <p
                        className={`text-xs ${
                          isDark ? 'text-neutral-400' : 'text-gray-500'
                        }`}
                      >
                        {translate(TYPE_TRANSLATION_KEYS[option.key].description)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Note explicative si plusieurs types */}
      {selectedTypesCount > 1 && (
        <div
          className={`mb-4 px-3 py-2 rounded-lg text-xs ${
            isDark
              ? 'bg-neutral-800 text-neutral-400'
              : 'bg-gray-50 text-gray-500'
          }`}
        >
          {translate('quiz_perso_shuffle_note')}
        </div>
      )}

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
            {translate('quiz_perso_cancel')}
          </button>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || selectedTypesCount === 0}
          className={`${
            onCancel ? 'flex-1' : 'w-full'
          } inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-all disabled:opacity-50 shadow-sm`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {translate('quiz_perso_generating')}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {onCancel ? translate('quiz_perso_regenerate') : translate('quiz_perso_generate')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
