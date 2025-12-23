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
        <div className="max-w-5xl mx-auto px-6 sm:px-8 py-10 sm:py-12">
          <div className="flex flex-wrap md:flex-nowrap justify-between gap-y-8 gap-x-8">
            {/* Brand */}
            <div className="w-full md:w-auto md:max-w-[200px]">
              <Link href="/" className="flex items-center gap-2 mb-3">
                <Image
                  src="/chat/mascotte.png"
                  alt="Nareo"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Nareo</span>
              </Link>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Ta plateforme intelligente pour étudier mieux et plus vite.
              </p>
            </div>

            {/* Legal Information */}
            <div className="w-1/2 md:w-auto">
              <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Informations légales</h3>
              <ul className={`space-y-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <li>
                  <Link href="/cgu" className="hover:text-orange-500 transition-colors">
                    Conditions d&apos;utilisation
                  </Link>
                </li>
                <li>
                  <Link href="/cgv" className="hover:text-orange-500 transition-colors">
                    Conditions de vente
                  </Link>
                </li>
                <li>
                  <Link href="/mentions-legales" className="hover:text-orange-500 transition-colors">
                    Mentions légales
                  </Link>
                </li>
                <li>
                  <Link href="/confidentialite" className="hover:text-orange-500 transition-colors">
                    Politique de confidentialité
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="hover:text-orange-500 transition-colors">
                    Politique des cookies
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div className="w-1/2 md:w-auto">
              <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Support</h3>
              <ul className={`space-y-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <li>
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="hover:text-orange-500 transition-colors"
                  >
                    Contact
                  </button>
                </li>
                <li>
                  <Link href="/compte" className="hover:text-orange-500 transition-colors">
                    Paramètres du compte
                  </Link>
                </li>
              </ul>
            </div>

            {/* Follow Us */}
            <div className="w-1/2 md:w-auto">
              <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Nous suivre</h3>
              <ul className={`space-y-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <li>
                  <a
                    href="https://instagram.com/nareo.music"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-orange-500 transition-colors"
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  <a
                    href="https://tiktok.com/@nareo.music"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-orange-500 transition-colors"
                  >
                    TikTok
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className={`mt-10 pt-6 border-t text-center ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>© 2025 Nareo</p>
          </div>
        </div>
      </footer>

      {showContactModal && (
        <ContactModal onClose={() => setShowContactModal(false)} />
      )}
    </>
  );
}
