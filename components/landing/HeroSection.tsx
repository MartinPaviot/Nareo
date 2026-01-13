'use client';

import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { HeroPreviewCarousel } from './HeroPreviewCarousel';

interface HeroSectionProps {
  translate: (key: string) => string;
  onCtaClick: (ctaName: string, destination?: string) => void;
}

export function HeroSection({ translate, onCtaClick }: HeroSectionProps) {
  const scrollToUpload = () => {
    onCtaClick('hero_primary', '#upload');
    const uploadSection = document.getElementById('upload');
    if (uploadSection) {
      const yOffset = -100; // Offset pour centrer visuellement
      const y = uploadSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <section className="flex flex-col lg:flex-row items-center gap-8 lg:gap-6 mb-16">
      {/* Left side - 55% width on desktop */}
      <div className="lg:w-[55%] flex flex-col justify-center space-y-5 text-center lg:text-left order-1 lg:order-1">
        <h1 className="text-2xl sm:text-3xl lg:text-[2.75rem] font-bold text-gray-900 leading-tight lg:leading-snug">
          <span className="relative inline-block">
            <span className="relative z-10">{translate('home_hero_title_highlight')}</span>
            <span className="absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-r from-orange-300 to-amber-300 -z-0 rounded-sm"></span>
          </span>
          {translate('home_hero_title')} {translate('home_hero_title_line2')}
          <span style={{ color: '#ff751f' }}>{translate('home_hero_title_end')}</span>
        </h1>
        <p className="text-lg lg:text-2xl text-gray-600 max-w-xl">
          {translate('home_hero_subtitle')}
        </p>
        {/* CTA Button - Hidden on mobile, shown on desktop */}
        <div className="hidden lg:flex flex-col items-start pt-3 gap-3">
          <button
            onClick={scrollToUpload}
            className="group inline-flex items-center justify-center gap-2 h-14 px-8 rounded-xl text-white text-lg font-semibold shadow-lg transition-all duration-200 hover:scale-[1.02]"
            style={{
              backgroundColor: '#ff751f',
              boxShadow: '0 10px 25px -5px rgba(255, 117, 31, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e5681b';
              e.currentTarget.style.boxShadow = '0 15px 30px -5px rgba(255, 117, 31, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ff751f';
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(255, 117, 31, 0.4)';
            }}
          >
            {translate('home_hero_cta_primary')}
            <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            {translate('home_hero_cta_subtext')}
          </p>
        </div>
      </div>

      {/* Right side - 45% width on desktop, preview carousel */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center items-center order-2 lg:order-2 gap-6">
        <HeroPreviewCarousel translate={translate} />
        {/* CTA Button - Shown on mobile only, after carousel */}
        <div className="lg:hidden flex flex-col items-center gap-3">
          <button
            onClick={scrollToUpload}
            className="group inline-flex items-center justify-center gap-2 h-14 px-8 rounded-xl text-white text-lg font-semibold shadow-lg transition-all duration-200 hover:scale-[1.02]"
            style={{
              backgroundColor: '#ff751f',
              boxShadow: '0 10px 25px -5px rgba(255, 117, 31, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e5681b';
              e.currentTarget.style.boxShadow = '0 15px 30px -5px rgba(255, 117, 31, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ff751f';
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(255, 117, 31, 0.4)';
            }}
          >
            {translate('home_hero_cta_primary')}
            <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
          <p className="flex items-center gap-2 text-sm text-gray-500 text-center">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            {translate('home_hero_cta_subtext')}
          </p>
        </div>
      </div>
    </section>
  );
}
