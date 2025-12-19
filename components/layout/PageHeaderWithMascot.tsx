'use client';

import Image from 'next/image';
import TopBarActions from './TopBarActions';
import { useTheme } from '@/contexts/ThemeContext';

interface PageHeaderWithMascotProps {
  title: string;
  subtitle?: string;
  hideMyCoursesButton?: boolean;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  showDarkModeToggle?: boolean;
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
      <div className={`${maxWidthClass} mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4`}>
        {/* Left side: Mascot + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo"
            width={80}
            height={80}
            className="rounded-2xl flex-shrink-0"
          />
          <div className="min-w-0">
            {subtitle && (
              <p className={`text-xs font-medium mb-0.5 truncate ${
                isDark && showDarkModeToggle ? 'text-orange-400' : 'text-orange-600'
              }`}>
                {subtitle}
              </p>
            )}
            <h1 className={`text-lg font-bold truncate ${
              isDark && showDarkModeToggle ? 'text-neutral-50' : 'text-gray-900'
            }`}>{title}</h1>
          </div>
        </div>

        {/* Right side: TopBarActions */}
        <div className="flex-shrink-0">
          <TopBarActions hideMyCoursesButton={hideMyCoursesButton} showDarkModeToggle={showDarkModeToggle} />
        </div>
      </div>
    </header>
  );
}
