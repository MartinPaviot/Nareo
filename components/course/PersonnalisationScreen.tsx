'use client';

import { useState } from 'react';
import {
  Loader2,
  ChevronDown,
  Check,
  Sparkles,
  BookOpen,
  Zap,
  Lightbulb,
  FileText,
  Calculator,
  Layers
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  PersonnalisationConfig,
  NiveauDetail,
  RecapsConfig,
  DEFAULT_CONFIG,
} from '@/types/personnalisation';

interface PersonnalisationScreenProps {
  fileName?: string; // Optional, kept for backwards compatibility
  onGenerate: (config: PersonnalisationConfig) => void;
  onCancel?: () => void;
  isGenerating?: boolean;
  initialConfig?: PersonnalisationConfig; // Config initiale pour pré-remplir (régénération)
}

// Niveaux avec clés de traduction
const NIVEAUX = [
  { value: 'synthetique' as const, labelKey: 'detail_level_synthetic', icon: Zap, descriptionKey: 'detail_level_synthetic_desc', iconColor: 'text-yellow-500' },
  { value: 'standard' as const, labelKey: 'detail_level_standard', icon: BookOpen, descriptionKey: 'detail_level_standard_desc', iconColor: 'text-blue-500' },
  { value: 'explicatif' as const, labelKey: 'detail_level_explanatory', icon: Lightbulb, descriptionKey: 'detail_level_explanatory_desc', iconColor: 'text-amber-500' },
];

// Récaps avec clés de traduction
const RECAPS = [
  { key: 'definitions' as const, labelKey: 'recap_glossary', icon: FileText, iconColor: 'text-indigo-500' },
  { key: 'formules' as const, labelKey: 'recap_formulas', icon: Calculator, iconColor: 'text-teal-500' },
];

