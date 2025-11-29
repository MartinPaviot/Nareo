'use client';

import { useState, useEffect } from 'react';
import { FolderInput, X, Plus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Folder } from '@/types/course-management';

interface AddToFolderDialogProps {
  courseId: string;
  courseTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddToFolderDialog({
  courseId,
  courseTitle,
  isOpen,
  onClose,
  onAdded,
}: AddToFolderDialogProps) {
  const { translate } = useLanguage();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen]);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/folders');
      if (!response.ok) {
        throw new Error('Failed to load folders');
      }
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToFolder = async () => {
    if (!selectedFolderId) return;

    try {
      setIsAdding(true);
      const response = await fetch('/api/folders/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_id: selectedFolderId,
          course_id: courseId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add course to folder');
      }

      onAdded();
      onClose();
    } catch (error) {
      console.error('Error adding course to folder:', error);
      alert(error instanceof Error ? error.message : 'Failed to add course to folder');
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
              <FolderInput className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {translate('add_to_folder_title')}
              </h2>
              <p className="text-sm text-gray-500">{translate('add_to_folder_subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isAdding}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Course Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
          <p className="text-sm text-gray-600">{translate('add_to_folder_course_label')}</p>
          <p className="text-sm text-gray-900 font-medium mt-1">"{courseTitle}"</p>
        </div>

        {/* Folders List */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {translate('add_to_folder_select_label')}
          </p>

          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <p className="text-sm text-gray-600">{translate('add_to_folder_no_folders')}</p>
              <p className="text-xs text-gray-400 mt-1">
                {translate('add_to_folder_create_hint')}
              </p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-2xl p-2">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  disabled={isAdding}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    selectedFolderId === folder.id
                      ? 'bg-indigo-50 border-2 border-indigo-500'
                      : 'bg-white border-2 border-transparent hover:bg-gray-50'
                  } ${isAdding ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                    style={{ backgroundColor: folder.color + '20' }}
                  >
                    {folder.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900">{folder.name}</p>
                  </div>
                  {selectedFolderId === folder.id && (
                    <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isAdding}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {translate('cancel_button')}
          </button>
          <button
            onClick={handleAddToFolder}
            disabled={isAdding || !selectedFolderId}
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isAdding ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {translate('adding_to_folder')}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {translate('add_to_folder_button')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
