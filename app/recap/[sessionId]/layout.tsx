import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Récapitulatif de session',
  description: 'Résumé de votre session de révision. Consultez vos performances et les points à revoir.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RecapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
