'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCourseManagement } from '@/hooks/useCourseManagement';

interface DeleteCourseDialogProps {
  courseId: string;
  courseTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteCourseDialog({
  courseId,
  courseTitle,
  isOpen,
  onClose,
  onDeleted,
}: DeleteCourseDialogProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const { deleteCourse, isLoading } = useCourseManagement();
  const [mounted, setMounted] = useState(false);

  // Ensure we only render portal on client
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDelete = async () => {
    const success = await deleteCourse(courseId);
    if (success) {
      onDeleted();
      onClose();
    }
  };

  if (!isOpen || !mounted) return null;

  const dialogContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 ${
        isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
      }`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: '#fff6f3' }}
            >
              <AlertTriangle className="w-6 h-6" style={{ color: '#d91a1c' }} />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                {translate('delete_course_title')}
              </h2>
              <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {translate('delete_course_subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors flex-shrink-0 ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Message */}
        <div
          className={`rounded-xl p-4 border ${isDark ? 'bg-neutral-800/50 border-neutral-700' : ''}`}
          style={isDark ? {} : {
            backgroundColor: '#fff6f3',
            borderColor: 'rgba(217, 26, 28, 0.3)'
          }}
        >
          <p className="text-sm" style={{ color: '#d91a1c' }}>
            {translate('delete_course_warning')}
          </p>
          <p className="text-sm mt-2 font-medium break-words" style={{ color: '#b81618' }}>
            "{courseTitle}"
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              isDark
                ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {translate('cancel_button')}
          </button>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: '#d91a1c' }}
            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#b81618')}
            onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#d91a1c')}
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{translate('deleting_course')}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{translate('delete_course_button')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}
