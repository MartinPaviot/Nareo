'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ContactModal from './ContactModal';
import { useTheme } from '@/contexts/ThemeContext';

// Pages where footer should be completely hidden (work screens)
const NO_FOOTER_PATTERNS = [
  /^\/courses\/[^/]+\/chapters\/[^/]+$/, // Quiz pages
  /^\/courses\/[^/]+\/chapters\/[^/]+\/result/, // Result pages
  /^\/courses\/[^/]+\/learn/, // Learn/flashcard pages
  /^\/learn\//, // Concept learning
  /^\/recap\//, // Recap pages
  /^\/study-plan\//, // Study plan pages
  /^\/dashboard/, // Dashboard
  /^\/compte/, // Account settings
  /^\/admin/, // Admin pages
  /^\/paywall/, // Paywall
];

export default function Footer() {
  const [showContactModal, setShowContactModal] = useState(false);
  const pathname = usePathname();
  const { isDark } = useTheme();

  const isWorkScreen = NO_FOOTER_PATTERNS.some(pattern => pattern.test(pathname));

  // Micro footer for work screens
  if (isWorkScreen) {
    return (
      <>
        <footer className={`backdrop-blur-sm border-t ${
          isDark
            ? 'bg-gray-900/80 border-gray-700'
            : 'bg-white/80 border-gray-100'
        }`}>
          <div className={`max-w-5xl mx-auto px-4 py-2 flex items-center justify-center gap-4 text-xs ${
            isDark ? 'text-gray-400' : 'text-gray-400'
          }`}>
            <span>© 2025 Nareo</span>
            <span className={isDark ? 'text-gray-600' : 'text-gray-200'}>·</span>
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
                Prêt à améliorer tes révisions ?
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
              >
                Créer un compte
              </Link>
              <Link
                href="/upload"
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  isDark
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Déposer un cours
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
              CGU
            </Link>
            <Link href="/cgv" className="hover:text-orange-500 transition-colors">
              CGV
            </Link>
            <Link href="/mentions-legales" className="hover:text-orange-500 transition-colors">
              Mentions légales
            </Link>
            <Link href="/confidentialite" className="hover:text-orange-500 transition-colors">
              Confidentialité
            </Link>
            <Link href="/cookies" className="hover:text-orange-500 transition-colors">
              Cookies
            </Link>
            <button
              onClick={() => setShowContactModal(true)}
              className="hover:text-orange-500 transition-colors"
            >
              Contact
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
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>© 2025 Nareo</p>
          </div>
        </div>
      </footer>

      {showContactModal && (
        <ContactModal onClose={() => setShowContactModal(false)} />
      )}
    </>
  );
}
