'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { trackVisitor } from '@/lib/visitors';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SignIn() {
  const router = useRouter();
  const { translate } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(translate('auth_signin_error_empty'));
      return;
    }

    setLoading(true);

    try {
      // Sign in with Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (data.user) {
        // Track visitor (add to visitors table if not exists)
        await trackVisitor(data.user.id, data.user.email || '');

        // Create a new session record
        const { error: sessionError } = await supabase
          .from('sessions')
          .insert([{
            user_id: data.user.id,
            started_at: new Date().toISOString(),
          }]);

        if (sessionError) {
          console.error('Error creating session:', sessionError);
        }

        // Redirect to home page
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || translate('auth_signin_error_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="text-6xl">🎓🐱</div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {translate('auth_signin_title')}
          </h1>
          <p className="text-gray-600">{translate('auth_signin_subtitle')}</p>
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
                {translate('auth_signin_email_label')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                placeholder={translate('auth_signin_email_placeholder')}
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {translate('auth_signin_password_label')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                placeholder={translate('auth_signin_password_placeholder')}
                disabled={loading}
              />
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <Link
                href="/auth/forgot-password"
                className="text-sm text-orange-500 hover:text-orange-600"
              >
                {translate('auth_signin_forgot_password')}
              </Link>
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
              disabled={loading}
              className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? translate('auth_signin_button_loading') : translate('auth_signin_button')}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {translate('auth_signin_no_account')}{' '}
              <Link
                href="/auth/signup"
                className="text-orange-500 hover:text-orange-600 font-semibold"
              >
                {translate('auth_signin_signup_link')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
