import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Abonnement Premium',
  description: 'Passez à Nareo Premium : cours illimités, quiz personnalisés, flashcards avancées et défis entre amis. À partir de 6,99€/mois.',
  keywords: ['Nareo premium', 'abonnement révision', 'prix Nareo', 'offre étudiant'],
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: 'Abonnement Premium | Nareo',
    description: 'Révisez sans limite avec Nareo Premium. Cours illimités et fonctionnalités avancées.',
  },
};

export default function PaywallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
