'use client';

import { useState, useEffect } from 'react';
import { BookOpen, FolderOpen } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

type TabView = 'courses' | 'folders';

const STORAGE_KEY = 'aristo_dashboard_view';

interface DashboardTabsProps {
  initialView?: TabView;
  coursesCount: number;
  foldersCount: number;
  children: React.ReactNode;
  coursesContent: React.ReactNode;
  foldersContent: React.ReactNode;
}

/**
 * DashboardTabs - Modern pill switcher for Courses/Folders views
 *
 * Features:
 * - Pill/segmented control style
 * - Smooth animations
 * - localStorage persistence
 * - Contextual mascot
 * - Mobile responsive
 */
export default function DashboardTabs({
  initialView = 'courses',
  coursesCount,
  foldersCount,
  coursesContent,
  foldersContent,
}: DashboardTabsProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<TabView>(initialView);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load saved preference from localStorage on mount
  useEffect(() => {
    const savedView = localStorage.getItem(STORAGE_KEY) as TabView | null;
    if (savedView && (savedView === 'courses' || savedView === 'folders')) {
      setActiveTab(savedView);
    }
    setIsInitialized(true);
  }, []);

  // Save preference to localStorage when changed
  const handleTabChange = (tab: TabView) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY, tab);
  };

  // Prevent flash of wrong content during hydration
  if (!isInitialized) {
    return (
      <div className="animate-pulse">
        <div className={`h-14 rounded-full w-72 mx-auto mb-6 ${isDark ? 'bg-neutral-800' : 'bg-gray-100'}`} />
        <div className={`h-64 rounded-2xl ${isDark ? 'bg-neutral-800' : 'bg-gray-100'}`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Switcher Header */}
      <div className="flex justify-center">
        {/* Pill Switcher */}
        <div className={`inline-flex rounded-full p-1 shadow-inner ${
          isDark ? 'bg-neutral-800' : 'bg-gray-100'
        }`}>
          {/* Courses Tab */}
          <button
            onClick={() => handleTabChange('courses')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${
              activeTab === 'courses'
                ? 'bg-orange-500 text-white shadow-md'
                : isDark
                  ? 'text-neutral-400 hover:text-neutral-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{translate('tab_courses')}</span>
            {coursesCount > 0 && (
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold transition-colors duration-200 ${
                  activeTab === 'courses'
                    ? 'bg-white/20 text-white'
                    : isDark
                      ? 'bg-neutral-700 text-neutral-300'
                      : 'bg-gray-200 text-gray-600'
                }`}
              >
                {coursesCount}
              </span>
            )}
          </button>

          {/* Folders Tab */}
          <button
            onClick={() => handleTabChange('folders')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${
              activeTab === 'folders'
                ? 'bg-orange-500 text-white shadow-md'
                : isDark
                  ? 'text-neutral-400 hover:text-neutral-200'
                  : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>{translate('tab_folders')}</span>
            {foldersCount > 0 && (
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold transition-colors duration-200 ${
                  activeTab === 'folders'
                    ? 'bg-white/20 text-white'
                    : isDark
                      ? 'bg-neutral-700 text-neutral-300'
                      : 'bg-gray-200 text-gray-600'
                }`}
              >
                {foldersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="relative overflow-hidden">
        {/* Courses View */}
        <div
          className={`transition-all duration-300 ease-out ${
            activeTab === 'courses'
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 -translate-x-4 absolute inset-0 pointer-events-none'
          }`}
        >
          {activeTab === 'courses' && coursesContent}
        </div>

        {/* Folders View */}
        <div
          className={`transition-all duration-300 ease-out ${
            activeTab === 'folders'
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 translate-x-4 absolute inset-0 pointer-events-none'
          }`}
        >
          {activeTab === 'folders' && foldersContent}
        </div>
      </div>
    </div>
  );
}
