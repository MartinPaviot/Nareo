'use client';

import { Trash2, AlertTriangle, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const { deleteCourse, isLoading } = useCourseManagement();

  if (!isOpen) return null;

  const handleDelete = async () => {
    const success = await deleteCourse(courseId);
    if (success) {
      onDeleted();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {translate('delete_course_title')}
              </h2>
              <p className="text-sm text-gray-500">{translate('delete_course_subtitle')}</p>
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

        {/* Warning Message */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm text-red-800">
            {translate('delete_course_warning')}
          </p>
          <p className="text-sm text-red-700 mt-2 font-medium">
            "{courseTitle}"
          </p>
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
            onClick={handleDelete}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {translate('deleting_course')}
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                {translate('delete_course_button')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
