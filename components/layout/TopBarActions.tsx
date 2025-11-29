'use client';

import { useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageToggle from './LanguageToggle';
import SignOutButton from './SignOutButton';

interface TopBarActionsProps {
  className?: string;
  hideMyCoursesButton?: boolean;
}

export default function TopBarActions({ className, hideMyCoursesButton = false }: TopBarActionsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { translate } = useLanguage();

  return (
    <div className={`flex items-center gap-3 ${className || ''}`}>
      <LanguageToggle />
      {user && !hideMyCoursesButton && (
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 h-10 px-4 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <BookOpen className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            {translate('my_courses_button')}
          </span>
        </button>
      )}
      <SignOutButton />
    </div>
  );
}
