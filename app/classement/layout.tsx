import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Classement',
  description: 'Consultez le classement hebdomadaire des meilleurs réviseurs Nareo. Gagnez des points et montez dans le leaderboard.',
  keywords: ['classement', 'leaderboard', 'meilleurs étudiants', 'compétition révision'],
  robots: {
    index: false,
    follow: false,
  },
};

export default function ClassementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
