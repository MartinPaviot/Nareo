'use client';

import { ArrowRight, Check } from 'lucide-react';

interface FinalCTAProps {
  translate: (key: string) => string;
  onCtaClick: (ctaName: string, destination?: string) => void;
}

export function FinalCTA({ translate, onCtaClick }: FinalCTAProps) {
  const scrollToUpload = () => {
    onCtaClick('final_cta', '#upload');
    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
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
          onClick={scrollToUpload}
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
  );
}
