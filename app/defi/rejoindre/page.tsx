'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Users,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Challenge } from '@/types/defi';

function JoinChallengeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  const codeFromUrl = searchParams.get('code') || '';

  const [code, setCode] = useState(codeFromUrl);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(!!codeFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [challengePreview, setChallengePreview] = useState<any | null>(null);

  // Fetch user's display name if authenticated
  useEffect(() => {
    if (user?.email) {
      setDisplayName(user.email.split('@')[0]);
    }
  }, [user]);

  // Fetch challenge preview when code changes
  useEffect(() => {
    if (code.length === 9) {
      fetchChallengePreview(code);
    } else {
      setChallengePreview(null);
    }
  }, [code]);

  const fetchChallengePreview = async (challengeCode: string) => {
    setPreviewLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/defi/join?code=${challengeCode}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error);
        setChallengePreview(null);
      } else {
        setChallengePreview(data.challenge);
      }
    } catch (err) {
      setError(translate('challenge_join_error'));
      setChallengePreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!code.trim() || !displayName.trim()) {
      setError(translate('challenge_join_fill_fields'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/defi/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          displayName: displayName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || translate('challenge_connection_error'));
      }

      // Store player ID for the lobby
      sessionStorage.setItem(`challenge_player_${code}`, data.player.id);

      router.push(`/defi/${code.toUpperCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setLoading(false);
    }
  };

  const handleCodeChange = (value: string) => {
    // Format: XXXX-XXXX
    let formatted = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (formatted.length > 4) {
      formatted = formatted.slice(0, 4) + '-' + formatted.slice(4, 8);
    }
    setCode(formatted);
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-md mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/defi"
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'
            }`}
          >
            <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
          </Link>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {translate('challenge_join_title')}
            </h1>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {translate('challenge_code_placeholder')}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
          }`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Form */}
        <div className={`rounded-xl p-6 ${
          isDark ? 'bg-gray-800' : 'bg-white shadow-md'
        }`}>
          {/* Code input */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {translate('challenge_code_label')}
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="XXXX-XXXX"
              maxLength={9}
              className={`w-full px-4 py-3 rounded-lg font-mono text-2xl tracking-widest text-center uppercase ${
                isDark
                  ? 'bg-gray-700 text-white placeholder-gray-500 border border-gray-600'
                  : 'bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200'
              } focus:outline-none focus:ring-2 focus:ring-orange-500`}
            />
          </div>

          {/* Challenge preview */}
          {previewLoading && (
            <div className={`mb-6 p-4 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-gray-700' : 'bg-gray-50'
            }`}>
              <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            </div>
          )}

          {challengePreview && !previewLoading && (
            <div className={`mb-6 p-4 rounded-lg ${
              isDark ? 'bg-gray-700' : 'bg-gray-50'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🎮</span>
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {challengePreview.chapter?.title ||
                      challengePreview.course?.title ||
                      'Quiz personnalisé'}
                  </p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {translate('challenge_host')}: {challengePreview.host?.display_name || '?'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className={`flex items-center gap-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  <Users className="w-4 h-4" />
                  {challengePreview.players?.length || 0} {translate('challenge_players')}
                </span>
                <span className={`px-2 py-0.5 rounded ${
                  challengePreview.status === 'lobby'
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-yellow-500/20 text-yellow-500'
                }`}>
                  {challengePreview.status === 'lobby' ? translate('challenge_waiting') : translate('challenge_playing')}
                </span>
              </div>
            </div>
          )}

          {/* Display name input */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {translate('challenge_username_placeholder')}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={translate('challenge_username_placeholder')}
              maxLength={20}
              className={`w-full px-4 py-3 rounded-lg ${
                isDark
                  ? 'bg-gray-700 text-white placeholder-gray-500 border border-gray-600'
                  : 'bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200'
              } focus:outline-none focus:ring-2 focus:ring-orange-500`}
            />
          </div>

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={loading || !code.trim() || !displayName.trim() || !!error}
            className="w-full py-4 rounded-xl font-medium text-lg transition-colors flex items-center justify-center gap-2 text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
            style={{ backgroundColor: loading || !code.trim() || !displayName.trim() || !!error ? undefined : '#ff751f' }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#e5681b';
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#ff751f';
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {translate('challenge_connecting')}
              </>
            ) : (
              <>
                <Users className="w-5 h-5" />
                {translate('challenge_join_button')}
              </>
            )}
          </button>
        </div>

        {/* Guest mode notice */}
        {!user && (
          <p className={`mt-4 text-center text-sm ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}>
            Tu joues en tant qu'invité.{' '}
            <Link href="/auth/signin" className="text-orange-500 hover:underline">
              Connecte-toi
            </Link>{' '}
            pour sauvegarder tes points.
          </p>
        )}
      </div>
    </div>
  );
}

export default function JoinChallengePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    }>
      <JoinChallengeContent />
    </Suspense>
  );
}
