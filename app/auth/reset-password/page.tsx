import type { Metadata } from 'next';
import ResetPassword from '@/components/auth/ResetPassword';

export const metadata: Metadata = {
  title: 'Réinitialiser le mot de passe',
  description: 'Créez un nouveau mot de passe pour votre compte Nareo.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordPage() {
  return <ResetPassword />;
}
