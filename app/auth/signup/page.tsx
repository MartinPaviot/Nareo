import type { Metadata } from 'next';
import SignUp from '@/components/auth/SignUp';

export const metadata: Metadata = {
  title: 'Inscription gratuite',
  description: 'Créez votre compte Nareo gratuitement et commencez à transformer vos cours en quiz interactifs. 3 cours offerts pour tester la plateforme.',
  keywords: ['inscription Nareo', 'créer compte', 'révision gratuite', 'quiz IA gratuit'],
  openGraph: {
    title: 'Inscription gratuite | Nareo',
    description: 'Créez votre compte gratuit et transformez vos PDF en quiz personnalisés avec l\'IA.',
  },
};

export default function SignUpPage() {
  return <SignUp />;
}
