'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Home, ChevronLeft, ChevronRight } from 'lucide-react';
import { ChapterData, ChapterProgress, getPhaseForQuestion } from '@/types/concept.types';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedChapterTitleAsync } from '@/lib/content-translator';

interface ChapterSidebarProps {
  chapters: ChapterData[];
  chapterProgress: ChapterProgress[];
  currentChapterId: string;
  onChapterClick: (chapterId: string) => void;
  onHomeClick: () => void;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

export default function ChapterSidebar({
  chapters,
  chapterProgress,
  currentChapterId,
  onChapterClick,
  onHomeClick,
  onCollapseChange,
}: ChapterSidebarProps) {
  const { translate, currentLanguage } = useLanguage();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [localizedTitles, setLocalizedTitles] = useState<Map<string, string>>(new Map());

  const handleToggleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapseChange?.(collapsed);
  };

  // Translate all chapter titles when language changes or chapters change
  useEffect(() => {
    const translateTitles = async () => {
      const titleMap = new Map<string, string>();
      
      for (const chapter of chapters) {
        const translatedTitle = await getLocalizedChapterTitleAsync(chapter, currentLanguage);
        titleMap.set(chapter.id, translatedTitle);
      }
      
      setLocalizedTitles(titleMap);
    };

    if (chapters.length > 0) {
      translateTitles();
    }
  }, [chapters, currentLanguage]);

  // Sort chapters by difficulty and add numbering
  const difficultyOrder = { easy: 1, medium: 2, hard: 3 };
  const sortedChapters = [...chapters].sort((a, b) => {
    const orderA = difficultyOrder[a.difficulty as keyof typeof difficultyOrder] || 2;
    const orderB = difficultyOrder[b.difficulty as keyof typeof difficultyOrder] || 2;
    return orderA - orderB;
  });

  // Calculate overall progress
  const totalChapters = chapters.length;
  const completedChapters = chapterProgress.filter(p => p.completed).length;
  const totalScore = chapterProgress.reduce((sum, p) => sum + p.score, 0);
  const maxScore = totalChapters * 100;

  if (isCollapsed) {
    return (
      <div className="w-14 bg-white border-r border-gray-200 h-screen flex flex-col items-center py-3 gap-3 transition-all duration-300 ease-in-out">
        {/* Toggle Button */}
        <button
          onClick={() => handleToggleCollapse(false)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title={translate('sidebar_expand')}
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>

        {/* Home Icon */}
        <button
          onClick={onHomeClick}
          className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
          title={translate('sidebar_dashboard')}
        >
          <Home className="w-5 h-5 text-orange-500" />
        </button>

        {/* Progress Icon */}
        <div className="p-2 bg-orange-50 rounded-lg" title={translate('sidebar_progress')}>
          <BookOpen className="w-5 h-5 text-orange-500" />
        </div>

        {/* Chapter Icons */}
        {sortedChapters.map((chapter, index) => {
          const progress = chapterProgress.find(p => p.chapterId === chapter.id);
          const isActive = chapter.id === currentChapterId;
          const score = progress?.score || 0;

          return (
            <button
              key={chapter.id}
              onClick={() => onChapterClick(chapter.id)}
              className={`
                w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs
                transition-all
                ${isActive
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-orange-100'
                }
              `}
              title={`${index + 1}. ${localizedTitles.get(chapter.id) || chapter.title} (${score}/100)`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-72 bg-white border-r border-gray-200 h-screen overflow-y-auto flex flex-col transition-all duration-300 ease-in-out">
      {/* Your Progress Header */}
      <div className="border-b border-gray-200">
        {/* Top row aligned with main header */}
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <h2 className="text-sm font-bold text-gray-900 whitespace-nowrap">{translate('sidebar_progress')}</h2>
          </div>

          {/* Home Button */}
          <button
            onClick={onHomeClick}
            className="p-1.5 hover:bg-orange-100 rounded-lg transition-colors"
            title={translate('sidebar_dashboard')}
          >
            <Home className="w-4 h-4 text-orange-500" />
          </button>
        </div>

        {/* Progress info section */}
        <div className="px-4 pb-4">
          <p className="text-xs text-gray-600 mb-3">
            {completedChapters} / {totalChapters} {translate('sidebar_mastered')}
          </p>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0}%` }}
            />
          </div>

          {/* Current Score */}
          <div className="mt-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-medium text-gray-700">{translate('sidebar_current_score')}</span>
              <span className="text-xs font-bold text-gray-900">{totalScore}/{maxScore}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${maxScore > 0 ? (totalScore / maxScore) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Chapter List */}
      <div className="flex-1 p-3 space-y-2">
        {sortedChapters.map((chapter, index) => {
          const progress = chapterProgress.find(p => p.chapterId === chapter.id);
          const isActive = chapter.id === currentChapterId;
          const score = progress?.score || 0;
          const currentQuestion = progress?.currentQuestion || 1;

          // Determine which phases are completed based on questions answered
          const mcqPhaseComplete = progress ? progress.questionsAnswered >= 3 : false;
          const shortAnswerComplete = progress ? progress.questionsAnswered >= 4 : false;
          const reflectiveComplete = progress ? progress.questionsAnswered >= 5 : false;

          return (
            <div
              key={chapter.id}
              onClick={() => onChapterClick(chapter.id)}
              className={`
                p-3 rounded-lg border-2 cursor-pointer transition-all
                ${isActive
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50'
                }
              `}
            >
              {/* Chapter Number and Title */}
              <div className="flex items-start gap-2 mb-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <h3 className="font-semibold text-gray-900 flex-1 line-clamp-2 text-sm leading-tight">
                  {localizedTitles.get(chapter.id) || chapter.title}
                </h3>
              </div>

              {/* Phase Indicators */}
              <div className="space-y-1.5 mb-2">
                {/* MCQ Phase */}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`
                      w-3 h-3 rounded-full border-[1.5px] flex items-center justify-center
                      ${mcqPhaseComplete
                        ? 'bg-orange-500 border-orange-500'
                        : currentQuestion <= 3 && isActive
                        ? 'border-orange-500'
                        : 'border-gray-300'
                      }
                    `}
                  >
                    {mcqPhaseComplete && (
                      <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-[10px] ${mcqPhaseComplete ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                    {translate('sidebar_phase_mcq')}
                  </span>
                </div>

                {/* Short Answer */}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`
                      w-3 h-3 rounded-full border-[1.5px] flex items-center justify-center
                      ${shortAnswerComplete
                        ? 'bg-orange-500 border-orange-500'
                        : currentQuestion === 4 && isActive
                        ? 'border-orange-500'
                        : 'border-gray-300'
                      }
                    `}
                  >
                    {shortAnswerComplete && (
                      <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-[10px] ${shortAnswerComplete ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                    {translate('sidebar_phase_short')}
                  </span>
                </div>

                {/* Reflective */}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`
                      w-3 h-3 rounded-full border-[1.5px] flex items-center justify-center
                      ${reflectiveComplete
                        ? 'bg-orange-500 border-orange-500'
                        : currentQuestion === 5 && isActive
                        ? 'border-orange-500'
                        : 'border-gray-300'
                      }
                    `}
                  >
                    {reflectiveComplete && (
                      <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-[10px] ${reflectiveComplete ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                    {translate('sidebar_phase_reflective')}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-gray-600">{translate('sidebar_progress_label')}</span>
                  <span className="text-[10px] font-bold text-gray-900">{score}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div
                    className="bg-green-500 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
