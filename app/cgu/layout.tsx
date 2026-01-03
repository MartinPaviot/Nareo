import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conditions Générales d\'Utilisation',
  description: 'Consultez les conditions générales d\'utilisation de Nareo. Règles d\'utilisation du service, droits et obligations des utilisateurs.',
  alternates: {
    canonical: 'https://www.usenareo.com/cgu',
  },
};

export default function CGULayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
