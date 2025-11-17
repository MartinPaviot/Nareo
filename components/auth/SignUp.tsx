'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { trackVisitor } from '@/lib/visitors';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SignUp() {
  const router = useRouter();
  const { translate } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    if (!email || !password || !confirmPassword) {
      setError(translate('auth_signup_error_empty'));
      return false;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError(translate('auth_signup_error_empty'));
      return false;
    }

    if (password.length < 6) {
      setError(translate('auth_signup_error_password'));
      return false;
    }

    if (password !== confirmPassword) {
      setError(translate('auth_reset_error_mismatch'));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            email_confirm: false
          }
        },
      });

      if (signUpError) throw signUpError;

      // Track visitor if user was created
      if (data.user) {
        await trackVisitor(data.user.id, data.user.email || '');
        
        // Auto sign in after successful signup (no email confirmation needed)
        console.log('✅ User signed up successfully:', data.user.id);
        
        // Redirect to home page immediately
        router.push('/');
        router.refresh();
      } else {
        setSuccess(translate('auth_reset_success'));
        setEmail('');
        setPassword('');
        setConfirmPassword('');

        // Redirect to sign in after 3 seconds
        setTimeout(() => {
          router.push('/auth/signin');
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || translate('auth_signup_error_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Image
            src="/chat/mascotte.png"
            alt="Aristo Mascotte"
            width={240}
            height={240}
            className="mx-auto mb-6"
            priority
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {translate('auth_signup_title')}
          </h1>
          <p className="text-gray-600">{translate('auth_signup_subtitle')}</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {translate('auth_signup_email_label')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                placeholder={translate('auth_signup_email_placeholder')}
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {translate('auth_signup_password_label')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                placeholder={translate('auth_signup_password_placeholder')}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">{translate('auth_signup_password_hint')}</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {translate('auth_reset_confirm_label')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                placeholder={translate('auth_reset_confirm_placeholder')}
                disabled={loading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {success}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? translate('auth_signup_button_loading') : translate('auth_signup_button')}
            </button>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {translate('auth_signup_have_account')}{' '}
              <Link
                href="/auth/signin"
                className="text-orange-500 hover:text-orange-600 font-semibold"
              >
                {translate('auth_signup_signin_link')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
