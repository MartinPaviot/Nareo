'use client';

import { useState } from 'react';
import { Edit3, X, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCourseManagement } from '@/hooks/useCourseManagement';

interface RenameCourseDialogProps {
  courseId: string;
  currentTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onRenamed: (newTitle: string) => void;
}

export default function RenameCourseDialog({
  courseId,
  currentTitle,
  isOpen,
  onClose,
  onRenamed,
}: RenameCourseDialogProps) {
  const { translate } = useLanguage();
  const { renameCourse, isLoading } = useCourseManagement();
  const [newTitle, setNewTitle] = useState(currentTitle);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRename = async () => {
    const trimmedTitle = newTitle.trim();

    // Validation
    if (!trimmedTitle) {
      setError(translate('rename_course_error_empty'));
      return;
    }

    if (trimmedTitle.length > 100) {
      setError(translate('rename_course_error_too_long'));
      return;
    }

    if (trimmedTitle === currentTitle) {
      onClose();
      return;
    }

    const result = await renameCourse(courseId, trimmedTitle);
    if (result) {
      onRenamed(trimmedTitle);
      onClose();
    } else {
      setError(translate('rename_course_error_failed'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleRename();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
              <Edit3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {translate('rename_course_title')}
              </h2>
              <p className="text-sm text-gray-500">{translate('rename_course_subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {translate('rename_course_label')}
          </label>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => {
              setNewTitle(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={translate('rename_course_placeholder')}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
            autoFocus
            maxLength={100}
          />
          <div className="flex justify-between items-center">
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : (
              <p className="text-sm text-gray-500">{translate('rename_course_hint')}</p>
            )}
            <span className="text-xs text-gray-400">
              {newTitle.length}/100
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {translate('cancel_button')}
          </button>
          <button
            onClick={handleRename}
            disabled={isLoading || !newTitle.trim()}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {translate('renaming_course')}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {translate('rename_course_button')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
