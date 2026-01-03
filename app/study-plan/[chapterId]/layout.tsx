import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Plan d\'étude personnalisé',
  description: 'Votre plan de révision personnalisé basé sur vos performances. Concentrez-vous sur les notions à améliorer.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function StudyPlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
