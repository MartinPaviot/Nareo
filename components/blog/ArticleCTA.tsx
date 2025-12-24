'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Sparkles } from 'lucide-react';

export default function ArticleCTA() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  return (
    <section
      className={`rounded-2xl p-8 text-center mt-12 ${
        isDark
          ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30'
          : 'bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200'
      }`}
    >
      <div className="flex justify-center mb-4">
        <div
          className={`p-3 rounded-full ${
            isDark ? 'bg-orange-500/20' : 'bg-orange-100'
          }`}
        >
          <Sparkles
            className={`w-8 h-8 ${
              isDark ? 'text-orange-400' : 'text-orange-600'
            }`}
          />
        </div>
      </div>

      <h2
        className={`text-2xl font-bold mb-3 ${
          isDark ? 'text-orange-400' : 'text-orange-700'
        }`}
      >
        {translate('blog_cta_title') || 'Prêt à réviser plus efficacement ?'}
      </h2>

      <p
        className={`text-base mb-6 max-w-lg mx-auto ${
          isDark ? 'text-neutral-300' : 'text-gray-700'
        }`}
      >
        {translate('blog_cta_description') ||
          'Nareo transforme automatiquement tes cours PDF en flashcards et quiz optimisés. Commence à réviser en 30 secondes.'}
      </p>

      <button
        onClick={() => router.push('/auth/signup')}
        className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/25"
      >
        {translate('blog_cta_button') || 'Essayer Nareo gratuitement'}
      </button>

      <p
        className={`text-xs mt-4 ${
          isDark ? 'text-neutral-500' : 'text-gray-500'
        }`}
      >
        {translate('blog_cta_note') || 'Pas de carte bancaire requise'}
      </p>
    </section>
  );
}
