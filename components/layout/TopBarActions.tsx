'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, GraduationCap, Menu, X, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import LanguageToggle from './LanguageToggle';
import SignOutButton from './SignOutButton';
import WorkingPageMenu from './WorkingPageMenu';

interface TopBarActionsProps {
  className?: string;
  hideMyCoursesButton?: boolean;
  showDarkModeToggle?: boolean; // Only show on working pages
  hideLanguageToggle?: boolean; // Hide language toggle on landing page
}

// Language options for mobile menu
const LANGUAGE_OPTIONS: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

export default function TopBarActions({ className, hideMyCoursesButton = false, showDarkModeToggle = false, hideLanguageToggle = false }: TopBarActionsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { translate, currentLanguage, setLanguage } = useLanguage();
  const { toggleTheme, isDark } = useTheme();
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPremium, setIsPremium] = useState(true); // Default to true to avoid flash

  // Fetch user profile to check premium status
  useEffect(() => {
    if (user) {
      fetch('/api/profile', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.profile) {
            setIsPremium(data.profile.isPremium || false);
          }
        })
        .catch(err => console.error('Error fetching profile:', err));
    }
  }, [user]);

  const handleMyCoursesClick = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      setShowSignupModal(true);
    }
  };

  // On working pages (showDarkModeToggle=true), use the unified menu for all screen sizes
  if (showDarkModeToggle) {
    return <WorkingPageMenu hideMyCoursesButton={hideMyCoursesButton} />;
  }

  // Non-working pages: keep original behavior (desktop buttons + mobile hamburger)
  return (
    <>
      {/* Desktop version */}
      <div className={`hidden sm:flex items-center gap-3 ${className || ''}`}>
        {/* Upgrade Button - Only for non-premium logged-in users */}
        {user && !isPremium && (
          <button
            onClick={() => router.push('/paywall')}
            className="flex items-center gap-1.5 h-10 px-4 rounded-full text-white transition-all duration-200 shadow-sm hover:shadow-md"
            style={{ backgroundColor: '#ff751f' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
          >
            <GraduationCap className="w-4 h-4" />
            <span className="text-sm font-medium">
              {translate('upgrade_button')}
            </span>
          </button>
        )}
        {!hideMyCoursesButton && user && (
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 h-10 px-4 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <BookOpen className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              {translate('my_courses_button')}
            </span>
          </button>
        )}
        {user ? (
          <SignOutButton />
        ) : (
          <>
            <button
              onClick={() => router.push('/auth/signin')}
              className="flex items-center gap-2 h-10 px-4 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <span className="text-sm font-medium text-gray-700">
                {translate('auth_signin_button')}
              </span>
            </button>
            <button
              onClick={() => router.push('/auth/signup')}
              className="flex items-center gap-2 h-10 px-4 rounded-full text-white transition-all duration-200 shadow-sm hover:shadow-md"
              style={{ backgroundColor: '#ff751f' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
            >
              <span className="text-sm font-medium">
                {translate('auth_signup_button')}
              </span>
            </button>
          </>
        )}
        {!hideLanguageToggle && <LanguageToggle />}
      </div>

      {/* Mobile version - hamburger menu */}
      <div className="sm:hidden flex items-center gap-2">
        {/* Sign up button visible directly on mobile for non-logged users */}
        {!user && (
          <button
            onClick={() => router.push('/auth/signup')}
            className="flex items-center h-9 px-3 rounded-full text-white text-sm font-medium transition-all duration-200 shadow-sm"
            style={{ backgroundColor: '#ff751f' }}
          >
            {translate('auth_signup_button')}
          </button>
        )}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="relative flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          aria-label="Menu"
        >
          {mobileMenuOpen ? (
            <X className="w-5 h-5 text-gray-700" />
          ) : (
            <Menu className="w-5 h-5 text-gray-700" />
          )}
        </button>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full right-0 mt-2 w-64 border border-gray-200 bg-white rounded-xl shadow-lg z-50">
            <div className="flex flex-col p-3 gap-2">
              {/* Upgrade Button - Only for non-premium logged-in users */}
              {user && !isPremium && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push('/paywall');
                  }}
                  className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-white text-sm font-semibold transition-colors"
                  style={{ backgroundColor: '#ff751f' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
                >
                  <GraduationCap className="w-4 h-4" />
                  {translate('upgrade_button')}
                </button>
              )}

              {/* My Courses - only show when user is logged in */}
              {!hideMyCoursesButton && user && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push('/dashboard');
                  }}
                  className="flex items-center justify-center h-11 px-4 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold transition-colors"
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
                <SignOutButton className="flex items-center justify-center h-11 px-4 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold transition-colors" />
              ) : (
                <>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      router.push('/auth/signin');
                    }}
                    className="flex items-center justify-center h-11 px-4 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold transition-colors"
                  >
                    {translate('auth_signin_button')}
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      router.push('/auth/signup');
                    }}
                    className="flex items-center justify-center h-11 px-4 rounded-xl text-white text-sm font-semibold transition-colors"
                    style={{ backgroundColor: '#ff751f' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
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
          <div className="rounded-2xl max-w-md w-full p-6 shadow-xl bg-white">
            <h3 className="text-xl font-bold mb-2 text-gray-900">
              {translate('course_detail_signup_dashboard_title')}
            </h3>
            <p className="text-sm mb-4 text-gray-600">
              {translate('course_detail_signup_dashboard_message')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignupModal(false)}
                className="flex-1 px-4 py-3 rounded-xl font-semibold transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                {translate('cancel')}
              </button>
              <button
                onClick={() => router.push('/auth/signup')}
                className="flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-colors"
                style={{ backgroundColor: '#ff751f' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
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
