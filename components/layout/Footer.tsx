'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
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
              CGU
            </Link>
            <Link href="/contact" className="text-gray-600 hover:text-orange-600">
              Contact
            </Link>
            <Link href="/cgv" className="text-gray-600 hover:text-orange-600">
              CGV
            </Link>
            <Link href="/faq" className="text-gray-600 hover:text-orange-600">
              FAQ
            </Link>
            <Link href="/mentions-legales" className="text-gray-600 hover:text-orange-600">
              Mentions légales
            </Link>
            <Link href="/compte" className="text-gray-600 hover:text-orange-600">
              Mon compte
            </Link>
            <Link href="/confidentialite" className="text-gray-600 hover:text-orange-600">
              Confidentialité
            </Link>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-orange-600">
              Instagram
            </a>
            <Link href="/cookies" className="text-gray-600 hover:text-orange-600">
              Cookies
            </Link>
            <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-orange-600">
              TikTok
            </a>
          </div>

          {/* Copyright */}
          <p className="text-xs text-gray-500 text-center mt-4 pt-4 border-t border-gray-200">
            © 2025 Nareo – Tous droits réservés.
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
                Ta plateforme intelligente pour réviser mieux et plus vite.
              </p>
            </div>

            {/* Bloc Informations légales */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Informations légales</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/cgu" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                    Conditions d'utilisation
                  </Link>
                </li>
                <li>
                  <Link href="/cgv" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                    Conditions de vente
                  </Link>
                </li>
                <li>
                  <Link href="/mentions-legales" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                    Mentions légales
                  </Link>
                </li>
                <li>
                  <Link href="/confidentialite" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                    Politique de confidentialité
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                    Gestion des cookies
                  </Link>
                </li>
              </ul>
            </div>

            {/* Bloc Support */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Support</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/contact" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/compte" className="text-sm text-gray-600 hover:text-orange-600 transition-colors">
                    Paramètres du compte
                  </Link>
                </li>
              </ul>
            </div>

            {/* Bloc Réseaux sociaux */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Suivez-nous</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-600 hover:text-orange-600 transition-colors"
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  <a
                    href="https://tiktok.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-600 hover:text-orange-600 transition-colors"
                  >
                    TikTok
                  </a>
                </li>
                <li>
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-600 hover:text-orange-600 transition-colors"
                  >
                    LinkedIn
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer bottom */}
          <div className="mt-10 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              © 2025 Nareo – Tous droits réservés.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
