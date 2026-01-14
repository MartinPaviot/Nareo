'use client';

import { useState, useRef, useEffect } from 'react';
import { Folder, ChevronRight, MoreHorizontal, Trash2 } from 'lucide-react';
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
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-150 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-nareo)] focus-visible:ring-offset-2"
        style={{
          backgroundColor: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
          border: isActive ? '1px solid var(--sidebar-active-border)' : '1px solid transparent',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {/* Folder icon */}
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          {icon ? (
            <span className="text-xs">{icon}</span>
          ) : (
            <Folder
              className="w-3.5 h-3.5"
              style={{ color }}
            />
          )}
        </div>

        {/* Folder name */}
        <span
          className="flex-1 text-left text-[11px] font-medium truncate"
          style={{ color: isActive ? 'var(--color-nareo)' : 'var(--sidebar-text)' }}
        >
          {name}
        </span>

        {/* Course count - simplified */}
        <span
          className="text-[11px] tabular-nums"
          style={{ color: 'var(--sidebar-text-muted)' }}
        >
          {courseCount}
        </span>

        {/* Chevron */}
        <ChevronRight
          className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5"
          style={{ color: isActive ? 'var(--color-nareo)' : 'var(--sidebar-text-muted)' }}
        />
      </button>

      {/* Menu button - appears on hover */}
      {onFolderDeleted && (
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={`absolute top-1/2 -translate-y-1/2 right-1.5 p-1 rounded-md transition-all duration-150 ${
            showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          style={{
            backgroundColor: 'var(--sidebar-bg)',
            color: 'var(--sidebar-text-muted)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
            e.currentTarget.style.color = 'var(--sidebar-text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-bg)';
            e.currentTarget.style.color = 'var(--sidebar-text-muted)';
          }}
          title={translate('delete_folder_button') || 'Supprimer'}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      )}

      {/* Dropdown menu */}
      {showMenu && onFolderDeleted && (
        <div
          ref={menuRef}
          className="absolute right-0 top-9 z-50 w-36 rounded-lg shadow-lg py-1"
          style={{
            backgroundColor: 'var(--sidebar-bg)',
            border: '1px solid var(--sidebar-border)',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
              setShowDeleteDialog(true);
            }}
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors duration-150 text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
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
