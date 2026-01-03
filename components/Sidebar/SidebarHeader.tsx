'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface SidebarHeaderProps {
  onClose: () => void;
}

export default function SidebarHeader({ onClose }: SidebarHeaderProps) {
  const { isDark } = useTheme();

  return (
    <div className={`flex items-center justify-between px-4 h-[65px] border-b ${
      isDark ? 'border-neutral-800' : 'border-gray-200'
    }`}>
      {/* Logo mascotte + title */}
      <div className="flex items-center gap-3">
        <Image
          src="/chat/mascotte.png"
          alt="Nareo"
          width={48}
          height={48}
          className="rounded-xl"
        />
        <span className={`text-lg font-bold ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
          Nareo
        </span>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className={`p-2 rounded-lg transition-colors ${
          isDark
            ? 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
        }`}
        aria-label="Fermer la sidebar"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
