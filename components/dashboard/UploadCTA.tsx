'use client';

import { Upload } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface UploadCTAProps {
  onClick: () => void;
}

/**
 * Carte CTA upload - zone d'action primaire en haut de page
 * Design aligné sur la landing page (dropzone style)
 */
export default function UploadCTA({ onClick }: UploadCTAProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();

  return (
    <button
      onClick={onClick}
      aria-label={translate('upload_card_aria_label')}
      className={`w-full backdrop-blur rounded-3xl border shadow-lg p-4 sm:p-6 text-left ${
        isDark
          ? 'bg-neutral-900/80 border-neutral-800'
          : 'bg-white/80 border-orange-100'
      }`}
    >
      {/* Header */}
      <div className="mb-4">
        <h2 className={`text-base font-bold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
          <span className="relative inline-block isolate">
            <span className="relative z-10">{translate('upload_card_title')}</span>
            <span className={`absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-r z-[-1] rounded-sm ${
              isDark ? 'from-orange-600/25 to-amber-600/25' : 'from-orange-300 to-amber-300'
            }`}></span>
          </span>
        </h2>
        <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
          {translate('upload_card_subtitle')}
        </p>
      </div>

      {/* Dropzone style */}
      <div className={`border-2 border-dashed rounded-2xl transition-all ${
        isDark
          ? 'border-neutral-700 bg-neutral-800/50 hover:border-orange-500/50'
          : 'border-gray-200 bg-gray-50/80 hover:border-orange-300'
      }`}>
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-3">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ background: 'linear-gradient(to bottom right, #ff751f, #e5681b)' }}>
            <Upload className="w-6 h-6" />
          </div>

          {/* CTA button */}
          <div
            className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-semibold hover:opacity-90 transition-colors text-sm"
            style={{ backgroundColor: '#ff751f' }}
          >
            {translate('home_upload_choose_file')}
          </div>
        </div>
      </div>

    </button>
  );
}
