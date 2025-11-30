'use client';

import Image from 'next/image';
import { NareoState } from '@/types/chat.types';

interface NareoAvatarProps {
  state: NareoState;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export default function NareoAvatar({
  state,
  size = 'md',
  className = ''
}: NareoAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className={`relative ${sizeClass} ${className}`}>
      <div className="absolute inset-0 bg-orange-100 rounded-full animate-pulse-slow opacity-50"></div>
      <div className="relative w-full h-full rounded-full overflow-hidden bg-orange-50 flex items-center justify-center border-2 border-orange-200 shadow-sm">
        <Image
          src="/chat/mascotte.png"
          alt="Nareo"
          fill
          className="object-cover"
          priority
        />
      </div>
    </div>
  );
}
