'use client';

import Image from 'next/image';
import { LayoutList } from 'lucide-react';
import TopBarActions from './TopBarActions';
import { useTheme } from '@/contexts/ThemeContext';

interface PageHeaderWithMascotProps {
  title: string;
  subtitle?: string;
  hideMyCoursesButton?: boolean;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  showDarkModeToggle?: boolean;
  hideTopBarActions?: boolean;
  onOpenCourseDrawer?: () => void;
}

/**
 * Reusable page header component with Nareo mascot
 * Used on dashboard, learn, and quiz pages for consistent branding
 */
export default function PageHeaderWithMascot({
  title,
  subtitle,
  hideMyCoursesButton = false,
  maxWidth = '5xl',
  showDarkModeToggle = false,
  hideTopBarActions = false,
  onOpenCourseDrawer,
}: PageHeaderWithMascotProps) {
  const { isDark } = useTheme();

  const maxWidthClass = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  }[maxWidth];

  return (
    <header className={`border-b transition-colors sticky top-0 z-50 backdrop-blur-xl ${
      isDark && showDarkModeToggle
        ? 'bg-neutral-900/95 border-neutral-800'
        : 'bg-white/95 border-gray-200'
    }`}>
      <div className={`${maxWidthClass} mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-between gap-3`}>
        {/* Left side: Mascot + Title + Course Drawer Button */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo"
            width={48}
            height={48}
            className="rounded-xl flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            {subtitle && (
              <p className={`text-[10px] font-medium mb-0 truncate ${
                isDark && showDarkModeToggle ? 'text-orange-400' : 'text-orange-600'
              }`}>
                {subtitle}
              </p>
            )}
            <div className="flex items-center gap-1.5">
              <h1 className={`text-sm font-bold truncate ${
                isDark && showDarkModeToggle ? 'text-neutral-50' : 'text-gray-900'
              }`}>{title}</h1>
              {onOpenCourseDrawer && (
                <button
                  onClick={onOpenCourseDrawer}
                  className={`p-1 rounded-lg transition-colors flex-shrink-0 ${
                    isDark
                      ? 'hover:bg-neutral-800 text-neutral-400 hover:text-orange-400'
                      : 'hover:bg-orange-50 text-gray-400 hover:text-orange-500'
                  }`}
                  title="Changer de cours"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right side: TopBarActions */}
        {!hideTopBarActions && (
          <div className="flex-shrink-0">
            <TopBarActions hideMyCoursesButton={hideMyCoursesButton} showDarkModeToggle={showDarkModeToggle} />
          </div>
        )}
      </div>
    </header>
  );
}
