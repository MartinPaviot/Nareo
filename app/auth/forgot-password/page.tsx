import type { Metadata } from 'next';
import ForgotPassword from '@/components/auth/ForgotPassword';

export const metadata: Metadata = {
  title: 'Mot de passe oublié',
  description: 'Réinitialisez votre mot de passe Nareo. Recevez un lien de réinitialisation par email en quelques secondes.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordPage() {
  return <ForgotPassword />;
}
