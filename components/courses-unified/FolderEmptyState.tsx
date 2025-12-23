'use client';

import { Upload } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface FolderEmptyStateProps {
  folderId: string;
}

export default function FolderEmptyState({ folderId }: FolderEmptyStateProps) {
  const { isDark } = useTheme();

  const handleUpload = () => {
    // Scroll to upload zone
    const uploadZone = document.querySelector('[data-upload-zone]');
    if (uploadZone) {
      uploadZone.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className={`text-center py-8 rounded-xl border border-dashed ${
      isDark
        ? 'border-neutral-700 bg-neutral-900/50'
        : 'border-gray-200 bg-gray-50/50'
    }`}>
      <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 ${
        isDark ? 'bg-neutral-800' : 'bg-gray-100'
      }`}>
        <Upload className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
      </div>
      <p className={`font-medium mb-1 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
        Dossier vide
      </p>
      <p className={`text-sm mb-4 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
        Ajoute ton premier cours
      </p>
      <button
        onClick={handleUpload}
        className="text-sm text-orange-500 hover:text-orange-600 font-medium"
      >
        Importer un cours
      </button>
    </div>
  );
}
