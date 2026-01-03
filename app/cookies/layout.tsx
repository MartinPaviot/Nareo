import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique des Cookies',
  description: 'Découvrez comment Nareo utilise les cookies. Types de cookies, finalités et comment gérer vos préférences.',
  alternates: {
    canonical: 'https://www.usenareo.com/cookies',
  },
};

export default function CookiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
