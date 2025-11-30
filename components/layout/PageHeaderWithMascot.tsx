'use client';

import Image from 'next/image';
import TopBarActions from './TopBarActions';

interface PageHeaderWithMascotProps {
  title: string;
  subtitle?: string;
  hideMyCoursesButton?: boolean;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
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
}: PageHeaderWithMascotProps) {
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
    <header className="bg-white border-b border-gray-200">
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
              <p className="text-xs font-medium text-orange-600 mb-0.5 truncate">
                {subtitle}
              </p>
            )}
            <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
          </div>
        </div>

        {/* Right side: TopBarActions */}
        <div className="flex-shrink-0">
          <TopBarActions hideMyCoursesButton={hideMyCoursesButton} />
        </div>
      </div>
    </header>
  );
}
