'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ContactModal from './ContactModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { openCookieSettings } from './CookieBanner';

export default function Footer() {
  const [showContactModal, setShowContactModal] = useState(false);
  const { currentLanguage, translate } = useLanguage();

  // Social media links based on language
  const instagramLink = currentLanguage === 'fr'
    ? 'https://www.instagram.com/nareo_fr/'
    : 'https://www.instagram.com/nareo_global/';

  const tiktokLink = currentLanguage === 'fr'
    ? 'https://www.tiktok.com/@nareo_fr'
    : 'https://www.tiktok.com/@nareo_global';

  return (
    <>
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          {/* Mobile: Compact layout */}
          <div className="sm:hidden">
            {/* Branding row */}
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/chat/Happy.png"
                alt="Nareo"
                width={32}
                height={32}
                className="rounded-full"
              />
              <span className="text-base font-bold text-gray-900">Nareo</span>
            </div>

            {/* Links in 2 columns */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <Link href="/cgu" className="text-gray-600 hover:text-orange-600">
                {translate('legal_page_title_cgu')}
              </Link>
              <button onClick={() => setShowContactModal(true)} className="text-left text-gray-600 hover:text-orange-600">
                {translate('footer_contact')}
              </button>
              <Link href="/cgv" className="text-gray-600 hover:text-orange-600">
                {translate('legal_page_title_cgv')}
              </Link>
              <Link href="/compte" className="text-gray-600 hover:text-orange-600">
                {translate('footer_my_account')}
              </Link>
              <Link href="/mentions-legales" className="text-gray-600 hover:text-orange-600">
                {translate('legal_page_title_mentions')}
              </Link>
              <a href={instagramLink} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-orange-600">
                Instagram
              </a>
              <Link href="/confidentialite" className="text-gray-600 hover:text-orange-600">
                {translate('legal_page_title_privacy')}
              </Link>
              <a href={tiktokLink} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-orange-600">
                TikTok
              </a>
              <Link href="/cookies" className="text-gray-600 hover:text-orange-600">
                {translate('legal_page_title_cookies')}
              </Link>
              <button
                onClick={openCookieSettings}
                className="text-left text-gray-600 hover:text-orange-600"
              >
                {translate('cookie_manage_settings')}
              </button>
            </div>

            {/* Copyright */}
            <p className="text-xs text-gray-500 text-center mt-4 pt-4 border-t border-gray-200">
              © 2025 Nareo
            </p>
          </div>

          {/* Desktop: Full layout */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Bloc Branding */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Image
                    src="/chat/Happy.png"
                    alt="Nareo"
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                  <span className="text-lg font-bold text-gray-900">Nareo</span>
                </div>
                <p className="text-sm text-gray-600">
                  {translate('footer_tagline')}
                </p>
              </div>

              {/* Bloc Informations légales */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">{translate('footer_legal_title')}</h3>
                <ul className="space-y-2">
                  <li>
                    <Link href="/cgu" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                      {translate('legal_page_title_cgu')}
                    </Link>
                  </li>
                  <li>
                    <Link href="/cgv" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                      {translate('legal_page_title_cgv')}
                    </Link>
                  </li>
                  <li>
                    <Link href="/mentions-legales" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                      {translate('legal_page_title_mentions')}
                    </Link>
                  </li>
                  <li>
                    <Link href="/confidentialite" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                      {translate('legal_page_title_privacy')}
                    </Link>
                  </li>
                  <li>
                    <Link href="/cookies" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                      {translate('legal_page_title_cookies')}
                    </Link>
                  </li>
                  <li>
                    <button
                      onClick={openCookieSettings}
                      className="text-sm text-gray-600 hover:text-orange-600 transition-colors"
                    >
                      {translate('cookie_manage_settings')}
                    </button>
                  </li>
                </ul>
              </div>

              {/* Bloc Support */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">{translate('footer_support_title')}</h3>
                <ul className="space-y-2">
                  <li>
                    <button onClick={() => setShowContactModal(true)} className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                      {translate('footer_contact')}
                    </button>
                  </li>
                  <li>
                    <Link href="/compte" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                      {translate('footer_account_settings')}
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Bloc Réseaux sociaux */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">{translate('footer_follow_us')}</h3>
                <ul className="space-y-2">
                  <li>
                    <a
                      href={instagramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 hover:text-orange-600 transition-colors"
                    >
                      Instagram
                    </a>
                  </li>
                  <li>
                    <a
                      href={tiktokLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 hover:text-orange-600 transition-colors"
                    >
                      TikTok
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer bottom */}
            <div className="mt-10 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500 text-center">
                © 2025 Nareo
              </p>
            </div>
          </div>
        </div>
      </footer>

      {showContactModal && (
        <ContactModal onClose={() => setShowContactModal(false)} />
      )}
    </>
  );
}
