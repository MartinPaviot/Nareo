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
      className={className || "flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all shadow-md hover:shadow-lg"}
      title={targetLanguage === 'fr' ? 'Passer au français' : 'Switch to English'}
    >
      <Languages className="w-4 h-4 text-gray-600" />
      <span className="font-semibold text-gray-900">
        {targetLanguage.toUpperCase()}
      </span>
    </button>
  );
}
