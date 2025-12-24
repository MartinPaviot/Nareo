'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { trackVisitor } from '@/lib/visitors';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, ArrowLeft, Loader2, RefreshCw, Mail } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import PlanSelector from './PlanSelector';
import { useAuth } from '@/contexts/AuthContext';
import { getAnonymousContext, clearAnonymousContext } from '@/lib/anonymous-session';

export default function SignUp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';
  const stepParam = searchParams.get('step');
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(stepParam === 'plan');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedCGU, setAcceptedCGU] = useState(false);
  const [acceptedMarketing, setAcceptedMarketing] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');

  // If user is logged in and step=plan, show plan selector
  useEffect(() => {
    if (user && stepParam === 'plan') {
      setShowPlanSelector(true);
    }
  }, [user, stepParam]);

  // Listen for email verification from another tab via BroadcastChannel
  useEffect(() => {
    if (!emailVerificationSent) return;

    const channel = new BroadcastChannel('email-verification');

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'EMAIL_VERIFIED') {
        // Refresh the session to get the user
        await supabase.auth.refreshSession();

        // Show plan selector for new users before redirecting
        if (event.data?.isNewUser) {
          setShowPlanSelector(true);
          setEmailVerificationSent(false);
        } else {
          // Existing user - redirect to returnTo or dashboard
          router.push(returnTo || '/dashboard');
        }
      }
    };

    channel.addEventListener('message', handleMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [emailVerificationSent, router, returnTo]);

  const validateForm = () => {
    if (!firstName || !email || !password || !confirmPassword) {
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

    if (!acceptedCGU) {
      setError(translate('auth_signup_error_cgu'));
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
          data: {
            first_name: firstName,
            marketing_consent: acceptedMarketing,
            cgu_accepted_at: new Date().toISOString(),
          },
        },
      });

      if (signUpError) throw signUpError;

      // Don't auto sign in - show email verification message instead
      if (data.user) {
        await trackVisitor(data.user.id, data.user.email || '');

        // Clear form
        setFirstName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setAcceptedCGU(false);
        setAcceptedMarketing(false);

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

  const handleSelectFreePlan = () => {
    // Check if there's a saved anonymous context (e.g., from quiz results)
    const anonymousContext = getAnonymousContext();
    if (anonymousContext?.returnPath) {
      // Clear the context and redirect to where they were
      clearAnonymousContext();
      router.push(anonymousContext.returnPath);
    } else {
      router.push(returnTo);
    }
  };

  const handleResendEmail = async () => {
    if (!resendEmail) {
      setResendError(translate('auth_error_enter_email'));
      return;
    }

    setResending(true);
    setResendError('');
    setResendSuccess(false);

    try {
      // Use signInWithOtp to send a magic link (works for both verified and unverified users)
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: resendEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (otpErr) throw otpErr;

      setResendSuccess(true);
    } catch (err: any) {
      console.error('Resend error:', err);
      setResendError(err.message || translate('auth_error_resend_failed'));
    } finally {
      setResending(false);
    }
  };

  // Show plan selector if user is logged in and on plan step
  if (showPlanSelector && user) {
    return (
      <PlanSelector
        onSelectFree={handleSelectFreePlan}
        returnTo={returnTo}
      />
    );
  }

  // Show loading while waiting for user to load after email verification
  if (showPlanSelector && !user) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center p-4',
        isDark
          ? 'bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900'
          : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'
      )}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>{translate('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'min-h-screen flex items-center justify-center p-4',
      isDark
        ? 'bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900'
        : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'
    )}>
      <div className="max-w-md w-full">
        {/* Back Button */}
        <button
          onClick={() => router.push(returnTo)}
          className={cn(
            'flex items-center gap-2 mb-4 transition-colors',
            isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{translate('account_back')}</span>
        </button>

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
          <h1 className={cn('text-3xl font-bold mb-2', isDark ? 'text-gray-100' : 'text-gray-900')}>
            {translate('auth_signup_title')}
          </h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>{translate('auth_signup_subtitle')}</p>
        </div>

        {/* Form */}
        <div className={cn('rounded-2xl shadow-lg p-8', isDark ? 'bg-neutral-800' : 'bg-white')}>
          {/* Email Verification Success Message */}
          {emailVerificationSent ? (
            <div className="space-y-4">
              <div className={cn(
                'border-2 rounded-xl p-6 text-center',
                isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'
              )}>
                <div className={cn(
                  'mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4',
                  isDark ? 'bg-green-900/30' : 'bg-green-100'
                )}>
                  <svg className={cn('w-8 h-8', isDark ? 'text-green-400' : 'text-green-600')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className={cn('text-xl font-bold mb-2', isDark ? 'text-gray-100' : 'text-gray-900')}>
                  {translate('auth_signup_email_verification_title')}
                </h3>
                <p className={cn('text-sm mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                  {translate('auth_signup_verification_required')}
                </p>
                <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  {translate('auth_signup_verification_info')}
                </p>
              </div>

              {/* Resend email section */}
              <div className={cn('border-t pt-4 mt-4', isDark ? 'border-gray-700' : 'border-gray-200')}>
                <p className={cn('text-sm mb-3 text-center', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {translate('auth_error_resend_prompt')}
                </p>

                {resendSuccess ? (
                  <div className={cn(
                    'p-4 border rounded-xl',
                    isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'
                  )}>
                    <div className={cn('flex items-center justify-center gap-2', isDark ? 'text-green-400' : 'text-green-700')}>
                      <Mail className="w-5 h-5" />
                      <p className="font-medium">{translate('auth_error_email_sent')}</p>
                    </div>
                    <p className={cn('text-sm mt-2 text-center', isDark ? 'text-green-400' : 'text-green-600')}>
                      {translate('auth_error_check_inbox')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder={translate('auth_email_placeholder')}
                      className={cn(
                        'w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500',
                        isDark
                          ? 'bg-neutral-700 border-gray-600 text-gray-100 placeholder-gray-400'
                          : 'bg-white border-gray-200 text-gray-900'
                      )}
                    />
                    {resendError && (
                      <p className={cn('text-sm', isDark ? 'text-red-400' : 'text-red-600')}>{resendError}</p>
                    )}
                    <button
                      onClick={handleResendEmail}
                      disabled={resending}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition disabled:opacity-50"
                    >
                      {resending ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {translate('sending')}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-5 h-5" />
                          {translate('auth_error_resend_button')}
                        </>
                      )}
                    </button>
                  </div>
                )}
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
                className={cn(
                  'w-full flex items-center justify-center gap-3 px-4 py-3 border-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed mb-4',
                  isDark
                    ? 'border-gray-600 text-gray-200 hover:bg-neutral-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                )}
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
                  <div className={cn('w-full border-t', isDark ? 'border-gray-600' : 'border-gray-300')}></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className={cn('px-4', isDark ? 'bg-neutral-800 text-gray-400' : 'bg-white text-gray-500')}>{translate('auth_oauth_separator')}</span>
                </div>
              </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* First Name */}
            <div>
              <label
                htmlFor="firstName"
                className={cn('block text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}
              >
                {translate('auth_signup_firstname_label')}
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={cn(
                  'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition',
                  isDark
                    ? 'bg-neutral-700 border-gray-600 text-gray-100 placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                )}
                placeholder={translate('auth_signup_firstname_placeholder')}
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className={cn('block text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}
              >
                {translate('auth_signup_email_label')}
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
                placeholder={translate('auth_signup_email_placeholder')}
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className={cn('block text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}
              >
                {translate('auth_signup_password_label')}
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
                  placeholder={translate('auth_signup_password_placeholder')}
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
              <p className={cn('text-xs mt-1', isDark ? 'text-gray-400' : 'text-gray-500')}>{translate('auth_signup_password_hint')}</p>
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

            {/* Checkboxes Container */}
            <div className="space-y-4">
              {/* CGU Checkbox - Required */}
              <label htmlFor="acceptCGU" className="flex items-start gap-3 cursor-pointer">
                <div className="flex items-center justify-center w-5 h-5 mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    id="acceptCGU"
                    checked={acceptedCGU}
                    onChange={(e) => setAcceptedCGU(e.target.checked)}
                    className={cn(
                      'h-4 w-4 rounded text-orange-500 focus:ring-orange-500 cursor-pointer',
                      isDark ? 'border-gray-600 bg-neutral-700' : 'border-gray-300'
                    )}
                    disabled={loading}
                  />
                </div>
                <span className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  {translate('auth_signup_cgu_label')}{' '}
                  <Link href="/cgu" className="text-orange-500 hover:text-orange-600 underline" target="_blank" onClick={(e) => e.stopPropagation()}>
                    {translate('auth_signup_cgu_link')}
                  </Link>{' '}
                  {translate('auth_signup_cgu_and')}{' '}
                  <Link href="/confidentialite" className="text-orange-500 hover:text-orange-600 underline" target="_blank" onClick={(e) => e.stopPropagation()}>
                    {translate('auth_signup_privacy_link')}
                  </Link>
                  <span className="text-red-500">*</span>
                </span>
              </label>

              {/* Marketing Checkbox - Optional */}
              <label htmlFor="acceptMarketing" className="flex items-start gap-3 cursor-pointer">
                <div className="flex items-center justify-center w-5 h-5 mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    id="acceptMarketing"
                    checked={acceptedMarketing}
                    onChange={(e) => setAcceptedMarketing(e.target.checked)}
                    className={cn(
                      'h-4 w-4 rounded text-orange-500 focus:ring-orange-500 cursor-pointer',
                      isDark ? 'border-gray-600 bg-neutral-700' : 'border-gray-300'
                    )}
                    disabled={loading}
                  />
                </div>
                <span className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  {translate('auth_signup_marketing_label')}
                </span>
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className={cn(
                'px-4 py-3 rounded-lg text-sm border',
                isDark
                  ? 'bg-red-900/20 border-red-800 text-red-400'
                  : 'bg-red-50 border-red-200 text-red-700'
              )}>
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || googleLoading || !acceptedCGU}
              className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? translate('auth_signup_button_loading') : translate('auth_signup_button')}
            </button>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
              {translate('auth_signup_have_account')}{' '}
              <Link
                href={`/auth/signin${returnTo !== '/' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
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
