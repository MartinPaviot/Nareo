import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apprentissage',
  description: 'Étudiez efficacement avec les résumés IA, quiz adaptatifs et flashcards. Mémorisation optimisée grâce au testing effect.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
