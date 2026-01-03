import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mes amis',
  description: 'Gérez vos amis sur Nareo. Partagez votre code ami et défiez-les en quiz.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AmisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
