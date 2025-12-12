'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { trackVisitor } from '@/lib/visitors';
import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';
import Image from 'next/image';

// Cookie utilities
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

// Get guest session ID from cookie OR localStorage (localStorage survives email verification redirect)
function getGuestSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return getCookie('guestSessionId') || localStorage.getItem('guestSessionId');
}

// Clear guest session ID from both cookie and localStorage
function clearGuestSessionId(): void {
  if (typeof window === 'undefined') return;
  deleteCookie('guestSessionId');
  localStorage.removeItem('guestSessionId');
}

export default function AuthCallbackCompletePage() {
  const router = useRouter();
  const { translate } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);
  const [canCloseTab, setCanCloseTab] = useState(false);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const supabase = createSupabaseBrowserClient();

        // Get the user from the session
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          throw new Error('No user found');
        }

        console.log('✅ User authenticated:', user.id);

        // Track visitor (add to visitors table if not exists)
        await trackVisitor(user.id, user.email || '');

        // Check if this is a new user (profile doesn't exist yet)
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('user_id, subscription_tier')
          .eq('user_id', user.id)
          .single();

        const isNewUser = !existingProfile;

        // Create profile if it doesn't exist (upsert to avoid duplicates)
        // Extract full_name from user_metadata (first_name set during signup)
        const firstName = user.user_metadata?.first_name || user.user_metadata?.full_name || '';

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            user_id: user.id,
            email: user.email || '',
            full_name: firstName,
            subscription_tier: 'free',
          }, {
            onConflict: 'user_id',
            ignoreDuplicates: false, // Update if exists to fill missing data
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
        } else {
          console.log('✅ Profile ensured for user:', user.id);
        }

        // Link any guest courses to this user
        // Check both cookie AND localStorage (localStorage survives email verification redirect)
        const guestSessionId = getGuestSessionId();
        console.log('🔍 Guest session ID (cookie or localStorage):', guestSessionId);
        if (guestSessionId) {
          try {
            // Get the session to include auth token in the request
            const { data: { session } } = await supabase.auth.getSession();
            const linkResponse = await fetch('/api/courses/link-guest', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
              },
              body: JSON.stringify({ guestSessionId }),
            });
            const linkResult = await linkResponse.json();
            if (linkResponse.ok && linkResult.linked > 0) {
              console.log(`✅ Linked ${linkResult.linked} guest course(s) to account`);
            } else if (!linkResponse.ok) {
              console.error('Link guest courses failed:', linkResult);
            }
            // Clear the guest session ID from both cookie and localStorage after linking
            clearGuestSessionId();
          } catch (linkError) {
            console.error('Error linking guest courses:', linkError);
            // Non-blocking error - continue with auth flow
          }
        }

        // Create a new session record if it doesn't exist
        const { error: sessionError } = await supabase
          .from('sessions')
          .insert([{
            user_id: user.id,
            started_at: new Date().toISOString(),
          }]);

        if (sessionError && sessionError.code !== '23505') {
          // Ignore duplicate key errors (23505), log others
          console.error('Error creating session:', sessionError);
        }

        // Small delay to ensure everything is set
        await new Promise(resolve => setTimeout(resolve, 500));

        // Notify original tab via BroadcastChannel that email is verified
        let broadcastSucceeded = false;
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('email-verification');
            channel.postMessage({ type: 'EMAIL_VERIFIED', isNewUser });
            broadcastSucceeded = true;

            // Keep channel open briefly to ensure message is delivered
            setTimeout(() => channel.close(), 1000);
          }
        } catch (e) {
          console.log('BroadcastChannel not supported:', e);
        }

        // Show "you can close this tab" message
        setCanCloseTab(true);
        setVerifying(false);

        // Store isNewUser for the "Continue" button
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('isNewUser', isNewUser ? 'true' : 'false');
        }
      } catch (err: any) {
        console.error('❌ Auth callback error:', err);
        setError(err.message || translate('auth_callback_error'));
        setVerifying(false);
      }
    };

    handleAuthCallback();
  }, [router, translate]);

  if (error) {
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
              {error}
            </p>
            <Link
              href="/auth/signin"
              className="inline-block px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition"
            >
              {translate('auth_callback_back_to_signin')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo"
            width={400}
            height={400}
            className={`mx-auto mb-4 ${verifying ? 'animate-bounce' : ''}`}
          />
          {canCloseTab ? (
            <>
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {translate('auth_callback_success')}
              </h2>
              <p className="text-gray-600 mb-4">
                {translate('auth_callback_close_tab')}
              </p>

              {/* Separator */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-400">{translate('or')}</span>
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                {translate('auth_callback_original_closed')}
              </p>
              <button
                onClick={() => {
                  const isNewUser = sessionStorage.getItem('isNewUser') === 'true';
                  if (isNewUser) {
                    router.push('/auth/signup?step=plan');
                  } else {
                    router.push('/dashboard');
                  }
                }}
                className="w-full px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition"
              >
                {translate('auth_callback_continue_nareo')}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {verifying ? translate('auth_callback_verifying') : translate('auth_callback_success')}
              </h2>
              {verifying && (
                <p className="text-gray-600">
                  {translate('loading')}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
