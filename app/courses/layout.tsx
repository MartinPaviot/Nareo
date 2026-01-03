import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cours',
  description: 'Révisez avec des quiz personnalisés, flashcards interactives et résumés générés par IA. Apprentissage adaptatif basé sur vos performances.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CoursesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
