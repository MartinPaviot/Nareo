import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Défis quiz',
  description: 'Défiez vos amis en quiz ! Créez des défis multijoueurs sur vos cours et comparez vos scores en temps réel.',
  keywords: ['défi quiz', 'quiz multijoueur', 'révision entre amis', 'challenge révision'],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Défis quiz | Nareo',
    description: 'Défiez vos amis en quiz et révisez ensemble de manière ludique.',
  },
};

export default function DefiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
