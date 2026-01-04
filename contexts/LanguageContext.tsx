'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { translations, Language, Translations } from '@/lib/translations';

export type { Language };

interface LanguageContextType {
  currentLanguage: Language;
  setLanguage: (language: Language) => void;
  translate: (key: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>) => string;
  translateContent: (content: string, contentType?: string) => Promise<string>;
  translationCache: Map<string, { fr: string; en: string }>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'levelup_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');
  const [isInitialized, setIsInitialized] = useState(false);
  const [translationCache, setTranslationCache] = useState<Map<string, { fr: string; en: string }>>(new Map());

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Check if language is already stored in localStorage
    const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;

    if (storedLanguage && (storedLanguage === 'fr' || storedLanguage === 'en' || storedLanguage === 'de')) {
      // Use stored language preference
      setCurrentLanguage(storedLanguage);
    } else {
      // Detect browser language on first visit
      const browserLanguage = navigator.language || (navigator as any).userLanguage;
      const langLower = browserLanguage.toLowerCase();

      // Detect language based on browser settings
      let detectedLanguage: Language = 'en';
      if (langLower.startsWith('fr')) {
        detectedLanguage = 'fr';
      } else if (langLower.startsWith('de')) {
        detectedLanguage = 'de';
      }

      setCurrentLanguage(detectedLanguage);
      localStorage.setItem(LANGUAGE_STORAGE_KEY, detectedLanguage);
    }

    setIsInitialized(true);
  }, []);

  const setLanguage = (language: Language) => {
    setCurrentLanguage(language);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  };

  const translate = (key: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>): string => {
    // Determine fallback and params based on argument types
    const fallback = typeof fallbackOrParams === 'string' ? fallbackOrParams : undefined;
    const actualParams = typeof fallbackOrParams === 'object' ? fallbackOrParams : params;

    let translation = translations[currentLanguage]?.[key] || translations['en']?.[key];

    // If no translation found, use fallback or empty string (never show raw keys)
    if (!translation) {
      translation = fallback || '';
    }

    // Replace parameters in translation if provided
    if (actualParams) {
      Object.keys(actualParams).forEach((paramKey) => {
        translation = translation.replace(`{${paramKey}}`, String(actualParams[paramKey]));
      });
    }

    return translation;
  };

  const translateContent = async (content: string, contentType: string = 'message'): Promise<string> => {
    if (!content || content.trim().length === 0) return content;

    // Create cache key
    const cacheKey = `${content.substring(0, 100)}_${contentType}`;
    
    // Check if we have this content in cache
    const cached = translationCache.get(cacheKey);
    if (cached) {
      return currentLanguage === 'fr' ? cached.fr : cached.en;
    }

    try {
      // Call translation API
      const response = await fetch('/api/translate/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          targetLanguage: currentLanguage,
          contentType,
        }),
      });

      if (!response.ok) {
        console.error('Translation API error:', response.statusText);
        return content; // Return original on error
      }

      const data = await response.json();
      const translated = data.translated || content;

      // Update cache
      const newCache = new Map(translationCache);
      const originalLang = data.originalLanguage || (currentLanguage === 'fr' ? 'en' : 'fr');
      newCache.set(cacheKey, {
        fr: currentLanguage === 'fr' ? translated : content,
        en: currentLanguage === 'en' ? translated : content,
      });
      setTranslationCache(newCache);

      return translated;
    } catch (error) {
      console.error('Error translating content:', error);
      return content; // Return original on error
    }
  };

  // Don't render children until language is initialized to prevent flash of wrong language
  if (!isInitialized) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ currentLanguage, setLanguage, translate, translateContent, translationCache }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
