'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Menu, X, Moon, Sun, BookOpen, LogOut, LogIn, UserPlus, Globe, User, GraduationCap, Gamepad2, Users, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface WorkingPageMenuProps {
  hideMyCoursesButton?: boolean;
}

interface UserProfile {
  full_name: string | null;
  avatar_url: string | null;
  isPremium: boolean;
}

const LANGUAGE_OPTIONS: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

// Get user initials from name or email
function getUserInitials(fullName: string | null, email: string | null): string {
  if (fullName) {
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  }

  if (email) {
    return email.substring(0, 2).toUpperCase();
  }

  return '?';
}

export default function WorkingPageMenu({ hideMyCoursesButton = false }: WorkingPageMenuProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { translate, currentLanguage, setLanguage } = useLanguage();
  const { toggleTheme, isDark } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch user profile
  useEffect(() => {
    if (user) {
      fetch('/api/profile', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.profile) {
            setProfile({
              full_name: data.profile.full_name,
              avatar_url: data.profile.avatar_url,
              isPremium: data.profile.isPremium || false,
            });
          }
        })
        .catch(err => console.error('Error fetching profile:', err));
    } else {
      setProfile(null);
    }
  }, [user]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.push('/');
  };

  const handleMyCoursesClick = () => {
    setMenuOpen(false);
    router.push('/dashboard');
  };

  const userEmail = user?.email || null;
  const userName = profile?.full_name || null;
  const userInitials = getUserInitials(userName, userEmail);

  return (
    <div className="flex items-center gap-2" ref={menuRef}>
      {/* Upgrade Button - Only for non-premium logged-in users */}
      {user && profile && !profile.isPremium && (
        <button
          onClick={() => router.push('/paywall')}
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-medium leading-none transition-all duration-200 shadow-sm hover:shadow-md hover:from-orange-600 hover:to-orange-700"
        >
          <GraduationCap className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">{translate('upgrade_button')}</span>
        </button>
      )}

      {/* My Courses Button - Direct access for logged-in users */}
      {user && !hideMyCoursesButton && (
        <button
          onClick={() => router.push('/dashboard')}
          className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full border text-sm font-medium leading-none transition-all duration-200 shadow-sm hover:shadow-md ${
            isDark
              ? 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <BookOpen className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">{translate('my_courses_button')}</span>
        </button>
      )}

      {/* Menu Button - Avatar for logged-in users, Hamburger for guests */}
      <div className="relative">
        <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={`flex items-center justify-center w-10 h-10 rounded-full border-0 transition-all duration-200 overflow-hidden ${
          user
            ? profile?.avatar_url
              ? 'shadow-md hover:shadow-lg ring-1 ring-black/5 hover:ring-black/10'
              : 'bg-gradient-to-br from-orange-500 to-orange-600 shadow-md hover:shadow-lg hover:from-orange-600 hover:to-orange-700'
            : isDark
              ? 'bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 shadow-sm hover:shadow-md'
              : 'bg-white border border-gray-200 hover:bg-gray-50 shadow-sm hover:shadow-md'
        }`}
        aria-label="Menu"
        aria-expanded={menuOpen}
      >
        {user ? (
          profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt="Avatar"
              width={40}
              height={40}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <span className="text-sm font-bold text-white">{userInitials}</span>
          )
        ) : menuOpen ? (
          <X className={`w-5 h-5 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`} />
        ) : (
          <Menu className={`w-5 h-5 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`} />
        )}
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div className={`absolute top-full right-0 mt-2 w-72 border rounded-xl shadow-lg z-50 overflow-hidden max-h-[calc(100vh-80px)] overflow-y-auto ${
          isDark
            ? 'bg-neutral-900 border-neutral-700'
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex flex-col">
            {/* User Info Header - Only for logged-in users */}
            {user && (
              <div className={`px-3 py-2 border-b ${
                isDark ? 'border-neutral-800 bg-neutral-800/50' : 'border-gray-100 bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                    {profile?.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt="Avatar"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="text-xs font-bold text-white">{userInitials}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {userName && (
                      <p className={`text-xs font-semibold truncate ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
                        {userName}
                      </p>
                    )}
                    <p className={`text-[10px] truncate ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                      {userEmail}
                    </p>
                  </div>
                </div>
              </div>
            )}

          <div className="flex flex-col p-2 gap-1">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className={`flex items-center justify-between h-9 px-3 rounded-lg text-xs font-medium transition-colors ${
                isDark
                  ? 'text-neutral-300 hover:bg-neutral-800'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                {isDark ? <Sun className="w-3.5 h-3.5 text-yellow-500" /> : <Moon className="w-3.5 h-3.5" />}
                {isDark ? translate('theme_light') : translate('theme_dark')}
              </span>
              <span className={`w-8 h-5 rounded-full relative transition-colors ${isDark ? 'bg-orange-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isDark ? 'right-0.5' : 'left-0.5'}`} />
              </span>
            </button>

            {/* Language Selection */}
            <div className={`border rounded-lg overflow-hidden ${
              isDark ? 'border-neutral-700' : 'border-gray-200'
            }`}>
              <p className={`px-2 py-1 text-[10px] font-semibold flex items-center gap-1.5 ${
                isDark ? 'text-neutral-400 bg-neutral-800' : 'text-gray-500 bg-gray-50'
              }`}>
                <Globe className="w-3 h-3" />
                {translate('language_label') || 'Language'}
              </p>
              <div className="flex">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium transition-colors ${
                      currentLanguage === lang.code
                        ? isDark
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-orange-50 text-orange-600'
                        : isDark
                          ? 'text-neutral-300 hover:bg-neutral-800'
                          : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.code.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className={`h-px ${isDark ? 'bg-neutral-800' : 'bg-gray-100'}`} />

            {/* Auth buttons */}
            {user ? (
              <>
                {/* Challenge Mode */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push('/defi');
                  }}
                  className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium transition-colors ${
                    isDark
                      ? 'text-neutral-300 hover:bg-neutral-800'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Gamepad2 className="w-3.5 h-3.5 text-green-500" />
                  {translate('challenge_mode') || 'Mode Défi'}
                </button>
                {/* Friends */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push('/amis');
                  }}
                  className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium transition-colors ${
                    isDark
                      ? 'text-neutral-300 hover:bg-neutral-800'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  {translate('friends') || 'Amis'}
                </button>
                {/* Leaderboard */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push('/classement');
                  }}
                  className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium transition-colors ${
                    isDark
                      ? 'text-neutral-300 hover:bg-neutral-800'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                  {translate('leaderboard') || 'Classement'}
                </button>

                {/* Divider */}
                <div className={`h-px my-0.5 ${isDark ? 'bg-neutral-800' : 'bg-gray-100'}`} />

                {/* My Account */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push('/compte');
                  }}
                  className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium transition-colors ${
                    isDark
                      ? 'text-neutral-300 hover:bg-neutral-800'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  {translate('my_account_button')}
                </button>
                {/* Sign Out */}
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    color: isDark ? '#e94446' : '#d91a1c',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(217, 26, 28, 0.1)' : '#fff6f3'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {translate('signout_button')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push('/auth/signin');
                  }}
                  className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium transition-colors ${
                    isDark
                      ? 'text-neutral-300 hover:bg-neutral-800'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  {translate('auth_signin_button')}
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push('/auth/signup');
                  }}
                  className="flex items-center justify-center gap-2 h-9 px-3 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {translate('auth_signup_button')}
                </button>
              </>
            )}
          </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
