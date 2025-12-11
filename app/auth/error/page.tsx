'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Mail, RefreshCw } from 'lucide-react';

export default function AuthErrorPage() {
  const { translate } = useLanguage();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Parse error from URL hash
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorDescription, setErrorDescription] = useState<string | null>(null);

  useEffect(() => {
    // Parse error from URL - can be in query params OR hash depending on Supabase config
    if (typeof window !== 'undefined') {
      // First try query parameters (most common for redirects)
      const urlParams = new URLSearchParams(window.location.search);
      let code = urlParams.get('error_code');
      let description = urlParams.get('error_description')?.replace(/\+/g, ' ') || null;

      // If not in query params, try hash (some Supabase flows use hash)
      if (!code) {
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        code = hashParams.get('error_code');
        description = hashParams.get('error_description')?.replace(/\+/g, ' ') || null;
      }

      setErrorCode(code);
      setErrorDescription(description);
    }
  }, []);

  const isExpiredLink = errorCode === 'otp_expired';

  const handleResendEmail = async () => {
    if (!email) {
      setError(translate('auth_error_enter_email'));
      return;
    }

    setSending(true);
    setError('');

    try {
      // Use signInWithOtp to send a magic link (works for all users)
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (otpError) throw otpError;

      setSent(true);
    } catch (err: any) {
      console.error('Resend error:', err);
      setError(err.message || translate('auth_error_resend_failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {translate('auth_callback_error')}
          </h2>
          <p className="text-gray-600 mb-6">
            {isExpiredLink
              ? translate('auth_error_link_expired')
              : translate('auth_error_description')
            }
          </p>

          {/* Show resend form for expired links */}
          {isExpiredLink && !sent && (
            <div className="mb-6 space-y-4">
              <p className="text-sm text-gray-500">
                {translate('auth_error_resend_prompt')}
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={translate('auth_email_placeholder')}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <button
                onClick={handleResendEmail}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition disabled:opacity-50"
              >
                {sending ? (
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

          {/* Success message after resend */}
          {sent && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center justify-center gap-2 text-green-700">
                <Mail className="w-5 h-5" />
                <p className="font-medium">{translate('auth_error_email_sent')}</p>
              </div>
              <p className="text-sm text-green-600 mt-2">
                {translate('auth_error_check_inbox')}
              </p>
            </div>
          )}

          <Link
            href="/auth/signin"
            className="inline-block px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition"
          >
            {translate('auth_callback_back_to_signin')}
          </Link>
        </div>
      </div>
    </div>
  );
}
