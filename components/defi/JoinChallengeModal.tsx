'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Loader2,
  Users,
  AlertCircle,
  Clock,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChallengePreview {
  id: string;
  code: string;
  status: string;
  time_per_question: number;
  host_profile: {
    display_name: string;
    avatar_url?: string;
  };
  course?: {
    title: string;
  };
  chapter?: {
    title: string;
  };
  player_count: number;
}

interface JoinChallengeModalProps {
  onClose: () => void;
  initialCode?: string;
}

export default function JoinChallengeModal({
  onClose,
  initialCode = '',
}: JoinChallengeModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState(initialCode);
  const [preview, setPreview] = useState<ChallengePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Format code as XXXX-XXXX
  const formatCode = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length <= 4) {
      return cleaned;
    }
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value);
    setCode(formatted);
    setError(null);
    setPreview(null);

    // Auto-fetch preview when code is complete (9 chars including dash)
    if (formatted.length === 9) {
      fetchPreview(formatted);
    }
  };

  const fetchPreview = async (challengeCode: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/defi/join?code=${challengeCode}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Défi non trouvé');
      }

      setPreview(data.challenge);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!code || code.length !== 9) {
      setError(translate('challenge_code_invalid', 'Code invalide'));
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const response = await fetch('/api/defi/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          displayName: user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Joueur',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la connexion');
      }

      router.push(`/defi/${code}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setJoining(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 9 && preview && !joining) {
      handleJoin();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md rounded-2xl shadow-xl ${
          isDark ? 'bg-neutral-900' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-6 border-b ${
            isDark ? 'border-neutral-800' : 'border-gray-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {translate('challenge_join_title', 'Rejoindre un défi')}
              </h2>
              <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {translate('challenge_with_code', 'Avec un code')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Error */}
          {error && (
            <div
              className="p-4 rounded-xl flex items-center gap-3"
              style={{
                backgroundColor: isDark ? 'rgba(217, 26, 28, 0.15)' : '#fff6f3',
                color: isDark ? '#f87171' : '#d91a1c'
              }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Code input */}
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-neutral-300' : 'text-gray-700'
              }`}
            >
              {translate('challenge_code_label', 'Code du défi')}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={handleCodeChange}
              onKeyDown={handleKeyDown}
              placeholder="XXXX-XXXX"
              maxLength={9}
              className={`w-full p-4 rounded-xl text-center text-2xl font-mono font-bold tracking-widest uppercase ${
                isDark
                  ? 'bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500'
                  : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-300'
              } focus:outline-none focus:border-orange-500 transition-colors`}
            />
            <p
              className={`mt-2 text-sm text-center ${
                isDark ? 'text-neutral-500' : 'text-gray-400'
              }`}
            >
              {translate('challenge_code_placeholder', 'Entre le code')}
            </p>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          )}

          {/* Challenge preview */}
          {preview && !loading && (
            <div
              className={`p-4 rounded-xl ${
                isDark ? 'bg-neutral-800' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Host avatar */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                    isDark ? 'bg-neutral-700 text-neutral-300' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {preview.host_profile.avatar_url ? (
                    <img
                      src={preview.host_profile.avatar_url}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    preview.host_profile.display_name.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {preview.chapter?.title || preview.course?.title || 'Défi'}
                  </div>
                  <div className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                    {translate('challenge_host', 'Hôte')}: {preview.host_profile.display_name}
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    <div
                      className={`flex items-center gap-1 text-sm ${
                        isDark ? 'text-neutral-400' : 'text-gray-500'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      {preview.player_count} {preview.player_count > 1
                        ? translate('challenge_players_plural', 'joueurs')
                        : translate('challenge_players', 'joueur')
                      }
                    </div>
                    <div
                      className={`flex items-center gap-1 text-sm ${
                        isDark ? 'text-neutral-400' : 'text-gray-500'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      {preview.time_per_question}s
                    </div>
                  </div>
                </div>
              </div>

              {/* Status badge */}
              {preview.status === 'lobby' && (
                <div
                  className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                    isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  {translate('challenge_waiting', 'En attente')}
                </div>
              )}
              {preview.status === 'playing' && (
                <div
                  className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                    isDark ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {translate('challenge_playing', 'En cours')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex gap-3 p-6 border-t ${
            isDark ? 'border-neutral-800' : 'border-gray-100'
          }`}
        >
          <button
            onClick={onClose}
            disabled={joining}
            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
              isDark
                ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            {translate('cancel', 'Annuler')}
          </button>
          <button
            onClick={handleJoin}
            disabled={joining || code.length !== 9 || !preview || preview.status !== 'lobby'}
            className="flex-1 px-4 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {joining ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {translate('challenge_connecting', 'Connexion...')}
              </>
            ) : (
              <>
                <Users className="w-5 h-5" />
                {translate('challenge_join', 'Rejoindre')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