export default function PersonnalisationScreen({
  onGenerate,
  onCancel,
  isGenerating = false,
  initialConfig,
}: PersonnalisationScreenProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  // Utiliser initialConfig si fournie (régénération), sinon les défauts
  const [niveau, setNiveau] = useState<NiveauDetail>(initialConfig?.niveau ?? DEFAULT_CONFIG.niveau);
  const [recaps, setRecaps] = useState<RecapsConfig>(initialConfig?.recaps ?? DEFAULT_CONFIG.recaps);

  // Accordion states - un seul ouvert à la fois
  const [openSection, setOpenSection] = useState<'niveau' | 'recaps' | null>(null);

  const handleRecapToggle = (key: keyof RecapsConfig) => {
    setRecaps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = () => {
    onGenerate({ matiere: DEFAULT_CONFIG.matiere, niveau, recaps });
  };

  const toggleSection = (section: 'niveau' | 'recaps') => {
    setOpenSection(openSection === section ? null : section);
  };

  const selectedNiveau = NIVEAUX.find((n) => n.value === niveau);
  const selectedRecapsCount = Object.values(recaps).filter(Boolean).length;

  return (
    <div className={`rounded-2xl border shadow-sm p-4 transition-colors ${
      isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
    }`}>

      {/* Header */}
      <div className="mb-4">
        <h3
          className={`text-lg font-semibold ${
            isDark ? 'text-neutral-100' : 'text-gray-900'
          }`}
        >
          {initialConfig ? translate('study_sheet_title_regenerate') : translate('study_sheet_title')}
        </h3>
        <p
          className={`text-sm mt-1 ${
            isDark ? 'text-neutral-400' : 'text-gray-500'
          }`}
        >
          {translate('study_sheet_subtitle')}
        </p>
      </div>

      {/* Section Niveau */}
      <div className="mb-2">
        <button
          type="button"
          onClick={() => toggleSection('niveau')}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
            openSection === 'niveau'
              ? isDark ? 'bg-neutral-800 border border-orange-500/50' : 'bg-orange-50/50 border border-orange-200'
              : isDark ? 'bg-neutral-800 border border-neutral-700 hover:border-neutral-600' : 'bg-gray-50 border border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDark ? 'bg-neutral-700' : 'bg-white shadow-sm border border-gray-100'
            }`}>
              {selectedNiveau ? (
                <selectedNiveau.icon className={`w-[18px] h-[18px] ${selectedNiveau.iconColor}`} />
              ) : (
                <Layers className={`w-[18px] h-[18px] ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
              )}
            </div>
            <div className="flex flex-col items-start">
              <span className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{translate('study_sheet_detail_level_label')}</span>
              <span className={`text-sm font-semibold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
                {selectedNiveau ? translate(selectedNiveau.labelKey) : translate('study_sheet_subject_select')}
              </span>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${openSection === 'niveau' ? 'rotate-180' : ''} ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
        </button>

        {openSection === 'niveau' && (
          <div className={`mt-1 rounded-xl border overflow-hidden ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'}`}>
            {NIVEAUX.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => { setNiveau(option.value); setOpenSection(null); }}
                className={`w-full text-left px-4 py-3 transition-all ${
                  niveau === option.value
                    ? isDark ? 'bg-neutral-700/50' : 'bg-gray-50'
                    : isDark ? 'hover:bg-neutral-700/30' : 'hover:bg-gray-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isDark ? 'bg-neutral-700' : 'bg-gray-100'
                    }`}>
                      <option.icon className={`w-5 h-5 ${option.iconColor}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${
                        niveau === option.value
                          ? isDark ? 'text-white' : 'text-gray-900'
                          : isDark ? 'text-neutral-200' : 'text-gray-900'
                      }`}>
                        {translate(option.labelKey)}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
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

      {/* Section Récaps */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => toggleSection('recaps')}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
            openSection === 'recaps'
              ? isDark ? 'bg-neutral-800 border border-orange-500/50' : 'bg-orange-50/50 border border-orange-200'
              : isDark ? 'bg-neutral-800 border border-neutral-700 hover:border-neutral-600' : 'bg-gray-50 border border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDark ? 'bg-neutral-700' : 'bg-white shadow-sm border border-gray-100'
            }`}>
              <FileText className={`w-[18px] h-[18px] ${selectedRecapsCount > 0 ? 'text-orange-500' : isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
            </div>
            <div className="flex flex-col items-start">
              <span className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{translate('study_sheet_recaps_label')}</span>
              <span className={`text-sm font-semibold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
                {selectedRecapsCount > 0 ? translate('study_sheet_recaps_selected', { count: selectedRecapsCount.toString() }) : translate('study_sheet_recaps_none')}
              </span>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${openSection === 'recaps' ? 'rotate-180' : ''} ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
        </button>

        {openSection === 'recaps' && (
          <div className={`mt-1 rounded-xl border overflow-hidden ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'}`}>
            {RECAPS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => handleRecapToggle(option.key)}
                className={`w-full text-left px-4 py-3 transition-all ${
                  recaps[option.key]
                    ? isDark ? 'bg-neutral-700/50' : 'bg-gray-50'
                    : isDark ? 'hover:bg-neutral-700/30' : 'hover:bg-gray-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    recaps[option.key]
                      ? 'bg-orange-500 border-orange-500'
                      : isDark ? 'border-neutral-500 bg-transparent' : 'border-gray-300 bg-transparent'
                  }`}>
                    {recaps[option.key] && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isDark ? 'bg-neutral-700' : 'bg-gray-100'
                  }`}>
                    <option.icon className={`w-[18px] h-[18px] ${option.iconColor}`} />
                  </div>
                  <span className={`text-sm font-medium ${
                    recaps[option.key]
                      ? isDark ? 'text-white' : 'text-gray-900'
                      : isDark ? 'text-neutral-300' : 'text-gray-700'
                  }`}>
                    {translate(option.labelKey)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
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
          className={`${onCancel ? 'flex-1' : 'w-full'} inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-all disabled:opacity-50 shadow-sm`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {translate('study_sheet_generating')}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {onCancel ? translate('study_sheet_regenerate') : translate('study_sheet_generate')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
