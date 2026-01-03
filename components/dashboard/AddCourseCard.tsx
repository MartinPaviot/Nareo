'use client';

import Image from 'next/image';
import { Upload } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface AddCourseCardProps {
  onUploadClick?: () => void;
}

export default function AddCourseCard({ onUploadClick }: AddCourseCardProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();

  const handleClick = () => {
    if (onUploadClick) {
      onUploadClick();
    } else {
      // Scroll to upload zone at bottom of page
      const uploadZone = document.querySelector('[data-upload-zone]');
      if (uploadZone) {
        uploadZone.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className={`rounded-b-3xl px-4 sm:px-6 py-4 border-t ${
      isDark
        ? 'bg-neutral-800/50 border-neutral-700'
        : 'bg-gray-50 border-gray-100'
    }`}>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-4 p-3 rounded-2xl border-2 border-dashed transition-all group ${
          isDark
            ? 'bg-neutral-800 border-neutral-600 hover:border-orange-500/50 hover:bg-orange-950/20'
            : 'bg-white border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
        }`}
      >
        {/* Mascot */}
        <div className="flex-shrink-0">
          <Image
            src="/chat/Drag_and_Drop.png"
            alt="Upload mascot"
            width={48}
            height={48}
            className="object-contain group-hover:scale-105 transition-transform"
          />
        </div>

        {/* Text */}
        <div className="flex-1 text-left">
          <p className={`text-sm font-semibold group-hover:text-orange-500 transition-colors ${
            isDark ? 'text-neutral-100' : 'text-gray-900'
          }`}>
            {translate('add_course_title')}
          </p>
          <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            {translate('add_course_subtitle')}
          </p>
        </div>

        {/* Upload Icon */}
        <div
          className={`upload-icon-container flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            isDark ? 'bg-orange-900/50' : 'bg-orange-100'
          }`}
        >
          <Upload className={`w-5 h-5 group-hover:text-white transition-colors ${
            isDark ? 'text-orange-400' : 'text-orange-600'
          }`} />
          <style jsx>{`
            .upload-icon-container {
              transition: background-color 0.2s;
            }
            :global(.group:hover) .upload-icon-container {
              background-color: #ff751f;
            }
          `}</style>
        </div>
      </button>
    </div>
  );
}
