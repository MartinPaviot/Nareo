'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export default function ResetPassword() {
  const router = useRouter();
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateForm = () => {
    if (!password || !confirmPassword) {
      setError(translate('auth_reset_error_empty'));
      return false;
    }

    if (password.length < 6) {
      setError(translate('auth_reset_error_short'));
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
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setSuccess(translate('auth_reset_success'));
      setPassword('');
      setConfirmPassword('');

      // Redirect to sign in after 2 seconds
      setTimeout(() => {
        router.push('/auth/signin');
      }, 2000);
    } catch (err: any) {
      setError(err.message || translate('auth_reset_error_failed'));
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
            <div className="text-6xl">🔐</div>
          </div>
          <h1 className={cn('text-3xl font-bold mb-2', isDark ? 'text-gray-100' : 'text-gray-900')}>
            {translate('auth_reset_title')}
          </h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>{translate('auth_reset_subtitle')}</p>
        </div>

        {/* Form */}
        <div className={cn('rounded-2xl shadow-lg p-8', isDark ? 'bg-neutral-800' : 'bg-white')}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* New Password */}
            <div>
              <label
                htmlFor="password"
                className={cn('block text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}
              >
                {translate('auth_reset_password_label')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    'w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition',
                    isDark
                      ? 'bg-neutral-700 border-gray-600 text-gray-100 placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  )}
                  placeholder={translate('auth_reset_password_placeholder')}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    'absolute right-3 top-1/2 -translate-y-1/2 transition-colors',
                    isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                  )}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className={cn('block text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}
              >
                {translate('auth_reset_confirm_label')}
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={cn(
                    'w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition',
                    isDark
                      ? 'bg-neutral-700 border-gray-600 text-gray-100 placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  )}
                  placeholder={translate('auth_reset_confirm_placeholder')}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={cn(
                    'absolute right-3 top-1/2 -translate-y-1/2 transition-colors',
                    isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                  )}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
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
              {loading ? translate('auth_reset_button_loading') : translate('auth_reset_button')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
