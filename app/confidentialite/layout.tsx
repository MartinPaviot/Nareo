import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité',
  description: 'Découvrez comment Nareo protège vos données personnelles. Conformité RGPD, collecte de données, vos droits et comment les exercer.',
  keywords: ['RGPD', 'données personnelles', 'vie privée', 'confidentialité Nareo'],
  alternates: {
    canonical: 'https://www.usenareo.com/confidentialite',
  },
};

export default function ConfidentialiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
