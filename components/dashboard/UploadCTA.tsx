'use client';

import Image from 'next/image';
import { Upload } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface UploadCTAProps {
  onClick: () => void;
}

/**
 * Carte CTA upload - zone d'action primaire en haut de page
 *
 * Design v4:
 * - Mascotte agrandie: w-32 h-32 sm:w-40 sm:h-40
 * - Espacement optimisé: gap-4 sm:gap-6
 * - Bouton orange en CTA
 * - Rounded-2xl pour cohérence
 */
export default function UploadCTA({ onClick }: UploadCTAProps) {
  const { translate } = useLanguage();

  return (
    <button
      onClick={onClick}
      aria-label={translate('upload_card_aria_label')}
      className="w-full bg-white rounded-2xl border-2 border-gray-200 hover:border-orange-400 p-2 sm:p-3 transition-all duration-200 hover:shadow-xl shadow-sm group text-left"
    >
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
        {/* Contenu textuel + CTA */}
        <div className="flex-1 space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            {translate('upload_card_title')}
          </h2>
          <p className="text-sm text-gray-600">
            {translate('upload_card_subtitle')}
          </p>

          {/* Indicateur visuel d'action - style bouton orange */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-500 text-white rounded-full font-semibold hover:bg-orange-600 transition-colors shadow-sm">
            <Upload className="w-4 h-4" />
            <span className="text-sm">{translate('upload_card_cta')}</span>
          </div>
        </div>

        {/* Mascotte Drag & Drop - Agrandie */}
        <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0">
          <Image
            src="/chat/Drag_and_Drop.png"
            alt="Upload mascot"
            fill
            className="object-contain group-hover:scale-105 transition-transform duration-200"
            priority
          />
        </div>
      </div>
    </button>
  );
}
