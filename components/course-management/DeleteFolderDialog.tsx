'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle, X, FolderOpen } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface DeleteFolderDialogProps {
  folderId: string;
  folderName: string;
  courseCount: number;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteFolderDialog({
  folderId,
  folderName,
  courseCount,
  isOpen,
  onClose,
  onDeleted,
}: DeleteFolderDialogProps) {
  const { translate } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete folder');
      }

      onDeleted();
      onClose();
    } catch (error) {
      console.error('Error deleting folder:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(217, 26, 28, 0.1)' }}>
              <AlertTriangle className="w-6 h-6" style={{ color: '#d91a1c' }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {translate('delete_folder_title')}
              </h2>
              <p className="text-sm text-gray-500">{translate('delete_folder_subtitle')}</p>
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
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-amber-800 font-medium">
              "{folderName}"
            </p>
          </div>
          <p className="text-sm text-amber-700">
            {translate('delete_folder_warning')}
          </p>
          {courseCount > 0 && (
            <p className="text-sm text-amber-600 mt-2">
              {translate('delete_folder_course_count').replace('{count}', String(courseCount))}
            </p>
          )}
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
            className="flex-1 px-4 py-3 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: '#d91a1c' }}
            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#b81618')}
            onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#d91a1c')}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {translate('deleting_folder')}
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                {translate('delete_folder_button')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
