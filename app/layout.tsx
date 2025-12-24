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

export const metadata: Metadata = {
  metadataBase: new URL('https://www.usenareo.com'),
  title: 'Nareo - AI-Powered Learning',
  description: 'Transform your PDFs into interactive learning experiences with Nareo, your AI tutor',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/images/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/images/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/images/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Nareo - AI-Powered Learning',
    description: 'Transform your PDFs into interactive learning experiences with Nareo, your AI tutor',
    url: 'https://www.usenareo.com',
    siteName: 'Nareo',
    images: [
      {
        url: '/images/favicon-512x512.png',
        width: 512,
        height: 512,
        alt: 'Nareo Logo',
      },
    ],
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Nareo - AI-Powered Learning',
    description: 'Transform your PDFs into interactive learning experiences with Nareo, your AI tutor',
    images: ['/images/favicon-512x512.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
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
