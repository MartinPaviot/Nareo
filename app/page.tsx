'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import TopBarActions from '@/components/layout/TopBarActions';
import SignOutButton from '@/components/layout/SignOutButton';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { trackEvent } from '@/lib/posthog';
import { HomeTestimonials } from '@/components/home/Testimonials';
import FAQ from '@/components/home/FAQ';
import GlobalDropZone from '@/components/upload/GlobalDropZone';

// Landing page components
import {
  HeroSection,
  WhyQuizzesSection,
  HowItWorksSection,
  SubjectsMarquee,
  UploadSection,
  PricingSection,
  FinalCTA,
} from '@/components/landing';

const LANGUAGE_OPTIONS: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

export default function HomePage() {
  const router = useRouter();
  const { translate, currentLanguage, setLanguage } = useLanguage();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Track page view with comprehensive context
  useEffect(() => {
    const startTime = Date.now();
    const referrer = document.referrer;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isMobile = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;
    const deviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

    trackEvent('home_page_viewed', {
      userId: user?.id,
      isAuthenticated: !!user,
      referrer,
      screenWidth,
      screenHeight,
      deviceType,
      userAgent: navigator.userAgent,
      language: navigator.language,
    });

    const handleBeforeUnload = () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      trackEvent('home_page_exit', {
        userId: user?.id,
        timeSpentSeconds: timeSpent,
        scrolledToUpload: document.getElementById('upload')?.getBoundingClientRect().top !== undefined,
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user]);

  // Track scroll depth
  useEffect(() => {
    let maxScrollDepth = 0;
    const sections = ['how-it-works', 'upload'];

    const handleScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );

      const milestones = [25, 50, 75, 100];
      for (const milestone of milestones) {
        if (scrollPercent >= milestone && maxScrollDepth < milestone) {
          trackEvent('home_scroll_depth', {
            userId: user?.id,
            depth: milestone,
          });
          maxScrollDepth = milestone;
        }
      }

      sections.forEach((sectionId) => {
        const section = document.getElementById(sectionId);
        if (section) {
          const rect = section.getBoundingClientRect();
          const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
          if (isVisible && !section.dataset.tracked) {
            section.dataset.tracked = 'true';
            trackEvent('home_section_viewed', {
              userId: user?.id,
              section: sectionId,
            });
          }
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [user]);

  // Track CTA button clicks
  const handleCtaClick = (ctaName: string, destination?: string) => {
    trackEvent('home_cta_clicked', {
      userId: user?.id,
      ctaName,
      destination,
      isAuthenticated: !!user,
    });
  };

  return (
    <GlobalDropZone>
      <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-orange-50">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-gradient-to-b from-orange-50 to-white/95 backdrop-blur-sm border-b border-orange-100/50 flex items-center justify-between px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo Mascotte"
            width={40}
            height={40}
            className="rounded-xl"
          />
          <p className="text-base font-semibold text-gray-900">Nareo</p>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center gap-2">
          <TopBarActions />
        </div>

        {/* Mobile Navigation */}
        <div className="flex sm:hidden items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg sm:hidden">
            <div className="flex flex-col p-4 gap-3">
              {user && (
                <button
                  onClick={() => {
                    handleCtaClick('header_my_courses', '/dashboard');
                    setMobileMenuOpen(false);
                    router.push('/dashboard');
                  }}
                  className="flex items-center justify-center h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {translate('my_courses_button')}
                </button>
              )}

              {/* Language Selection */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <p className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50">{translate('language_label') || 'Langue'}</p>
                <div className="flex">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
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
              {!user ? (
                <>
                  <button
                    onClick={() => {
                      handleCtaClick('header_signin', '/auth/signin');
                      setMobileMenuOpen(false);
                      router.push('/auth/signin');
                    }}
                    className="flex items-center justify-center h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {translate('auth_signin_button')}
                  </button>
                  <button
                    onClick={() => {
                      handleCtaClick('header_signup', '/auth/signup');
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
              ) : (
                <SignOutButton className="flex items-center justify-center h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50" />
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="px-5 sm:px-6 pb-12 pt-4">
        <div className="max-w-5xl mx-auto space-y-12">
          {/* Hero Section */}
          <HeroSection translate={translate} onCtaClick={handleCtaClick} />

          {/* Why Quizzes */}
          <WhyQuizzesSection translate={translate} />

          {/* How It Works */}
          <HowItWorksSection translate={translate} />

          {/* Subjects Marquee */}
          <SubjectsMarquee translate={translate} />

          {/* Upload Section */}
          <UploadSection
            translate={translate}
            onCtaClick={handleCtaClick}
            userId={user?.id}
          />

          {/* Testimonials */}
          <HomeTestimonials />

          {/* Pricing */}
          <PricingSection
            translate={translate}
            currentLanguage={currentLanguage}
            onCtaClick={handleCtaClick}
            user={user}
          />

          {/* FAQ */}
          <FAQ />

          {/* Final CTA */}
          <FinalCTA translate={translate} onCtaClick={handleCtaClick} />
        </div>
      </main>
      </div>
    </GlobalDropZone>
  );
}
