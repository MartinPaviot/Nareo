import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Découvrez nos conseils et méthodes pour réviser efficacement. Techniques de mémorisation, testing effect, flashcards et astuces d\'étudiants.',
  keywords: [
    'conseils révision',
    'méthodes apprentissage',
    'testing effect',
    'mémorisation efficace',
    'techniques étude',
    'réussir examens',
    'astuces étudiants',
    'flashcards méthode',
  ],
  openGraph: {
    title: 'Blog | Nareo',
    description: 'Conseils et méthodes pour réviser efficacement. Techniques de mémorisation prouvées scientifiquement.',
    type: 'website',
  },
  alternates: {
    canonical: 'https://www.usenareo.com/blog',
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
