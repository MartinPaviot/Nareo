import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { PosthogProvider } from '@/contexts/PosthogProvider';
import { CoursesRefreshProvider } from '@/contexts/CoursesRefreshContext';
import Footer from '@/components/layout/Footer';
import CookieBannerWrapper from '@/components/layout/CookieBannerWrapper';
import ConditionalGTM from '@/components/analytics/ConditionalGTM';

const inter = Inter({ subsets: ['latin'] });

// JSON-LD Structured Data for Organization - helps Google display favicon
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Nareo',
  url: 'https://www.usenareo.com',
  logo: 'https://www.usenareo.com/images/favicon-512x512.png',
  sameAs: [],
  description: 'Nareo transforme vos PDF et documents en quiz personnalisés, flashcards et résumés grâce à l\'IA.',
};

// JSON-LD for WebSite with SearchAction - improves search presence
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Nareo',
  url: 'https://www.usenareo.com',
  description: 'Transformez vos cours en quiz interactifs avec l\'IA',
  publisher: {
    '@type': 'Organization',
    name: 'Nareo',
    logo: {
      '@type': 'ImageObject',
      url: 'https://www.usenareo.com/images/favicon-512x512.png',
      width: 512,
      height: 512,
    },
  },
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.usenareo.com'),
  title: {
    default: 'Nareo | Transformez vos cours en quiz interactifs avec l\'IA',
    template: '%s | Nareo',
  },
  description: 'Nareo transforme vos PDF et documents en quiz personnalisés, flashcards et résumés grâce à l\'IA. Révisez 2x plus efficacement avec la méthode du testing effect. Essai gratuit.',
  keywords: [
    'révision IA',
    'quiz automatique',
    'flashcards IA',
    'apprentissage actif',
    'testing effect',
    'révision efficace',
    'étudiant',
    'examens',
    'mémorisation',
    'PDF en quiz',
    'tuteur IA',
    'Nareo',
  ],
  authors: [{ name: 'Nareo' }],
  creator: 'Nareo',
  publisher: 'Nareo',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/images/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/images/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/images/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/images/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    other: [
      { rel: 'mask-icon', url: '/favicon.ico', color: '#000000' },
    ],
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Nareo | Transformez vos cours en quiz interactifs avec l\'IA',
    description: 'Révisez 2x plus efficacement. Nareo convertit vos PDF en quiz personnalisés, flashcards et résumés grâce à l\'intelligence artificielle.',
    url: 'https://www.usenareo.com',
    siteName: 'Nareo',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Nareo - Votre tuteur IA pour réviser efficacement',
      },
    ],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nareo | Transformez vos cours en quiz avec l\'IA',
    description: 'Révisez 2x plus efficacement. Convertissez vos PDF en quiz, flashcards et résumés personnalisés.',
    images: ['/images/og-image.png'],
  },
  alternates: {
    canonical: 'https://www.usenareo.com',
    languages: {
      'fr-FR': 'https://www.usenareo.com',
      'en-US': 'https://www.usenareo.com/en',
      'de-DE': 'https://www.usenareo.com/de',
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light">
      <head>
        {/* JSON-LD Structured Data for better SEO and favicon display */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <Suspense fallback={null}>
          <PosthogProvider>
            <AuthProvider>
              <LanguageProvider>
                <ThemeProvider>
                  <CoursesRefreshProvider>
                    {/* Conditional GTM - only loads if analytics consent is given */}
                    <ConditionalGTM />
                    <div className="min-h-screen flex flex-col">
                      <main className="flex-1">{children}</main>
                      <Footer />
                    </div>
                    {/* Cookie consent banner */}
                    <CookieBannerWrapper />
                  </CoursesRefreshProvider>
                </ThemeProvider>
              </LanguageProvider>
            </AuthProvider>
          </PosthogProvider>
        </Suspense>
      </body>
    </html>
  );
}
