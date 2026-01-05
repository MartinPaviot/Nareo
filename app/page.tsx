'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowRight,
  BarChart2,
  BarChart3,
  BookOpen,
  Brain,
  Building2,
  Calculator,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  GraduationCap,
  FileText,
  FlaskConical,
  Globe,
  HelpCircle,
  Highlighter,
  Landmark,
  Layers,
  LayoutList,
  Loader2,
  Megaphone,
  Menu,
  RotateCcw,
  Scale,
  Sparkles,
  Stethoscope,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import TopBarActions from '@/components/layout/TopBarActions';
import SignOutButton from '@/components/layout/SignOutButton';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { trackEvent } from '@/lib/posthog';
import { HomeTestimonials } from '@/components/home/Testimonials';
import FAQ from '@/components/home/FAQ';

// Hero Preview Carousel Component (Summary, Quiz, Flashcard) - Faithful to actual UI
function HeroPreviewCarousel({ translate }: { translate: (key: string) => string }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  // Auto-rotate slides every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 3);
      setSelectedAnswer(null);
      setIsFlipped(false);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-flip flashcard when on slide 2
  useEffect(() => {
    if (activeSlide === 2) {
      const flipTimer = setTimeout(() => {
        setIsFlipped(true);
      }, 1500);
      return () => clearTimeout(flipTimer);
    }
  }, [activeSlide]);

  const quizAnswers = [
    { letter: 'A', text: translate('home_hero_quiz_answer_a') },
    { letter: 'B', text: translate('home_hero_quiz_answer_b') },
    { letter: 'C', text: translate('home_hero_quiz_answer_c'), correct: true },
    { letter: 'D', text: translate('home_hero_quiz_answer_d') },
  ];

  const goToSlide = (index: number) => {
    setActiveSlide(index);
    setSelectedAnswer(null);
    setIsFlipped(false);
  };

  const slideLabels = [
    translate('home_hero_tab_summary'),
    translate('home_hero_tab_quiz'),
    translate('home_hero_tab_flashcards'),
  ];

  return (
    <div className="w-full max-w-[320px] sm:max-w-[400px] mx-auto">
      {/* Cards Container */}
      <div className="relative h-[300px] sm:h-[360px] bg-gray-50 rounded-2xl">

        {/* Slide 0: Summary */}
        <div
          className={`absolute inset-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-500 ${
            activeSlide === 0
              ? 'opacity-100 translate-x-0 rotate-0 z-10'
              : activeSlide === 1
              ? 'opacity-0 translate-x-12 rotate-2 z-0'
              : 'opacity-0 -translate-x-12 -rotate-2 z-0'
          }`}
        >
          {/* Content */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-semibold text-gray-800">{translate('home_hero_summary_for')}</span>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-3">{translate('home_hero_summary_main_title')}</h3>
            {/* Section with orange left border */}
            <div className="border-l-[3px] border-orange-500 pl-3 space-y-2">
              <p className="text-sm font-semibold text-orange-600">{translate('home_hero_summary_section1')}</p>
              <div>
                <p className="text-xs font-semibold text-gray-800 mb-1.5">{translate('home_hero_summary_section1_subtitle')}</p>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span><span className="font-medium text-gray-700">{translate('home_hero_summary_section1_point1')}</span>: {translate('home_hero_summary_section1_point1_desc')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span><span className="font-medium text-gray-700">{translate('home_hero_summary_section1_point2')}</span>: {translate('home_hero_summary_section1_point2_desc')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span><span className="font-medium text-gray-700">{translate('home_hero_summary_section1_point3')}</span>: {translate('home_hero_summary_section1_point3_desc')}</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="border-l-[3px] border-orange-500 pl-3 mt-3 space-y-2">
              <p className="text-sm font-semibold text-orange-600">{translate('home_hero_summary_section2')}</p>
              <div>
                <p className="text-xs font-semibold text-gray-800 mb-1.5">{translate('home_hero_summary_section2_subtitle')}</p>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span><span className="font-medium text-gray-700">{translate('home_hero_summary_section2_point1')}</span>: {translate('home_hero_summary_section2_point1_desc')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span><span className="font-medium text-gray-700">{translate('home_hero_summary_section2_point2')}</span>: {translate('home_hero_summary_section2_point2_desc')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Slide 1: Quiz */}
        <div
          className={`absolute inset-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-500 ${
            activeSlide === 1
              ? 'opacity-100 translate-x-0 rotate-0 z-10'
              : activeSlide === 2
              ? 'opacity-0 translate-x-12 rotate-2 z-0'
              : 'opacity-0 -translate-x-12 -rotate-2 z-0'
          }`}
        >
          {/* Header with mascot */}
          <div className="bg-orange-50 px-3 py-1.5 flex items-center gap-2 border-b border-orange-100">
            <Image src="/chat/mascotte.png" alt="Nareo" width={28} height={28} className="object-contain" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] text-gray-500 uppercase tracking-wide font-medium">{translate('home_hero_quiz_file')}</p>
              <p className="text-xs font-bold text-gray-900">{translate('home_hero_quiz_chapter')}</p>
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-1 border-b border-gray-100 bg-gray-50/50">
            <p className="text-[10px] text-gray-500">{translate('home_hero_quiz_question_of')}</p>
            <p className="text-[10px] font-semibold text-orange-600">{translate('home_hero_quiz_points')}</p>
          </div>
          {/* Question */}
          <div className="px-3 py-2 space-y-2">
            <p className="text-xs font-semibold text-gray-900 leading-snug">{translate('home_hero_quiz_question')}</p>
            <div className="space-y-1.5">
              {quizAnswers.map((answer, index) => (
                <button
                  key={answer.letter}
                  onClick={() => setSelectedAnswer(index)}
                  className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left transition-all duration-200 ${
                    selectedAnswer !== index
                      ? 'border-gray-200 hover:border-orange-200 hover:bg-orange-50/30'
                      : ''
                  }`}
                  style={selectedAnswer === index ? (answer.correct ? { borderColor: '#379f5a', backgroundColor: 'rgba(55, 159, 90, 0.1)' } : { borderColor: 'rgba(217, 26, 28, 0.3)', backgroundColor: '#fff6f3' }) : {}}
                >
                  <span className={`flex-shrink-0 text-[10px] font-bold ${selectedAnswer !== index ? 'text-orange-500' : ''}`} style={selectedAnswer === index ? (answer.correct ? { color: '#379f5a' } : { color: '#d91a1c' }) : {}}>
                    {answer.letter}.
                  </span>
                  <span className="text-[10px] text-gray-700 leading-snug">{answer.text}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Navigation footer */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-3 py-1.5">
            <div className="flex items-center justify-between">
              <button className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-[10px] text-gray-500">{translate('home_hero_quiz_remaining')}</span>
              <button className="w-6 h-6 rounded-full border border-orange-300 bg-orange-50 flex items-center justify-center text-orange-500 hover:bg-orange-100 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-center gap-0.5 mt-1">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 h-1 rounded-full transition-colors ${
                    i === 0 ? 'bg-orange-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Slide 2: Flashcard */}
        <div
          className={`absolute inset-0 transition-all duration-500 ${
            activeSlide === 2
              ? 'opacity-100 translate-x-0 rotate-0 z-10'
              : activeSlide === 0
              ? 'opacity-0 translate-x-12 rotate-2 z-0'
              : 'opacity-0 -translate-x-12 -rotate-2 z-0'
          }`}
          style={{ perspective: '1000px' }}
        >
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full h-full cursor-pointer"
            style={{
              transformStyle: 'preserve-3d',
              transition: 'transform 0.6s',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front - Question */}
            <div
              className="absolute inset-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="px-4 py-2 text-xs text-orange-600 font-medium border-b border-gray-100">1 / 20</div>
              {/* Card content */}
              <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
                <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-3">{translate('home_hero_flashcard_category')}</p>
                <p className="text-lg font-bold text-gray-900 mb-4">{translate('home_hero_flashcard_question')}</p>
                <p className="text-sm text-gray-400">{translate('home_hero_flashcard_tap')}</p>
              </div>
              {/* Navigation */}
              <div className="flex items-center justify-center gap-4 pb-4">
                <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-500 font-medium">1 / 20</span>
                <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Back - Answer */}
            <div
              className="absolute inset-0 bg-orange-50 rounded-2xl shadow-2xl border border-orange-200 overflow-hidden flex flex-col"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <div className="px-4 py-1.5 text-xs text-orange-600 font-medium border-b border-orange-200">1 / 20</div>
              {/* Card content */}
              <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
                <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-3">{translate('home_hero_flashcard_answer_label')}</p>
                <p className="text-base font-bold text-gray-800 mb-2">{translate('home_hero_flashcard_formula')}</p>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">{translate('home_hero_flashcard_explanation')}</p>
                <p className="text-xs text-orange-500 font-medium">{translate('home_hero_flashcard_rate')}</p>
              </div>
              {/* Rating buttons */}
              <div className="flex items-center justify-center gap-3 pb-2">
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium bg-white" style={{ borderColor: 'rgba(217, 26, 28, 0.3)', color: '#d91a1c' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff6f3'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <X className="w-4 h-4" /> {translate('home_hero_flashcard_no')}
                </button>
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium bg-white" style={{ borderColor: 'rgba(55, 159, 90, 0.3)', color: '#379f5a' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(55, 159, 90, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <CheckCircle2 className="w-4 h-4" /> {translate('home_hero_flashcard_yes')}
                </button>
              </div>
              <div className="flex items-center justify-center gap-4 pb-3">
                <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white/80 text-gray-500">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-500 font-medium">1 / 20</span>
                <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white/80 text-gray-500">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [pricingBilling, setPricingBilling] = useState<'monthly' | 'annual'>('monthly');
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
        <div className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold" style={{ color: '#379f5a', backgroundColor: 'rgba(55, 159, 90, 0.1)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(55, 159, 90, 0.2)' }}>
          <CheckCircle2 className="w-4 h-4" />
          {translate('upload_after_state_title')}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-orange-50">
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
              {/* My Courses - only show when user is logged in */}
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

      <main className="px-4 sm:px-6 pb-12 pt-4">
        <div className="max-w-5xl mx-auto space-y-12">
          {/* Hero section: left content (55%) + mascot right (45%) */}
          <section className="flex flex-col lg:flex-row items-center gap-6 lg:gap-4 mb-12">
            {/* Left side - 55% width on desktop */}
            <div className="lg:w-[55%] flex flex-col justify-center space-y-4 text-center lg:text-left order-1 lg:order-1">
              <h1 className="text-2xl sm:text-3xl lg:text-[2.5rem] font-bold text-gray-900 leading-tight lg:leading-snug">
                <span className="relative inline-block">
                  <span className="relative z-10">{translate('home_hero_title_highlight')}</span>
                  <span className="absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-r from-orange-300 to-amber-300 -z-0 rounded-sm"></span>
                </span>
                {translate('home_hero_title')}
                <br className="hidden lg:block" />
                {translate('home_hero_title_line2')}
                <span className="text-orange-500">{translate('home_hero_title_end')}</span>
              </h1>
              <p className="text-lg lg:text-xl text-gray-700">
                {translate('home_hero_subtitle')}
              </p>
              {/* CTA Button - Hidden on mobile, shown on desktop */}
              <div className="hidden lg:flex flex-col items-start pt-2 gap-2">
                <button
                  onClick={() => {
                    handleCtaClick('hero_primary', '#upload');
                    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center justify-center h-12 px-6 rounded-xl text-white font-semibold shadow-md transition-colors"
                  style={{ backgroundColor: '#ff751f' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
                >
                  {translate('home_hero_cta_primary')}
                </button>
                <p className="text-sm text-gray-500">{translate('home_hero_cta_subtext')}</p>
              </div>
            </div>
            {/* Right side - 45% width on desktop, preview carousel */}
            <div className="w-full lg:w-[45%] flex flex-col justify-center items-center order-2 lg:order-2 gap-6">
              <HeroPreviewCarousel translate={translate} />
              {/* CTA Button - Shown on mobile only, after carousel */}
              <div className="lg:hidden flex flex-col items-center gap-2">
                <button
                  onClick={() => {
                    handleCtaClick('hero_primary', '#upload');
                    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center justify-center h-12 px-6 rounded-xl text-white font-semibold shadow-md transition-colors"
                  style={{ backgroundColor: '#ff751f' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
                >
                  {translate('home_hero_cta_primary')}
                </button>
                <p className="text-sm text-gray-500 text-center">{translate('home_hero_cta_subtext')}</p>
              </div>
            </div>
          </section>

          {/* Why quizzes - Comparison with Hero Stat */}
          <section className="space-y-5">
            {/* Title + Hero Stat + Source - grouped together */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">{translate('home_why_title')}</h2>
              <div className="flex flex-col items-center">
                <span className="text-4xl md:text-5xl font-bold text-orange-500">+50%</span>
                <span className="text-base text-gray-600 mt-1">{translate('home_why_hero_stat')}</span>
              </div>
              {/* Source - directly under the stat */}
              <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2 mx-auto">
                <BarChart2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-xs text-gray-600">{translate('home_why_source_short')}</span>
              </div>
            </div>

            {/* Comparison cards */}
            <div className="flex flex-col md:flex-row items-stretch justify-center gap-4 md:gap-0 max-w-3xl mx-auto relative">

              {/* Card PERDANTE */}
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-5 md:rounded-r-none">
                {/* Header */}
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4 text-gray-400" />
                  </div>
                  <span className="font-semibold text-gray-500">{translate('home_why_left_title')}</span>
                </div>

                {/* Efficacy text */}
                <div className="mb-5">
                  <span className="text-sm text-gray-500">{translate('home_why_left_efficacy')}</span>
                </div>

                {/* Liste */}
                <ul className="space-y-3 mb-5">
                  <li className="flex items-center gap-3 text-gray-600">
                    <BookOpen className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <span className="text-sm">{translate('home_why_left_item1')}</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-600">
                    <Highlighter className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <span className="text-sm">{translate('home_why_left_item2')}</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-600">
                    <RotateCcw className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <span className="text-sm">{translate('home_why_left_item3')}</span>
                  </li>
                </ul>

                {/* Résultat */}
                <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                  <TrendingDown className="w-5 h-5" style={{ color: '#d91a1c' }} />
                  <span className="font-medium text-sm" style={{ color: '#d91a1c' }}>{translate('home_why_left_result')}</span>
                </div>
              </div>

              {/* Badge VS - Mobile only */}
              <div className="flex md:hidden items-center justify-center -my-2">
                <div className="w-10 h-10 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-xs font-bold text-gray-400">VS</span>
                </div>
              </div>

              {/* Card GAGNANTE */}
              <div className="flex-1 bg-orange-50 border border-orange-300 rounded-2xl p-5 md:rounded-l-none md:border-l-0 relative">

                {/* Badge "Prouvé" */}
                <div className="absolute -top-3 right-4 text-white text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: '#ff751f' }}>
                  {translate('home_why_badge')}
                </div>

                {/* Header */}
                <div className="flex items-center gap-2 mb-5 mt-1">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md" style={{ background: 'linear-gradient(to bottom right, #ff751f, #e5681b)', boxShadow: '0 4px 6px -1px rgba(255, 117, 31, 0.3)' }}>
                    <Zap className="w-4 h-4 text-white fill-white" />
                  </div>
                  <span className="font-semibold text-gray-900">{translate('home_why_right_title')}</span>
                </div>

                {/* Efficacy text */}
                <div className="mb-5">
                  <span className="text-sm text-orange-600 font-semibold">{translate('home_why_right_efficacy')}</span>
                </div>

                {/* Liste */}
                <ul className="space-y-3 mb-5">
                  <li className="flex items-center gap-3 text-gray-700">
                    <FileText className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <span className="text-sm" dangerouslySetInnerHTML={{ __html: translate('home_why_right_item1') }} />
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <HelpCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <span className="text-sm" dangerouslySetInnerHTML={{ __html: translate('home_why_right_item2') }} />
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <Layers className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <span className="text-sm" dangerouslySetInnerHTML={{ __html: translate('home_why_right_item3') }} />
                  </li>
                </ul>

                {/* Résultat */}
                <div className="flex items-center gap-2 pt-4 border-t border-orange-200">
                  <TrendingUp className="w-5 h-5" style={{ color: '#379f5a' }} />
                  <span className="font-medium text-sm" style={{ color: '#379f5a' }}>{translate('home_why_right_result')}</span>
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
              <div className="rounded-2xl border border-orange-100 bg-white shadow-sm p-5 text-center space-y-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 text-orange-700 font-bold mx-auto">1</div>
                <p className="text-base font-semibold text-gray-900 line-clamp-1">{translate('home_hiw_step1_title')}</p>
                <p className="text-sm text-gray-600 line-clamp-2 whitespace-pre-line">{translate('home_hiw_step1_desc')}</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-white shadow-sm p-5 text-center space-y-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 text-orange-700 font-bold mx-auto">2</div>
                <p className="text-base font-semibold text-gray-900 line-clamp-1">{translate('home_hiw_step2_title')}</p>
                <p className="text-sm text-gray-600 line-clamp-2">{translate('home_hiw_step2_desc')}</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-white shadow-sm p-5 text-center space-y-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 text-orange-700 font-bold mx-auto">3</div>
                <p className="text-base font-semibold text-gray-900 line-clamp-1">{translate('home_hiw_step3_title')}</p>
                <p className="text-sm text-gray-600 line-clamp-2">{translate('home_hiw_step3_desc')}</p>
              </div>
            </div>
          </section>

          {/* Subjects coverage - Marquee */}
          <section className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">{translate('home_subjects_title')}</h2>
            </div>

            {/* Marquee container */}
            <div className="overflow-hidden w-full">
              <div
                className="flex gap-3 sm:gap-4 animate-marquee hover:[animation-play-state:paused]"
                style={{ width: 'max-content' }}
              >
                {/* First set of pills */}
                {[
                  { icon: TrendingUp, label: translate('marquee_economy') },
                  { icon: Megaphone, label: translate('marquee_marketing') },
                  { icon: Scale, label: translate('marquee_law') },
                  { icon: Brain, label: translate('marquee_psychology') },
                  { icon: Wallet, label: translate('marquee_finance') },
                  { icon: Landmark, label: translate('marquee_history') },
                  { icon: Globe, label: translate('marquee_languages') },
                  { icon: BarChart3, label: translate('marquee_management') },
                  { icon: Building2, label: translate('marquee_polisci') },
                  { icon: Users, label: translate('marquee_sociology') },
                  { icon: BookOpen, label: translate('marquee_literature') },
                  { icon: FlaskConical, label: translate('marquee_socialsciences') },
                  { icon: Stethoscope, label: translate('marquee_medicine') },
                  { icon: Calculator, label: translate('marquee_accounting') },
                ].map((subject, index) => (
                  <div
                    key={`first-${index}`}
                    className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-white border border-gray-200 rounded-full shadow-sm flex-shrink-0"
                  >
                    <subject.icon className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-orange-500" />
                    <span className="text-sm font-medium text-gray-700">{subject.label}</span>
                  </div>
                ))}
                {/* Duplicated set for seamless loop */}
                {[
                  { icon: TrendingUp, label: translate('marquee_economy') },
                  { icon: Megaphone, label: translate('marquee_marketing') },
                  { icon: Scale, label: translate('marquee_law') },
                  { icon: Brain, label: translate('marquee_psychology') },
                  { icon: Wallet, label: translate('marquee_finance') },
                  { icon: Landmark, label: translate('marquee_history') },
                  { icon: Globe, label: translate('marquee_languages') },
                  { icon: BarChart3, label: translate('marquee_management') },
                  { icon: Building2, label: translate('marquee_polisci') },
                  { icon: Users, label: translate('marquee_sociology') },
                  { icon: BookOpen, label: translate('marquee_literature') },
                  { icon: FlaskConical, label: translate('marquee_socialsciences') },
                  { icon: Stethoscope, label: translate('marquee_medicine') },
                  { icon: Calculator, label: translate('marquee_accounting') },
                ].map((subject, index) => (
                  <div
                    key={`second-${index}`}
                    className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-white border border-gray-200 rounded-full shadow-sm flex-shrink-0"
                  >
                    <subject.icon className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-orange-500" />
                    <span className="text-sm font-medium text-gray-700">{subject.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm text-gray-600 text-center">{translate('home_subjects_subtitle')}</p>
          </section>

          {/* Upload area */}
          <section id="upload" className="grid lg:grid-cols-1 gap-6 items-start">
            <div className="bg-white/80 backdrop-blur rounded-3xl border border-orange-100 shadow-lg p-4 sm:p-6">
              {/* Header - Title and subtitle with formats */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-bold text-gray-900">
                    {translate('home_upload_title')}{' '}
                    <span className="relative inline-block">
                      <span className="relative z-10">{translate('home_upload_title_highlight')}</span>
                      <span className="absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-r from-orange-300 to-amber-300 -z-0 rounded-sm"></span>
                    </span>
                  </h2>
                  {renderStateBadge()}
                </div>
                <p className="text-xs text-gray-600">
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
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-3">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ background: 'linear-gradient(to bottom right, #ff751f, #e5681b)' }}>
                    <Upload className="w-6 h-6" />
                  </div>

                  {/* Dropzone hint */}
                  <p className="text-base font-semibold text-gray-900">
                    {translate('home_upload_drop_text')}
                  </p>

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 justify-center w-full max-w-sm">
                    {/* Main button - always visible */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleCtaClick('upload_choose_file');
                        fileInputRef.current?.click();
                      }}
                      className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors"
                      style={{ backgroundColor: '#ff751f' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
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
                  className="flex-1 inline-flex items-center justify-center gap-2 h-[60px] md:h-12 rounded-xl text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: '#ff751f' }}
                  onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#e5681b')}
                  onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#ff751f')}
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
                <div className="mt-4 rounded-xl border p-3 text-sm" style={{ borderColor: 'rgba(217, 26, 28, 0.3)', backgroundColor: '#fff6f3', color: '#d91a1c' }}>
                  <p>{error}</p>
                </div>
              )}

              {isProcessing && (
                <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-800">
                  <p className="font-semibold flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {translate('upload_processing_title')}
                  </p>
                </div>
              )}

            </div>
          </section>

          {/* Testimonials */}
          <HomeTestimonials />

          {/* Pricing Section */}
          <section id="pricing" className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-gray-900">{translate('signup_plan_title')}</h2>
              <p className="text-sm text-gray-600">{translate('signup_plan_subtitle')}</p>
            </div>

            {/* Billing Toggle */}
            <div className="flex justify-center">
              <div className="inline-flex rounded-xl bg-gray-100 p-1">
                <button
                  onClick={() => setPricingBilling('monthly')}
                  className={`py-1.5 px-3 rounded-lg text-sm font-medium transition-all ${
                    pricingBilling === 'monthly'
                      ? 'bg-white text-gray-900 shadow'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {translate('paywall_plan_monthly')}
                </button>
                <button
                  onClick={() => setPricingBilling('annual')}
                  className={`py-1.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    pricingBilling === 'annual'
                      ? 'bg-white text-gray-900 shadow'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {translate('paywall_plan_annual')}
                  <span className="text-xs text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#379f5a' }}>
                    -30%
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {/* Free Plan */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-lg hover:border-gray-300 transition-all flex flex-col">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{translate('signup_plan_free_title')}</h3>
                    <p className="text-xs text-gray-500">{translate('signup_plan_free_desc')}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">0€</span>
                  <span className="ml-1 text-sm text-gray-500">{translate('paywall_price_per_month')}</span>
                </div>

                <ul className="space-y-2 mb-4 flex-grow">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">{translate('signup_plan_free_feature_1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">{translate('signup_plan_free_feature_2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">{translate('signup_plan_free_feature_3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">{translate('signup_plan_free_feature_4')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">{translate('signup_plan_free_feature_5')}</span>
                  </li>
                </ul>

                {user ? (
                  <div className="w-full py-2.5 px-4 rounded-xl bg-gray-100 text-gray-500 font-semibold text-center mt-auto">
                    {translate('pricing_current_plan')}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      handleCtaClick('pricing_free', '/auth/signup');
                      router.push('/auth/signup');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-all mt-auto"
                  >
                    {translate('signup_plan_free_cta')}
                  </button>
                )}
              </div>

              {/* Premium Plan */}
              <div className="relative rounded-2xl border-2 bg-white p-5 shadow-xl flex flex-col" style={{ borderColor: '#ff751f' }}>
                {/* Recommended Badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-white text-xs font-bold rounded-full" style={{ backgroundColor: '#ff751f' }}>
                  {translate('signup_plan_premium_badge')}
                </div>

                <div className="flex items-center gap-2.5 mb-3 mt-1">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5" style={{ color: '#ff751f' }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{translate('signup_plan_premium_title')}</h3>
                    <p className="text-xs text-gray-500">{translate('signup_plan_premium_desc')}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-bold text-orange-600">
                    {pricingBilling === 'annual'
                      ? (currentLanguage === 'en' ? '€6.99' : '6,99 €')
                      : (currentLanguage === 'en' ? '€9.99' : '9,99 €')
                    }
                  </span>
                  <span className="ml-1 text-sm text-gray-500">{translate('paywall_price_per_month')}</span>
                  {pricingBilling === 'annual' ? (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {translate('paywall_billed_annually')} {currentLanguage === 'en' ? '€83.88' : '83,88 €'}
                    </p>
                  ) : (
                    <p className="text-xs mt-0.5" style={{ color: '#379f5a' }}>
                      {translate('pricing_cancel_anytime')}
                    </p>
                  )}
                </div>

                <ul className="space-y-2 mb-4 flex-grow">
                  <li className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('signup_plan_premium_feature_1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('signup_plan_premium_feature_2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('signup_plan_premium_feature_3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('signup_plan_premium_feature_4')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('signup_plan_premium_feature_5')}</span>
                  </li>
                </ul>

                <button
                  onClick={async () => {
                    const plan = pricingBilling;
                    if (user) {
                      // User is logged in - redirect directly to Stripe checkout
                      handleCtaClick('pricing_premium_direct_checkout', plan);
                      try {
                        const response = await fetch('/api/payment/create-checkout', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ plan }),
                        });
                        const data = await response.json();
                        if (data.url) {
                          window.location.href = data.url;
                        } else if (data.alreadySubscribed) {
                          router.push('/dashboard');
                        } else {
                          console.error('Failed to create checkout session:', data.error);
                          router.push(`/paywall?plan=${plan}`);
                        }
                      } catch (error) {
                        console.error('Error creating checkout:', error);
                        router.push(`/paywall?plan=${plan}`);
                      }
                    } else {
                      // User not logged in - redirect to signup with returnTo paywall
                      const paywallUrl = `/paywall?plan=${plan}`;
                      handleCtaClick('pricing_premium', `/auth/signup?returnTo=${encodeURIComponent(paywallUrl)}`);
                      router.push(`/auth/signup?returnTo=${encodeURIComponent(paywallUrl)}`);
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-white font-semibold transition-all shadow-lg flex items-center justify-center gap-2 mt-auto"
                  style={{ backgroundColor: '#ff751f', boxShadow: '0 10px 15px -3px rgba(255, 117, 31, 0.25)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
                >
                  <GraduationCap className="w-4 h-4" />
                  {translate('signup_plan_premium_cta')}
                </button>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <FAQ />

          {/* Final CTA */}
          <section className="relative overflow-hidden rounded-3xl p-10 md:p-14 text-center" style={{ background: 'linear-gradient(to bottom right, #ff751f, #e5681b)' }}>
            {/* Cercles décoratifs en arrière-plan */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/10 rounded-full translate-x-1/3 translate-y-1/3" />
            <div className="absolute top-1/2 right-10 w-20 h-20 bg-white/10 rounded-full" />

            {/* Contenu */}
            <div className="relative z-10">
              {/* Titre */}
              <h2 className="text-2xl md:text-4xl font-bold text-white mb-8">
                {translate('home_final_title')}
              </h2>

              {/* Bouton CTA */}
              <button
                onClick={() => {
                  handleCtaClick('final_cta', '#upload');
                  document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="group bg-white font-semibold px-8 py-4 rounded-full text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 inline-flex items-center gap-3"
                style={{ color: '#ff751f' }}
              >
                <span>{translate('home_final_cta')}</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Réassurance */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mt-8 text-white/90 text-sm">
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {translate('home_final_reassurance_1')}
                </span>
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {translate('home_final_reassurance_2')}
                </span>
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {translate('home_final_reassurance_3')}
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
