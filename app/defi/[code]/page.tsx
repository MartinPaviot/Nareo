'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Challenge } from '@/types/defi';
import ChallengeLobby from '@/components/defi/ChallengeLobby';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface PageProps {
  params: Promise<{ code: string }>;
}

export default function ChallengePage({ params }: PageProps) {
  const { code } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChallengeAndPlayer();
  }, [code, user]);

  const fetchChallengeAndPlayer = async () => {
    try {
      const supabase = createSupabaseBrowserClient();

      // Fetch challenge
      const { data: challengeData, error: challengeError } = await supabase
        .from('challenges')
        .select(`
          *,
          course:courses(id, title),
          chapter:chapters(id, title),
          players:challenge_players(*)
        `)
        .eq('code', code.toUpperCase())
        .maybeSingle();

      if (challengeError || !challengeData) {
        setError('Défi introuvable');
        setLoading(false);
        return;
      }

      setChallenge(challengeData as Challenge);
      setIsHost(challengeData.host_id === user?.id);

      // Find player ID
      // First check sessionStorage (for guests who just joined)
      const storedPlayerId = sessionStorage.getItem(`challenge_player_${code}`);

      if (storedPlayerId) {
        // Verify the player exists
        const player = challengeData.players?.find((p: any) => p.id === storedPlayerId);
        if (player) {
          setPlayerId(storedPlayerId);
          setDisplayName(player.display_name);
          setLoading(false);
          return;
        }
      }

      // If authenticated, find or create player
      if (user) {
        const existingPlayer = challengeData.players?.find(
          (p: any) => p.user_id === user.id
        );

        if (existingPlayer) {
          setPlayerId(existingPlayer.id);
          setDisplayName(existingPlayer.display_name);
          setLoading(false);
          return;
        }

        // User is authenticated but not in the challenge - redirect to join
        router.push(`/defi/rejoindre?code=${code}`);
        return;
      }

      // Not authenticated and no stored player ID - redirect to join
      router.push(`/defi/rejoindre?code=${code}`);
    } catch (err) {
      console.error('Error fetching challenge:', err);
      setError('Erreur lors du chargement du défi');
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Chargement du défi...
          </p>
        </div>
      </div>
    );
  }

  if (error || !challenge || !playerId) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${
            isDark ? 'text-red-400' : 'text-red-500'
          }`} />
          <h1 className={`text-xl font-bold mb-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            {error || 'Défi introuvable'}
          </h1>
          <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Ce défi n'existe pas ou a été supprimé.
          </p>
          <button
            onClick={() => router.push('/defi')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Retour aux défis
          </button>
        </div>
      </div>
    );
  }

  return (
    <ChallengeLobby
      challenge={challenge}
      playerId={playerId}
      userId={user?.id || null}
      displayName={displayName}
      isHost={isHost}
    />
  );
}
