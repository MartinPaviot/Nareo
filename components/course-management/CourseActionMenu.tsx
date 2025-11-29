'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit3, Trash2, FolderInput } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface CourseActionMenuProps {
  onRename: () => void;
  onDelete: () => void;
  onAddToFolder?: () => void;
}

export default function CourseActionMenu({
  onRename,
  onDelete,
  onAddToFolder,
}: CourseActionMenuProps) {
  const { translate } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Menu Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        title={translate('course_actions')}
      >
        <MoreVertical className="w-5 h-5 text-gray-600" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Rename */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction(onRename);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Edit3 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {translate('rename_course_action')}
              </p>
              <p className="text-xs text-gray-500">
                {translate('rename_course_action_hint')}
              </p>
            </div>
          </button>

          {/* Add to Folder (if provided) */}
          {onAddToFolder && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAction(onAddToFolder);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
            >
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <FolderInput className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {translate('add_to_folder_action')}
                </p>
                <p className="text-xs text-gray-500">
                  {translate('add_to_folder_action_hint')}
                </p>
              </div>
            </button>
          )}

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction(onDelete);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left border-t border-gray-100"
          >
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-900">
                {translate('delete_course_action')}
              </p>
              <p className="text-xs text-red-600">
                {translate('delete_course_action_hint')}
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
