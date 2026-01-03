import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apprentissage',
  description: 'Approfondissez vos connaissances sur ce concept avec des explications détaillées et des exemples.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LearnConceptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
