import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Erreur d\'authentification',
  description: 'Une erreur s\'est produite lors de l\'authentification.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthErrorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
