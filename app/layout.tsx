import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { PosthogProvider } from '@/contexts/PosthogProvider';
import FeedbackWidget from '@/components/layout/FeedbackWidget';
import Footer from '@/components/layout/Footer';
import CookieBannerWrapper from '@/components/layout/CookieBannerWrapper';
import ConditionalGTM from '@/components/analytics/ConditionalGTM';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Nareo - AI-Powered Learning',
  description: 'Transform your PDFs into interactive learning experiences with Nareo, your AI tutor',
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
                {/* Conditional GTM - only loads if analytics consent is given */}
                <ConditionalGTM />
                <div className="min-h-screen flex flex-col">
                  <main className="flex-1">{children}</main>
                  <Footer />
                </div>
                <FeedbackWidget />
                {/* Cookie consent banner */}
                <CookieBannerWrapper />
              </LanguageProvider>
            </AuthProvider>
          </PosthogProvider>
        </Suspense>
      </body>
    </html>
  );
}
