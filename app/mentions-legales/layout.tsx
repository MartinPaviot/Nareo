import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions Légales',
  description: 'Mentions légales de Nareo. Informations sur l\'éditeur, l\'hébergeur et les conditions d\'utilisation du site.',
  alternates: {
    canonical: 'https://www.usenareo.com/mentions-legales',
  },
};

export default function MentionsLegalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
