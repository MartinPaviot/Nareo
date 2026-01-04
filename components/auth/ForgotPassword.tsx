'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export default function ForgotPassword() {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
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
    <div className={cn(
      'min-h-screen flex items-center justify-center p-4',
      isDark
        ? 'bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900'
        : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'
    )}>
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="text-6xl">🔑</div>
          </div>
          <h1 className={cn('text-3xl font-bold mb-2', isDark ? 'text-gray-100' : 'text-gray-900')}>
            {translate('auth_forgot_title')}
          </h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            {translate('auth_forgot_subtitle')}
          </p>
        </div>

        {/* Form */}
        <div className={cn('rounded-2xl shadow-lg p-8', isDark ? 'bg-neutral-800' : 'bg-white')}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className={cn('block text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}
              >
                {translate('auth_forgot_email_label')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(
                  'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition',
                  isDark
                    ? 'bg-neutral-700 border-gray-600 text-gray-100 placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                )}
                placeholder={translate('auth_forgot_email_placeholder')}
                disabled={loading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="px-4 py-3 rounded-lg text-sm border"
                style={{
                  backgroundColor: isDark ? 'rgba(217, 26, 28, 0.15)' : '#fff6f3',
                  borderColor: isDark ? 'rgba(217, 26, 28, 0.5)' : 'rgba(217, 26, 28, 0.3)',
                  color: isDark ? '#e94446' : '#d91a1c'
                }}
              >
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div
                className="px-4 py-3 rounded-lg text-sm border"
                style={{
                  backgroundColor: isDark ? 'rgba(55, 159, 90, 0.15)' : 'rgba(55, 159, 90, 0.1)',
                  borderColor: isDark ? 'rgba(55, 159, 90, 0.5)' : 'rgba(55, 159, 90, 0.3)',
                  color: isDark ? '#5cb978' : '#379f5a'
                }}
              >
                {success}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#ff751f' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#e5681b')}
              onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#ff751f')}
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
