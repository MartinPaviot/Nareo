'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { BookOpen, FolderOpen } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type TabView = 'courses' | 'folders';

const STORAGE_KEY = 'aristo_dashboard_view';

const MASCOT_IMAGES: Record<TabView, string> = {
  courses: '/chat/Happy.png',
  folders: '/chat/Drag_and_Drop.png',
};

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
        <div className="h-14 bg-gray-100 rounded-full w-72 mx-auto mb-6" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Switcher Header */}
      <div className="flex items-center justify-center gap-4">
        {/* Pill Switcher */}
        <div className="relative flex bg-gray-100 rounded-full p-1.5 shadow-inner">
          {/* Animated Background Pill */}
          <div
            className={`absolute top-1.5 bottom-1.5 rounded-full bg-orange-500 shadow-md transition-all duration-300 ease-out ${
              activeTab === 'courses' ? 'left-1.5 w-[calc(50%-6px)]' : 'left-[calc(50%+3px)] w-[calc(50%-6px)]'
            }`}
          />

          {/* Courses Tab */}
          <button
            onClick={() => handleTabChange('courses')}
            className={`relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-colors duration-200 ${
              activeTab === 'courses'
                ? 'text-white'
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
            className={`relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-colors duration-200 ${
              activeTab === 'folders'
                ? 'text-white'
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
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {foldersCount}
              </span>
            )}
          </button>
        </div>

        {/* Mascot */}
        <div className="relative flex-shrink-0 hidden sm:block">
          <div className="relative w-12 h-12">
            <Image
              key={activeTab}
              src={MASCOT_IMAGES[activeTab]}
              alt="Nareo mascot"
              width={48}
              height={48}
              className="object-contain drop-shadow-md animate-fadeIn"
            />
          </div>
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
