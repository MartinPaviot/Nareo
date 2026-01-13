'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { CheckCircle2, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';

interface HeroPreviewCarouselProps {
  translate: (key: string) => string;
}

export function HeroPreviewCarousel({ translate }: HeroPreviewCarouselProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  // Auto-rotate slides every 8 seconds (slower for better readability)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 3);
      setSelectedAnswer(null);
      setIsFlipped(false);
    }, 8000);
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

  const slideLabels = ['Fiche', 'Quiz', 'Flashcards'];

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
              <p className="text-[11px] sm:text-[9px] text-gray-500 uppercase tracking-wide font-medium">{translate('home_hero_quiz_file')}</p>
              <p className="text-[11px] sm:text-xs font-bold text-gray-900">{translate('home_hero_quiz_chapter')}</p>
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-1 border-b border-gray-100 bg-gray-50/50">
            <p className="text-[11px] sm:text-[10px] text-gray-500">{translate('home_hero_quiz_question_of')}</p>
            <p className="text-[11px] sm:text-[10px] font-semibold text-orange-600">{translate('home_hero_quiz_points')}</p>
          </div>
          {/* Question */}
          <div className="px-3 py-2 space-y-2">
            <p className="text-[11px] sm:text-xs font-semibold text-gray-900 leading-snug">{translate('home_hero_quiz_question')}</p>
            <div className="space-y-1.5">
              {quizAnswers.map((answer, index) => (
                <button
                  key={answer.letter}
                  onClick={() => setSelectedAnswer(index)}
                  className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left transition-all duration-200 ${
                    selectedAnswer !== index
                      ? 'border-gray-200 hover:border-orange-200 hover:bg-orange-50/30'
                      : answer.correct
                      ? 'border-success bg-success-light'
                      : 'border-error/30 bg-error-light'
                  }`}
                >
                  <span className={`flex-shrink-0 text-[11px] sm:text-[10px] font-bold ${
                    selectedAnswer !== index
                      ? 'text-orange-500'
                      : answer.correct
                      ? 'text-success'
                      : 'text-error'
                  }`}>
                    {answer.letter}.
                  </span>
                  <span className="text-[11px] sm:text-[10px] text-gray-700 leading-snug">{answer.text}</span>
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
              <span className="text-[11px] sm:text-[10px] text-gray-500">{translate('home_hero_quiz_remaining')}</span>
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
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-error/30 text-error text-sm font-medium bg-white hover:bg-error-light transition-colors">
                  <X className="w-4 h-4" /> {translate('home_hero_flashcard_no')}
                </button>
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-success/30 text-success text-sm font-medium bg-white hover:bg-success-light transition-colors">
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

      {/* Navigation dots */}
      <div className="flex items-center justify-center gap-3 mt-4">
        {slideLabels.map((label, index) => (
          <button
            key={label}
            onClick={() => goToSlide(index)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              activeSlide === index
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              activeSlide === index ? 'bg-white' : 'bg-gray-400'
            }`} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
