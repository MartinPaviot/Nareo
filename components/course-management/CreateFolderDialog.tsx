'use client';

import { useState } from 'react';
import { FolderPlus, X, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCourseManagement } from '@/hooks/useCourseManagement';
import { Folder } from '@/types/course-management';

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (folder: Folder) => void;
}

const FOLDER_COLORS = [
  { name: 'Indigo', value: '#6366f1', bg: 'bg-indigo-500' },
  { name: 'Blue', value: '#3b82f6', bg: 'bg-blue-500' },
  { name: 'Green', value: '#10b981', bg: 'bg-green-500' },
  { name: 'Yellow', value: '#f59e0b', bg: 'bg-yellow-500' },
  { name: 'Red', value: '#ef4444', bg: 'bg-red-500' },
  { name: 'Purple', value: '#a855f7', bg: 'bg-purple-500' },
  { name: 'Pink', value: '#ec4899', bg: 'bg-pink-500' },
  { name: 'Orange', value: '#f97316', bg: 'bg-orange-500' },
];

const FOLDER_ICONS = ['📁', '📂', '🗂️', '📚', '🎓', '💼', '🎯', '⭐'];

export default function CreateFolderDialog({
  isOpen,
  onClose,
  onCreated,
}: CreateFolderDialogProps) {
  const { translate } = useLanguage();
  const { createFolder, isLoading } = useCourseManagement();
  const [folderName, setFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0].value);
  const [selectedIcon, setSelectedIcon] = useState(FOLDER_ICONS[0]);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async () => {
    const trimmedName = folderName.trim();

    // Validation
    if (!trimmedName) {
      setError(translate('create_folder_error_empty'));
      return;
    }

    if (trimmedName.length > 50) {
      setError(translate('create_folder_error_too_long'));
      return;
    }

    const result = await createFolder(trimmedName, selectedColor, selectedIcon);
    if (result) {
      onCreated(result);
      // Reset form
      setFolderName('');
      setSelectedColor(FOLDER_COLORS[0].value);
      setSelectedIcon(FOLDER_ICONS[0]);
      setError(null);
      onClose();
    } else {
      setError(translate('create_folder_error_failed'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleCreate();
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
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
              <FolderPlus className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {translate('create_folder_title')}
              </h2>
              <p className="text-sm text-gray-500">{translate('create_folder_subtitle')}</p>
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

        {/* Folder Name Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {translate('create_folder_name_label')}
          </label>
          <input
            type="text"
            value={folderName}
            onChange={(e) => {
              setFolderName(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={translate('create_folder_name_placeholder')}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={isLoading}
            autoFocus
            maxLength={50}
          />
          <div className="flex justify-between items-center">
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : (
              <span />
            )}
            <span className="text-xs text-gray-400">
              {folderName.length}/50
            </span>
          </div>
        </div>

        {/* Icon Selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {translate('create_folder_icon_label')}
          </label>
          <div className="flex gap-2 flex-wrap">
            {FOLDER_ICONS.map((icon) => (
              <button
                key={icon}
                onClick={() => setSelectedIcon(icon)}
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all ${
                  selectedIcon === icon
                    ? 'bg-indigo-100 ring-2 ring-indigo-500'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
                disabled={isLoading}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Color Selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {translate('create_folder_color_label')}
          </label>
          <div className="flex gap-2 flex-wrap">
            {FOLDER_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => setSelectedColor(color.value)}
                className={`w-10 h-10 rounded-xl ${color.bg} transition-all ${
                  selectedColor === color.value
                    ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                    : 'hover:scale-105'
                }`}
                disabled={isLoading}
                title={color.name}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
          <p className="text-xs text-gray-500 mb-2">{translate('create_folder_preview')}</p>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: selectedColor + '20' }}
            >
              {selectedIcon}
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {folderName || translate('create_folder_name_placeholder')}
              </p>
              <p className="text-xs text-gray-500">0 {translate('courses_count')}</p>
            </div>
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
            onClick={handleCreate}
            disabled={isLoading || !folderName.trim()}
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {translate('creating_folder')}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {translate('create_folder_button')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
