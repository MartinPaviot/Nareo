'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import LanguageToggle from './LanguageToggle';
import SignOutButton from './SignOutButton';

interface TopBarActionsProps {
  className?: string;
  hideMyCoursesButton?: boolean;
}

// Language options for mobile menu
const LANGUAGE_OPTIONS: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

export default function TopBarActions({ className, hideMyCoursesButton = false }: TopBarActionsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { translate, currentLanguage, setLanguage } = useLanguage();
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMyCoursesClick = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      setShowSignupModal(true);
    }
  };

  return (
    <>
      {/* Desktop version */}
      <div className={`hidden sm:flex items-center gap-3 ${className || ''}`}>
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

      {/* Mobile version - hamburger menu */}
      <div className="sm:hidden relative">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
        </button>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
            <div className="flex flex-col p-3 gap-2">
              {/* My Courses */}
              {!hideMyCoursesButton && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleMyCoursesClick();
                  }}
                  className="flex items-center justify-center h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  {translate('my_courses_button')}
                </button>
              )}

              {/* Language Selection */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <p className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                  {translate('language_label') || 'Langue'}
                </p>
                <div className="flex">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-sm font-medium transition-colors ${
                        currentLanguage === lang.code
                          ? 'bg-orange-50 text-orange-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.code.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Auth buttons */}
              {user ? (
                <SignOutButton className="flex items-center justify-center h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50" />
              ) : (
                <>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      router.push('/auth/signin');
                    }}
                    className="flex items-center justify-center h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {translate('auth_signin_button')}
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      router.push('/auth/signup');
                    }}
                    className="flex items-center justify-center h-11 px-4 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600"
                  >
                    {translate('auth_signup_button')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
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
