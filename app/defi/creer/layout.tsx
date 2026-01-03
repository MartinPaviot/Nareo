import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Créer un défi',
  description: 'Créez un défi quiz multijoueur et invitez vos amis à vous affronter sur vos cours.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreerDefiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
