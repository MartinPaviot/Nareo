'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ContactModal from './ContactModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';

// Pages with integrated footer (hide global footer completely)
const INTEGRATED_FOOTER_PATTERNS = [
  /^\/courses\/[^/]+\/learn/, // Learn page has its own footer
  /^\/flashcards\/review\//, // Flashcard review page has its own footer
];

// Pages where micro footer should be shown (work screens)
const MICRO_FOOTER_PATTERNS = [
  /^\/courses\/[^/]+\/chapters\/[^/]+$/, // Quiz pages
  /^\/courses\/[^/]+\/chapters\/[^/]+\/result/, // Result pages
  /^\/learn\//, // Concept learning
  /^\/recap\//, // Recap pages
  /^\/study-plan\//, // Study plan pages
  /^\/dashboard/, // Dashboard
  /^\/compte/, // Account settings
  /^\/admin/, // Admin pages
  /^\/paywall/, // Paywall
  /^\/defi\/[^/]+$/, // Challenge pages (specific challenge)
];

export default function Footer() {
  const [showContactModal, setShowContactModal] = useState(false);
  const pathname = usePathname();
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  // Pages with integrated footer - hide global footer completely
  const hasIntegratedFooter = INTEGRATED_FOOTER_PATTERNS.some(pattern => pattern.test(pathname));
  if (hasIntegratedFooter) {
    return null;
  }

  const isWorkScreen = MICRO_FOOTER_PATTERNS.some(pattern => pattern.test(pathname));

  // Micro footer for work screens
  if (isWorkScreen) {
    return (
      <>
        <footer className={`border-t ${
          isDark
            ? 'bg-neutral-900/50 border-neutral-800'
            : 'bg-gray-50/50 border-gray-100'
        }`}>
          <div className={`max-w-5xl mx-auto px-4 py-1.5 flex items-center justify-center gap-4 text-[10px] ${
            isDark ? 'text-neutral-500' : 'text-gray-400'
          }`}>
            <span>© 2026 Nareo</span>
            <span className={isDark ? 'text-neutral-700' : 'text-gray-300'}>·</span>
            <button
              onClick={() => setShowContactModal(true)}
              className="hover:text-orange-500 transition-colors"
            >
              Contact
            </button>
          </div>
        </footer>
        {showContactModal && (
          <ContactModal onClose={() => setShowContactModal(false)} />
        )}
      </>
    );
  }

  // Full footer for marketing/static pages
  return (
    <>
      <footer className={`border-t ${
        isDark
          ? 'bg-gray-900 border-gray-700'
          : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-6 sm:pt-8 pb-4">
          {/* CTA Section */}
          <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 mb-6 border-b ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="relative -my-4">
                <Image
                  src="/chat/mascotte.png"
                  alt="Nareo"
                  width={48}
                  height={48}
                  className="rounded-lg"
                />
              </div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {translate('footer_cta_ready', 'Prêt à améliorer tes révisions ?')}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/auth/signup"
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#ff751f' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
              >
                {translate('footer_cta_create_account', 'Créer un compte')}
              </Link>
              <Link
                href="/#upload"
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  isDark
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {translate('footer_cta_drop_course', 'Déposer un cours')}
              </Link>
            </div>
          </div>

          {/* Links row */}
          <div className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>
            <Link href="/blog" className="hover:text-orange-500 transition-colors">
              Blog
            </Link>
            <Link href="/cgu" className="hover:text-orange-500 transition-colors">
              {translate('footer_link_cgu', 'CGU')}
            </Link>
            <Link href="/cgv" className="hover:text-orange-500 transition-colors">
              {translate('footer_link_cgv', 'CGV')}
            </Link>
            <Link href="/mentions-legales" className="hover:text-orange-500 transition-colors">
              {translate('footer_link_mentions', 'Mentions légales')}
            </Link>
            <Link href="/confidentialite" className="hover:text-orange-500 transition-colors">
              {translate('footer_link_privacy', 'Confidentialité')}
            </Link>
            <Link href="/cookies" className="hover:text-orange-500 transition-colors">
              {translate('footer_link_cookies', 'Cookies')}
            </Link>
            <button
              onClick={() => setShowContactModal(true)}
              className="hover:text-orange-500 transition-colors"
            >
              {translate('footer_link_contact', 'Contact')}
            </button>
            <a
              href="https://instagram.com/nareo.music"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-500 transition-colors"
            >
              Instagram
            </a>
            <a
              href="https://tiktok.com/@nareo.music"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-500 transition-colors"
            >
              TikTok
            </a>
          </div>

          {/* Copyright */}
          <div className="mt-4 text-center">
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>© 2026 Nareo</p>
          </div>
        </div>
      </footer>

      {showContactModal && (
        <ContactModal onClose={() => setShowContactModal(false)} />
      )}
    </>
  );
}
