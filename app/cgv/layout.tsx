import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente',
  description: 'Consultez les conditions générales de vente de Nareo. Tarifs, modalités de paiement, droit de rétractation et remboursements.',
  alternates: {
    canonical: 'https://www.usenareo.com/cgv',
  },
};

export default function CGVLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
