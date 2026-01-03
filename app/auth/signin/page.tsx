import type { Metadata } from 'next';
import SignIn from '@/components/auth/SignIn';

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous à Nareo pour accéder à vos cours, quiz personnalisés et flashcards. Reprenez vos révisions là où vous les avez laissées.',
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: 'Connexion | Nareo',
    description: 'Connectez-vous à Nareo pour accéder à vos cours et réviser efficacement.',
  },
};

export default function SignInPage() {
  return <SignIn />;
}
