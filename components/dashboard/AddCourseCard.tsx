'use client';

import Image from 'next/image';
import { Upload } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface AddCourseCardProps {
  onUploadClick?: () => void;
}

export default function AddCourseCard({ onUploadClick }: AddCourseCardProps) {
  const { translate } = useLanguage();

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
    <div className="bg-gray-50 border-t border-gray-100 rounded-b-3xl px-4 sm:px-6 py-4">
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-4 p-3 bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50/30 transition-all group"
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
          <p className="text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
            {translate('add_course_title')}
          </p>
          <p className="text-xs text-gray-500">
            {translate('add_course_subtitle')}
          </p>
        </div>

        {/* Upload Icon */}
        <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-500 transition-colors">
          <Upload className="w-5 h-5 text-orange-600 group-hover:text-white transition-colors" />
        </div>
      </button>
    </div>
  );
}
