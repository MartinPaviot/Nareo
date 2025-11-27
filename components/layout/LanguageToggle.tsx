'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Languages } from 'lucide-react';
import type { Language } from '@/lib/translations';

interface LanguageToggleProps {
  className?: string;
}

const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
};

const LANGUAGE_FLAGS: Record<Language, string> = {
  en: '🇬🇧',
  fr: '🇫🇷',
  de: '🇩🇪',
};

export default function LanguageToggle({ className }: LanguageToggleProps) {
  const { currentLanguage, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={className || "flex items-center gap-2 h-10 px-4 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md"}
        title="Change language"
      >
        <Languages className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">
          {LANGUAGE_FLAGS[currentLanguage]} {currentLanguage.toUpperCase()}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {(['en', 'fr', 'de'] as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => handleLanguageSelect(lang)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                currentLanguage === lang ? 'bg-orange-50' : ''
              }`}
            >
              <span className="text-xl">{LANGUAGE_FLAGS[lang]}</span>
              <span className={`text-sm font-medium ${
                currentLanguage === lang ? 'text-orange-600' : 'text-gray-700'
              }`}>
                {LANGUAGE_LABELS[lang]}
              </span>
              {currentLanguage === lang && (
                <span className="ml-auto text-orange-600">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
