'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { Languages } from 'lucide-react';

interface LanguageToggleProps {
  className?: string;
}

export default function LanguageToggle({ className }: LanguageToggleProps) {
  const { currentLanguage, setLanguage } = useLanguage();

  // The button shows the TARGET language (the one you'll switch TO)
  const targetLanguage = currentLanguage === 'en' ? 'fr' : 'en';

  const toggleLanguage = () => {
    setLanguage(targetLanguage);
  };

  return (
    <button
      onClick={toggleLanguage}
      className={className || "flex items-center gap-2 h-10 px-4 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md"}
      title={targetLanguage === 'fr' ? 'Passer au français' : 'Switch to English'}
    >
      <Languages className="w-4 h-4 text-gray-600" />
      <span className="text-sm font-medium text-gray-700 min-w-[1.5rem] text-center">
        {targetLanguage.toUpperCase()}
      </span>
    </button>
  );
}
