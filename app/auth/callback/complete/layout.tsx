import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vérification en cours',
  description: 'Finalisation de votre connexion Nareo.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CallbackCompleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
