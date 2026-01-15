'use client';

import Image from 'next/image';
import { X } from 'lucide-react';

interface SidebarHeaderProps {
  onClose: () => void;
}

export default function SidebarHeader({ onClose }: SidebarHeaderProps) {
  return (
    <div className="flex-shrink-0">
      <div className="h-[51px] flex items-center justify-between px-3">
        {/* Logo mascotte + title */}
        <div className="flex items-center gap-2">
          <Image
            src="/chat/mascotte2.png"
            alt="Nareo"
            width={24}
            height={24}
            className="rounded-lg"
          />
          <span
            className="text-base font-semibold tracking-tight"
            style={{ color: 'var(--sidebar-text)' }}
          >
            Nareo
          </span>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors duration-150 text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-nareo)] focus-visible:ring-offset-2"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label="Fermer la sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Separator line - full width */}
      <div
        className="w-full h-px"
        style={{ backgroundColor: 'var(--sidebar-border)' }}
      />
    </div>
  );
}
