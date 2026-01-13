'use client';

import {
  BarChart2,
  BookOpen,
  FileText,
  HelpCircle,
  Highlighter,
  Layers,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';

interface WhyQuizzesSectionProps {
  translate: (key: string) => string;
}

export function WhyQuizzesSection({ translate }: WhyQuizzesSectionProps) {
  return (
    <section className="space-y-5">
      {/* Title + Hero Stat + Source - grouped together */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">{translate('home_why_title')}</h2>
        <div className="flex flex-col items-center">
          <span className="text-4xl md:text-5xl font-bold text-orange-500">+50%</span>
          <span className="text-base text-gray-600 mt-1">{translate('home_why_hero_stat')}</span>
        </div>
        {/* Source - directly under the stat */}
        <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2 mx-auto">
          <BarChart2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <span className="text-xs text-gray-600">{translate('home_why_source_short')}</span>
        </div>
      </div>

      {/* Comparison cards */}
      <div className="flex flex-col md:flex-row items-stretch justify-center gap-4 md:gap-0 max-w-3xl mx-auto relative">

        {/* Card PERDANTE */}
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-5 md:rounded-r-none">
          {/* Header */}
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-4 h-4 text-gray-400" />
            </div>
            <span className="font-semibold text-gray-500">{translate('home_why_left_title')}</span>
          </div>

          {/* Efficacy text */}
          <div className="mb-5">
            <span className="text-sm text-gray-500">{translate('home_why_left_efficacy')}</span>
          </div>

          {/* Liste */}
          <ul className="space-y-3 mb-5">
            <li className="flex items-center gap-3 text-gray-600">
              <BookOpen className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <span className="text-sm">{translate('home_why_left_item1')}</span>
            </li>
            <li className="flex items-center gap-3 text-gray-600">
              <Highlighter className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <span className="text-sm">{translate('home_why_left_item2')}</span>
            </li>
            <li className="flex items-center gap-3 text-gray-600">
              <RotateCcw className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <span className="text-sm">{translate('home_why_left_item3')}</span>
            </li>
          </ul>

          {/* Résultat */}
          <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
            <TrendingDown className="w-5 h-5" style={{ color: '#d91a1c' }} />
            <span className="font-medium text-sm" style={{ color: '#d91a1c' }}>{translate('home_why_left_result')}</span>
          </div>
        </div>

        {/* Badge VS - Mobile only */}
        <div className="flex md:hidden items-center justify-center -my-3 z-10">
          <div className="w-14 h-14 bg-white border-[3px] border-gray-200 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-sm font-bold text-gray-500">VS</span>
          </div>
        </div>

        {/* Card GAGNANTE */}
        <div className="flex-1 bg-orange-50 border border-orange-300 rounded-2xl p-5 md:rounded-l-none md:border-l-0 relative">

          {/* Badge "Prouvé" */}
          <div className="absolute -top-3 right-4 text-white text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: '#ff751f' }}>
            {translate('home_why_badge')}
          </div>

          {/* Header */}
          <div className="flex items-center gap-2 mb-5 mt-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md" style={{ background: 'linear-gradient(to bottom right, #ff751f, #e5681b)', boxShadow: '0 4px 6px -1px rgba(255, 117, 31, 0.3)' }}>
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-semibold text-gray-900">{translate('home_why_right_title')}</span>
          </div>

          {/* Efficacy text */}
          <div className="mb-5">
            <span className="text-sm text-orange-600 font-semibold">{translate('home_why_right_efficacy')}</span>
          </div>

          {/* Liste */}
          <ul className="space-y-3 mb-5">
            <li className="flex items-center gap-3 text-gray-700">
              <FileText className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <span className="text-sm" dangerouslySetInnerHTML={{ __html: translate('home_why_right_item1') }} />
            </li>
            <li className="flex items-center gap-3 text-gray-700">
              <HelpCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <span className="text-sm" dangerouslySetInnerHTML={{ __html: translate('home_why_right_item2') }} />
            </li>
            <li className="flex items-center gap-3 text-gray-700">
              <Layers className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <span className="text-sm" dangerouslySetInnerHTML={{ __html: translate('home_why_right_item3') }} />
            </li>
          </ul>

          {/* Résultat */}
          <div className="flex items-center gap-2 pt-4 border-t border-orange-200">
            <TrendingUp className="w-5 h-5" style={{ color: '#379f5a' }} />
            <span className="font-medium text-sm" style={{ color: '#379f5a' }}>{translate('home_why_right_result')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
