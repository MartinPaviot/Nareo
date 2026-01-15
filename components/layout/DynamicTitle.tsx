'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Component that dynamically updates the document title based on the current language.
 * This is necessary because Next.js metadata is generated server-side and cannot
 * access the client-side language context.
 */
export default function DynamicTitle() {
  const { translate } = useLanguage();

  useEffect(() => {
    const title = translate('site_title', 'Nareo | Turn your courses into interactive quizzes with AI');
    document.title = title;
  }, [translate]);

  return null;
}
