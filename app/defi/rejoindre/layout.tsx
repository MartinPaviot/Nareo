import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rejoindre un défi',
  description: 'Rejoignez un défi quiz avec un code et affrontez vos amis en temps réel.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RejoindreDefiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
