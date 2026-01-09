'use client';

import { useState, useRef, useEffect } from 'react';
import { Folder, ChevronRight, MoreHorizontal, Trash2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import DeleteFolderDialog from '@/components/course-management/DeleteFolderDialog';

interface FolderItemProps {
  id: string;
  name: string;
  courseCount: number;
  color?: string;
  icon?: string;
  isActive: boolean;
  onClick: () => void;
  onFolderDeleted?: () => void;
}

export default function FolderItem({
  id,
  name,
  courseCount,
  color = '#F97316',
  icon,
  isActive,
  onClick,
  onFolderDeleted,
}: FolderItemProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  return (
    <div className="relative group">
      <button
      onClick={onClick}
      className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all group ${
        isActive
          ? isDark
            ? 'bg-orange-500/20 border border-orange-500/30'
            : 'bg-orange-50 border border-orange-200'
          : isDark
            ? 'hover:bg-neutral-800 border border-transparent'
            : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      {/* Folder icon */}
      <div
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        {icon ? (
          <span className="text-[10px]">{icon}</span>
        ) : (
          <Folder
            className="w-3 h-3"
            style={{ color }}
          />
        )}
      </div>

      {/* Folder name */}
      <span className={`flex-1 text-left text-[10px] font-medium truncate ${
        isActive
          ? 'text-orange-500'
          : isDark
            ? 'text-neutral-100'
            : 'text-gray-900'
      }`}>
        {name}
      </span>

      {/* Course count badge */}
      <span className={`px-1.5 py-0 text-[10px] font-medium rounded-full ${
        isActive
          ? isDark
            ? 'bg-orange-500/30 text-orange-400'
            : 'bg-orange-100 text-orange-600'
          : isDark
            ? 'bg-neutral-700 text-neutral-400'
            : 'bg-gray-100 text-gray-500'
      }`}>
        {courseCount}
      </span>

        {/* Chevron */}
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${
          isActive
            ? 'text-orange-500'
            : isDark
              ? 'text-neutral-500 group-hover:text-neutral-400'
              : 'text-gray-400 group-hover:text-gray-500'
        } group-hover:translate-x-0.5`} />
      </button>

      {/* Menu button - appears on hover */}
      {onFolderDeleted && (
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={`absolute top-1/2 -translate-y-1/2 right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
            showMenu ? 'opacity-100' : ''
          } ${
            isDark
              ? 'hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 bg-neutral-800'
              : 'hover:bg-gray-200 text-gray-400 hover:text-gray-600 bg-white'
          }`}
          title={translate('delete_folder_button') || 'Supprimer'}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Dropdown menu */}
      {showMenu && onFolderDeleted && (
        <div
          ref={menuRef}
          className={`absolute right-0 top-8 z-50 w-36 rounded-lg shadow-lg border py-1 ${
            isDark
              ? 'bg-neutral-800 border-neutral-700'
              : 'bg-white border-gray-200'
          }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
              setShowDeleteDialog(true);
            }}
            className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="w-3 h-3 flex-shrink-0" />
            <span>{translate('delete_folder_button') || 'Supprimer'}</span>
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <DeleteFolderDialog
        folderId={id}
        folderName={name}
        courseCount={courseCount}
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onDeleted={() => {
          onFolderDeleted?.();
        }}
      />
    </div>
  );
}
