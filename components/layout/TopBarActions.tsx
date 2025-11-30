'use client';

import { useState } from 'react';
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
  const [showSignupModal, setShowSignupModal] = useState(false);

  const handleMyCoursesClick = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      setShowSignupModal(true);
    }
  };

  return (
    <>
      <div className={`flex items-center gap-3 ${className || ''}`}>
        <LanguageToggle />
        {!hideMyCoursesButton && (
          <button
            onClick={handleMyCoursesClick}
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

      {showSignupModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {translate('course_detail_signup_dashboard_title')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {translate('course_detail_signup_dashboard_message')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignupModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                {translate('cancel')}
              </button>
              <button
                onClick={() => router.push('/auth/signup')}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                {translate('auth_signup_button')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
