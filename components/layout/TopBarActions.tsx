'use client';

import LanguageToggle from './LanguageToggle';
import SignOutButton from './SignOutButton';

interface TopBarActionsProps {
  className?: string;
}

export default function TopBarActions({ className }: TopBarActionsProps) {
  return (
    <div className={`flex items-center gap-3 ${className || ''}`}>
      <LanguageToggle />
      <SignOutButton />
    </div>
  );
}
