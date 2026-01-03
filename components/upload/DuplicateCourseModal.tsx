'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface DuplicateCourseModalProps {
  filename: string;
  existingCourseTitle: string;
  existingCourseDate: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DuplicateCourseModal({
  filename,
  existingCourseTitle,
  existingCourseDate,
  onConfirm,
  onCancel,
}: DuplicateCourseModalProps) {
  const { translate } = useLanguage();

  // Format the date nicely
  const formattedDate = new Date(existingCourseDate).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="relative max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="bg-amber-50 px-6 py-5 flex items-center gap-4 border-b border-amber-100">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {translate('duplicate_course_title')}
            </h2>
            <p className="text-sm text-gray-600">
              {translate('duplicate_course_subtitle')}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            {translate('duplicate_course_message').replace('{filename}', filename)}
          </p>

          {/* Existing course info */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">{translate('duplicate_course_existing')}</p>
            <p className="font-semibold text-gray-900">{existingCourseTitle}</p>
            <p className="text-xs text-gray-500 mt-1">
              {translate('duplicate_course_uploaded_on')} {formattedDate}
            </p>
          </div>

          <p className="text-sm text-gray-600">
            {translate('duplicate_course_question')}
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            {translate('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 rounded-xl text-white font-semibold transition-colors"
            style={{ backgroundColor: '#ff751f' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
          >
            {translate('duplicate_course_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
