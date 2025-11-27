import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { PosthogProvider } from '@/contexts/PosthogProvider';
import FeedbackWidget from '@/components/layout/FeedbackWidget';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Aristo\'Chat - AI-Powered Learning',
  description: 'Transform your PDFs into interactive learning experiences with Aristo, your AI tutor',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PosthogProvider>
          <AuthProvider>
            <LanguageProvider>
              {children}
              <FeedbackWidget />
            </LanguageProvider>
          </AuthProvider>
        </PosthogProvider>
      </body>
    </html>
  );
}
