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
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
    setEmailVerificationSent(false);

    if (!validateForm()) return;

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) throw signUpError;

      // Don't auto sign in - show email verification message instead
      if (data.user) {
        await trackVisitor(data.user.id, data.user.email || '');

        // Clear form
        setEmail('');
        setPassword('');
        setConfirmPassword('');

        // Show verification message
        setEmailVerificationSent(true);
      }
    } catch (err: any) {
      setError(err.message || translate('auth_signup_error_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || translate('auth_signup_error_failed'));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo Mascotte"
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
          {/* Email Verification Success Message */}
          {emailVerificationSent ? (
            <div className="space-y-4">
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {translate('auth_signup_email_verification_title')}
                </h3>
                <p className="text-sm text-gray-700 mb-2">
                  {translate('auth_signup_verification_required')}
                </p>
                <p className="text-xs text-gray-600">
                  {translate('auth_signup_verification_info')}
                </p>
              </div>
              <div className="text-center">
                <Link
                  href="/auth/signin"
                  className="text-orange-500 hover:text-orange-600 font-semibold text-sm"
                >
                  {translate('auth_callback_back_to_signin')}
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {googleLoading ? translate('auth_continue_with_google_loading') : translate('auth_continue_with_google')}
              </button>

              {/* Separator */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">{translate('auth_oauth_separator')}</span>
                </div>
              </div>

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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || googleLoading}
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
          </>
          )}
        </div>
      </div>
    </div>
  );
}
