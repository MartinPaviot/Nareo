import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Résultats du quiz',
  description: 'Consultez vos résultats et identifiez les points à réviser. Analyse détaillée de vos performances.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
