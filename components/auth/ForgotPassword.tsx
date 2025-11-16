'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ForgotPassword() {
  const { translate } = useLanguage();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError(translate('auth_forgot_error_empty'));
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError(translate('auth_forgot_error_empty'));
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }
      );

      if (resetError) throw resetError;

      setSuccess(translate('auth_forgot_success'));
      setEmail('');
    } catch (err: any) {
      setError(err.message || translate('auth_forgot_error_failed'));
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
            <div className="text-6xl">🔑</div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {translate('auth_forgot_title')}
          </h1>
          <p className="text-gray-600">
            {translate('auth_forgot_subtitle')}
          </p>
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
                {translate('auth_forgot_email_label')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                placeholder={translate('auth_forgot_email_placeholder')}
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
              {loading ? translate('auth_forgot_button_loading') : translate('auth_forgot_button')}
            </button>
          </form>

          {/* Back to Sign In Link */}
          <div className="mt-6 text-center">
            <Link
              href="/auth/signin"
              className="text-sm text-orange-500 hover:text-orange-600 font-semibold"
            >
              ← {translate('auth_forgot_back_to_signin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
