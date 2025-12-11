'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  LayoutList,
  Loader2,
  Menu,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  X,
} from 'lucide-react';
import TopBarActions from '@/components/layout/TopBarActions';
import SignOutButton from '@/components/layout/SignOutButton';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { trackEvent } from '@/lib/posthog';
import { HomeTestimonials } from '@/components/home/Testimonials';

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const MAX_IMAGES = 6;

function formatSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Cookie utilities for guest session
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days: number = 30): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

// Generate or retrieve guest session ID for anonymous uploads
// Uses BOTH cookies AND localStorage for maximum persistence:
// - Cookie: works across tabs in same session
// - localStorage: survives email verification redirect (SameSite=Lax blocks cookies from email links)
function getOrCreateGuestSessionId(): string {
  if (typeof window === 'undefined') return '';

  // Try cookie first, then localStorage
  let guestSessionId = getCookie('guestSessionId') || localStorage.getItem('guestSessionId');

  if (!guestSessionId) {
    guestSessionId = crypto.randomUUID();
  }

  // Always store in both places for redundancy
  setCookie('guestSessionId', guestSessionId, 30); // 30 days expiry
  localStorage.setItem('guestSessionId', guestSessionId);

  return guestSessionId;
}

export default function HomePage() {
  const router = useRouter();
  const { translate, currentLanguage, setLanguage } = useLanguage();
  const { user } = useAuth();

  // Language options for mobile menu
  const LANGUAGE_OPTIONS: { code: Language; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  ];
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Preview carousel data
  const previewSlides = [
    {
      icon: LayoutList,
      titleKey: 'home_preview_chapters_title' as const,
      descKey: 'home_preview_chapters_desc' as const,
      image: '/images/chapitres.png',
      alt: 'Chapitres structurés',
      iconSize: 'w-7 h-7',
    },
    {
      icon: CircleHelp,
      titleKey: 'home_preview_quiz_title' as const,
      descKey: 'home_preview_quiz_desc' as const,
      image: '/images/quizz.png',
      alt: 'Quiz interactifs',
      iconSize: 'w-7 h-7',
    },
    {
      icon: Target,
      titleKey: 'home_preview_feedback_title' as const,
      descKey: 'home_preview_feedback_desc' as const,
      image: '/images/feedback.png',
      alt: 'Analyse de performance',
      iconSize: 'w-6 h-6',
    },
  ];

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

    // Track time spent on page when leaving
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

      // Track 25%, 50%, 75%, 100% milestones
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

      // Track section visibility
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

  // Auto-play carousel every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPreviewIndex((prev) => (prev === previewSlides.length - 1 ? 0 : prev + 1));
    }, 5000);

    return () => clearInterval(interval);
  }, [previewSlides.length]);

  const handleFiles = (incoming: FileList | null, source: 'drop' | 'file_picker' | 'camera' = 'file_picker') => {
    if (!incoming) return;

    const allFiles = Array.from(incoming);
    const selected = allFiles.filter((file) => ACCEPTED_TYPES.includes(file.type));
    const rejected = allFiles.filter((file) => !ACCEPTED_TYPES.includes(file.type));

    // Track file selection attempt
    trackEvent('home_file_selected', {
      userId: user?.id,
      source,
      totalFiles: allFiles.length,
      acceptedFiles: selected.length,
      rejectedFiles: rejected.length,
      fileTypes: allFiles.map((f) => f.type),
      fileSizes: allFiles.map((f) => f.size),
      totalSize: allFiles.reduce((sum, f) => sum + f.size, 0),
    });

    if (selected.length === 0) {
      trackEvent('home_file_error', {
        userId: user?.id,
        errorType: 'invalid_format',
        attemptedTypes: allFiles.map((f) => f.type),
      });
      setError(translate('upload_error_state'));
      return;
    }

    // Separate images and documents from incoming files
    const incomingImages = selected.filter((f) => f.type.startsWith('image/'));
    const incomingDocuments = selected.filter((f) => !f.type.startsWith('image/'));

    // Check existing files
    const existingImages = files.filter((f) => f.type.startsWith('image/'));
    const existingDocuments = files.filter((f) => !f.type.startsWith('image/'));

    // Rule: Only 1 document allowed (PDF, DOCX) OR multiple images (max 6)
    // Cannot mix documents and images

    // If user already has a document and tries to add more files
    if (existingDocuments.length > 0) {
      if (incomingDocuments.length > 0 || incomingImages.length > 0) {
        trackEvent('home_file_error', {
          userId: user?.id,
          errorType: 'document_already_selected',
          existingDocument: existingDocuments[0].name,
        });
        setError(translate('upload_error_document_exists') || 'Vous avez déjà sélectionné un document. Supprimez-le pour en choisir un autre.');
        return;
      }
    }

    // If user already has images and tries to add a document
    if (existingImages.length > 0 && incomingDocuments.length > 0) {
      trackEvent('home_file_error', {
        userId: user?.id,
        errorType: 'mixed_file_types',
        existingImages: existingImages.length,
        incomingDocuments: incomingDocuments.length,
      });
      setError(translate('upload_error_mixed_types') || 'Vous avez déjà des images sélectionnées. Supprimez-les pour ajouter un document.');
      return;
    }

    // Cannot mix documents and images in the same selection
    if (incomingDocuments.length > 0 && incomingImages.length > 0) {
      trackEvent('home_file_error', {
        userId: user?.id,
        errorType: 'mixed_file_types',
        documentCount: incomingDocuments.length,
        imageCount: incomingImages.length,
      });
      setError(translate('upload_error_mixed_types') || 'Veuillez sélectionner soit un document, soit des images, mais pas les deux.');
      return;
    }

    // Only 1 document allowed
    if (incomingDocuments.length > 1) {
      trackEvent('home_file_error', {
        userId: user?.id,
        errorType: 'too_many_documents',
        documentCount: incomingDocuments.length,
      });
      setError(translate('upload_error_one_document') || 'Vous ne pouvez sélectionner qu\'un seul document (PDF ou DOCX) à la fois.');
      return;
    }

    // Calculate total images (existing + incoming)
    const totalImages = existingImages.length + incomingImages.length;
    if (totalImages > MAX_IMAGES) {
      trackEvent('home_file_error', {
        userId: user?.id,
        errorType: 'too_many_images',
        imageCount: totalImages,
        maxAllowed: MAX_IMAGES,
      });
      setError(translate('upload_limit_images') || `Vous ne pouvez pas ajouter plus de ${MAX_IMAGES} images.`);
      return;
    }

    // Set files: either 1 document or up to 6 images
    if (incomingDocuments.length === 1) {
      setFiles([incomingDocuments[0]]);
    } else if (incomingImages.length > 0) {
      // Add incoming images to existing images
      const newImages = [...existingImages, ...incomingImages].slice(0, MAX_IMAGES);
      setFiles(newImages);
    }
    setError(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    trackEvent('home_file_dropped', { userId: user?.id });
    handleFiles(event.dataTransfer.files, 'drop');
  };

  const handleDragEnter = () => {
    if (!isDragging) {
      trackEvent('home_drag_started', { userId: user?.id });
    }
    setIsDragging(true);
  };

  const handleStart = async () => {
    if (!files.length) {
      trackEvent('home_upload_clicked_empty', { userId: user?.id });
      setError(translate('upload_action_waiting'));
      return;
    }

    const uploadStartTime = Date.now();
    const file = files[0];

    trackEvent('home_upload_started', {
      userId: user?.id,
      isGuest: !user,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
    });

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // For guests (not logged in), include guestSessionId for later linking
      if (!user) {
        const guestSessionId = getOrCreateGuestSessionId();
        formData.append('guestSessionId', guestSessionId);
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();
      const uploadDuration = Date.now() - uploadStartTime;

      if (!response.ok) {
        trackEvent('home_upload_failed', {
          userId: user?.id,
          isGuest: !user,
          error: data?.error,
          statusCode: response.status,
          uploadDurationMs: uploadDuration,
        });
        throw new Error(data?.error || 'Upload failed');
      }

      trackEvent('home_upload_success', {
        userId: user?.id,
        isGuest: !user,
        courseId: data.courseId,
        uploadDurationMs: uploadDuration,
        fileType: file.type,
        fileSize: file.size,
      });

      router.push(`/courses/${data.courseId}/learn`);
    } catch (uploadError) {
      console.error('Upload error', uploadError);
      const errorMessage = uploadError instanceof Error ? uploadError.message : translate('upload_error_state');

      trackEvent('home_upload_error', {
        userId: user?.id,
        errorMessage,
        uploadDurationMs: Date.now() - uploadStartTime,
      });

      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemove = (name: string) => {
    trackEvent('home_file_removed', {
      userId: user?.id,
      fileName: name,
      remainingFiles: files.length - 1,
    });
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  // Track CTA button clicks
  const handleCtaClick = (ctaName: string, destination?: string) => {
    trackEvent('home_cta_clicked', {
      userId: user?.id,
      ctaName,
      destination,
      isAuthenticated: !!user,
    });
  };

  // Track carousel navigation
  const handleCarouselNav = (direction: 'prev' | 'next' | 'dot', newIndex: number) => {
    trackEvent('home_carousel_navigated', {
      userId: user?.id,
      direction,
      fromIndex: previewIndex,
      toIndex: newIndex,
      slideName: previewSlides[newIndex]?.titleKey,
    });
    setPreviewIndex(newIndex);
  };

  const renderStateBadge = () => {
    if (isProcessing) {
      return (
        <div className="flex items-center gap-2 text-orange-700 bg-orange-50 border border-orange-100 px-3 py-2 rounded-full text-xs font-semibold">
          <Loader2 className="w-4 h-4 animate-spin" />
          {translate('upload_processing_title')}
        </div>
      );
    }
    if (files.length) {
      return (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-full text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          {translate('upload_after_state_title')}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-orange-50">
      <header className="sticky top-0 z-50 bg-gradient-to-b from-orange-50 to-white/95 backdrop-blur-sm border-b border-orange-100/50 flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo Mascotte"
            width={100}
            height={100}
            className="rounded-2xl"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">Nareo</p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center gap-3">
          {!user && (
            <>
              <button
                onClick={() => {
                  handleCtaClick('header_signin', '/auth/signin');
                  router.push('/auth/signin');
                }}
                className="inline-flex items-center justify-center h-10 px-4 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {translate('auth_signin_button')}
              </button>
              <button
                onClick={() => {
                  handleCtaClick('header_signup', '/auth/signup');
                  router.push('/auth/signup');
                }}
                className="inline-flex items-center justify-center h-10 px-4 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600"
              >
                {translate('auth_signup_button')}
              </button>
            </>
          )}
          <TopBarActions />
        </div>

        {/* Mobile Navigation - Only hamburger menu button */}
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
              {/* My Courses */}
              <button
                onClick={() => {
                  handleCtaClick('header_my_courses', '/dashboard');
                  setMobileMenuOpen(false);
                  router.push('/dashboard');
                }}
                className="flex items-center justify-center h-12 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {translate('my_courses_button')}
              </button>

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
                    className="flex items-center justify-center h-12 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {translate('auth_signin_button')}
                  </button>
                  <button
                    onClick={() => {
                      handleCtaClick('header_signup', '/auth/signup');
                      setMobileMenuOpen(false);
                      router.push('/auth/signup');
                    }}
                    className="flex items-center justify-center h-12 px-4 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600"
                  >
                    {translate('auth_signup_button')}
                  </button>
                </>
              ) : (
                <SignOutButton className="flex items-center justify-center h-12 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50" />
              )}
            </div>
          </div>
        )}
      </header>

      <main className="px-4 sm:px-6 pb-12 pt-8">
        <div className="max-w-5xl mx-auto space-y-12">
          {/* Hero section: left content + larger right card for visual balance */}
          <section className="flex flex-col lg:flex-row items-center gap-10 mb-12">
            <div className="flex-1 space-y-5 text-center lg:text-left">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-snug">
                {translate('home_hero_title')}
              </h1>
              <p className="text-xl text-gray-700">
                {translate('home_hero_subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
                <button
                  onClick={() => {
                    handleCtaClick('hero_primary', '#upload');
                    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center justify-center h-12 px-6 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 shadow-md"
                >
                  {translate('home_hero_cta_primary')}
                </button>
                <button
                  onClick={() => {
                    handleCtaClick('hero_secondary', '#how-it-works');
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="sm:hidden inline-flex items-center justify-center h-12 px-6 rounded-xl border border-orange-200 text-orange-700 font-semibold bg-white hover:bg-orange-50"
                >
                  {translate('home_hero_cta_secondary')}
                </button>
              </div>
            </div>
            <div className="flex-1 w-full">
              {/* Hero right card: mascot center-left, benefits right in single row */}
              <div className="w-full rounded-3xl border border-orange-100 shadow-xl bg-white px-4 py-6 md:px-6 md:py-8">
                <div className="flex flex-col md:flex-row items-center md:items-center gap-4 md:gap-6">
                  <div className="flex justify-center md:justify-start flex-shrink-0">
                    <Image
                      src="/chat/mascotte.png"
                      alt="Nareo mascot"
                      width={160}
                      height={160}
                      className="object-contain"
                      priority
                    />
                  </div>
                  <div className="flex flex-col md:flex-col gap-2 md:gap-3 w-full">
                    <span className="inline-flex items-center gap-2 px-4 py-2.5 md:px-4 md:py-2.5 rounded-full bg-white border border-orange-100 text-sm md:text-base font-semibold text-orange-700 shadow-sm whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      {translate('home_hero_tag1')}
                    </span>
                    <span className="inline-flex items-center gap-2 px-4 py-2.5 md:px-4 md:py-2.5 rounded-full bg-white border border-orange-100 text-sm md:text-base font-semibold text-orange-700 shadow-sm whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      {translate('home_hero_tag2')}
                    </span>
                    <span className="inline-flex items-center gap-2 px-4 py-2.5 md:px-4 md:py-2.5 rounded-full bg-white border border-orange-100 text-sm md:text-base font-semibold text-orange-700 shadow-sm whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      {translate('home_hero_tag3')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section id="how-it-works" className="mt-12 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {translate('home_hiw_title')}
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-orange-100 bg-white shadow-sm p-5 text-left space-y-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 text-orange-700 font-bold">1</div>
                <p className="text-lg font-semibold text-gray-900">{translate('home_hiw_step1_title')}</p>
                <p className="text-sm text-gray-600">{translate('home_hiw_step1_desc')}</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-white shadow-sm p-5 text-left space-y-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 text-orange-700 font-bold">2</div>
                <p className="text-lg font-semibold text-gray-900">{translate('home_hiw_step2_title')}</p>
                <p className="text-sm text-gray-600">{translate('home_hiw_step2_desc')}</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-white shadow-sm p-5 text-left space-y-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 text-orange-700 font-bold">3</div>
                <p className="text-lg font-semibold text-gray-900">{translate('home_hiw_step3_title')}</p>
                <p className="text-sm text-gray-600">{translate('home_hiw_step3_desc')}</p>
              </div>
            </div>
          </section>

          {/* Upload area */}
          <section id="upload" className="grid lg:grid-cols-1 gap-6 items-start">
            <div className="bg-white/80 backdrop-blur rounded-3xl border border-orange-100 shadow-lg p-4 sm:p-6">
              {/* Header - Title and subtitle with formats */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-900">
                    {translate('home_upload_title')}{' '}
                    <span className="relative inline-block">
                      <span className="relative z-10">{translate('home_upload_title_highlight')}</span>
                      <span className="absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-r from-orange-300 to-amber-300 -z-0 rounded-sm"></span>
                    </span>
                  </h2>
                  {renderStateBadge()}
                </div>
                <p className="text-sm text-gray-600">
                  {translate('home_upload_helper')}
                </p>
              </div>

              {/* Main dropzone */}
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  handleDragEnter();
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`block border-2 border-dashed rounded-2xl transition-all cursor-pointer ${
                  isDragging
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-200 bg-gray-50/80 hover:border-orange-300'
                } ${isProcessing ? 'opacity-75 pointer-events-none' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files, 'file_picker')}
                />
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4">
                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white shadow-lg">
                    <Upload className="w-8 h-8" />
                  </div>

                  {/* Dropzone hint */}
                  <p className="text-base font-semibold text-gray-900">
                    {translate('home_upload_drop_text')}
                  </p>

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-sm">
                    {/* Main button - always visible */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleCtaClick('upload_choose_file');
                        fileInputRef.current?.click();
                      }}
                      className="px-6 py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
                    >
                      {translate('home_upload_choose_file')}
                    </button>

                    {/* Camera button - mobile only */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleCtaClick('upload_use_camera');
                        cameraInputRef.current?.click();
                      }}
                      className="md:hidden px-6 py-3 rounded-xl border-2 border-gray-300 text-sm font-semibold text-gray-700 hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      {translate('home_upload_use_camera')}
                    </button>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files, 'camera')}
                    />
                  </div>

                  {/* Helper text for camera - mobile only */}
                  <p className="md:hidden text-xs text-gray-500 mt-2">
                    {translate('home_upload_camera_helper')}
                  </p>
                </div>
              </label>

              {/* Small footer text */}
              <p className="text-xs text-gray-400 mt-3 text-center">
                {translate('home_upload_limit')}
              </p>

              {files.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-800">
                      {translate('upload_selected_files')}
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                    >
                      {translate('upload_replace_files')}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div
                        key={file.name}
                        className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 bg-white"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {file.type || 'file'} - {formatSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemove(file.name)}
                          className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                          aria-label="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleStart}
                  disabled={isProcessing || !files.length}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-[60px] md:h-12 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {translate('upload_processing_title')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      {files.length ? translate('home_upload_cta_selected') : translate('home_hero_cta_primary')}
                    </>
                  )}
                </button>
                <div className="flex-1 h-[60px] md:h-12 inline-flex items-center justify-center rounded-xl border border-gray-200 text-sm text-gray-700 bg-white">
                  {files.length ? translate('upload_after_state_title') : translate('upload_action_waiting')}
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-semibold mb-1">{translate('upload_error_state')}</p>
                  <p>{error || translate('upload_error_state_help')}</p>
                </div>
              )}

              {isProcessing && (
                <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-3 text-sm text-orange-800">
                  <p className="font-semibold">{translate('upload_processing_title')}</p>
                  <p className="text-xs text-orange-700 mt-1">
                    {translate('upload_processing_subtitle')}
                  </p>
                </div>
              )}

            </div>
          </section>

          {/* Why quizzes */}
          <section className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">{translate('home_why_title')}</h2>
              <p className="text-sm text-gray-600">{translate('home_why_intro')}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-orange-100 bg-white shadow-sm p-5 space-y-2">
                  <p className="text-lg font-semibold text-gray-900">{translate(`home_why_point${i}_title` as const)}</p>
                  <p className="text-sm text-gray-600">{translate(`home_why_point${i}_desc` as const)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Preview - 2 Cards Carousel */}
          <section className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">{translate('home_preview_title')}</h2>
              <p className="text-sm text-gray-600">{translate('home_preview_subtitle')}</p>
            </div>

            {/* 2 Cards Grid with Navigation */}
            <div className="relative">
              {/* Navigation Arrows - Desktop */}
              <div className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={() => handleCarouselNav('prev', previewIndex === 0 ? previewSlides.length - 1 : previewIndex - 1)}
                  className="w-10 h-10 rounded-full border border-gray-200 bg-white shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:border-orange-300 transition-colors"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
              <div className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                <button
                  onClick={() => handleCarouselNav('next', previewIndex === previewSlides.length - 1 ? 0 : previewIndex + 1)}
                  className="w-10 h-10 rounded-full border border-gray-200 bg-white shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:border-orange-300 transition-colors"
                  aria-label="Next"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Cards Grid - 1 on mobile, 2 on desktop */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* First Card (visible on mobile and desktop) */}
                {(() => {
                  const firstSlide = previewSlides[previewIndex];
                  const FirstIcon = firstSlide.icon;
                  return (
                    <div className="rounded-3xl border border-orange-100 bg-white shadow-lg p-5 space-y-3 flex flex-col">
                      <div className="flex items-center gap-3">
                        <FirstIcon className={`${firstSlide.iconSize} text-orange-500`} />
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {translate(firstSlide.titleKey)}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {translate(firstSlide.descKey)}
                          </p>
                        </div>
                      </div>
                      <div className="relative rounded-xl overflow-hidden bg-gray-50/50 border border-orange-100 shadow-sm flex-1">
                        <div className="flex items-center justify-center p-3">
                          <Image
                            src={firstSlide.image}
                            alt={firstSlide.alt}
                            width={800}
                            height={600}
                            quality={100}
                            priority
                            unoptimized
                            className="max-w-full h-auto object-contain rounded-lg"
                            style={{ maxHeight: '350px' }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Second Card (hidden on mobile, visible on desktop) */}
                {(() => {
                  const secondIndex = (previewIndex + 1) % previewSlides.length;
                  const secondSlide = previewSlides[secondIndex];
                  const SecondIcon = secondSlide.icon;
                  return (
                    <div className="hidden md:flex rounded-3xl border border-orange-100 bg-white shadow-lg p-5 space-y-3 flex-col">
                      <div className="flex items-center gap-3">
                        <SecondIcon className={`${secondSlide.iconSize} text-orange-500`} />
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {translate(secondSlide.titleKey)}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {translate(secondSlide.descKey)}
                          </p>
                        </div>
                      </div>
                      <div className="relative rounded-xl overflow-hidden bg-gray-50/50 border border-orange-100 shadow-sm flex-1">
                        <div className="flex items-center justify-center p-3">
                          <Image
                            src={secondSlide.image}
                            alt={secondSlide.alt}
                            width={800}
                            height={600}
                            quality={100}
                            unoptimized
                            className="max-w-full h-auto object-contain rounded-lg"
                            style={{ maxHeight: '350px' }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Navigation Arrows - Mobile (below cards) */}
              <div className="flex md:hidden items-center justify-center gap-4 mt-4">
                <button
                  onClick={() => handleCarouselNav('prev', previewIndex === 0 ? previewSlides.length - 1 : previewIndex - 1)}
                  className="w-12 h-12 rounded-full border border-gray-200 bg-white shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:border-orange-300 transition-colors"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => handleCarouselNav('next', previewIndex === previewSlides.length - 1 ? 0 : previewIndex + 1)}
                  className="w-12 h-12 rounded-full border border-gray-200 bg-white shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:border-orange-300 transition-colors"
                  aria-label="Next"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              {/* Indicator Dots */}
              <div className="flex items-center justify-center gap-2 mt-4">
                {previewSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => handleCarouselNav('dot', index)}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      index === previewIndex
                        ? 'bg-orange-500'
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Subjects coverage */}
          <section className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">{translate('home_subjects_title')}</h2>
              <p className="text-sm text-gray-600">{translate('home_subjects_subtitle')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="inline-flex items-center gap-3 rounded-2xl border border-orange-100 bg-white shadow-sm px-4 py-3 text-sm text-gray-800">
                  <CheckCircle2 className="w-4 h-4 text-orange-600" />
                  <span>{translate(`home_subjects_item${i}` as const)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Testimonials */}
          <HomeTestimonials />

          {/* Final CTA */}
          <section className="rounded-3xl bg-orange-500 text-white shadow-xl p-8 text-center space-y-3">
            <h2 className="text-2xl font-bold">{translate('home_final_title')}</h2>
            <p className="text-sm opacity-90">{translate('home_final_subtitle')}</p>
            <div className="flex justify-center">
              <button
                onClick={() => {
                  handleCtaClick('final_cta', '#upload');
                  document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center justify-center h-12 px-6 rounded-xl bg-white text-orange-600 font-semibold hover:bg-orange-50 shadow-md"
              >
                {translate('home_final_cta')}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
