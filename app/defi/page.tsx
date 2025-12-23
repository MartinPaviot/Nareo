'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Gamepad2,
  Plus,
  Users,
  Trophy,
  Clock,
  ArrowRight,
  Loader2,
  Flame,
  Medal,
  Crown,
  Play,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ChallengeListItem, UserChallengeStats } from '@/types/defi';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import PageHeaderWithMascot from '@/components/layout/PageHeaderWithMascot';

// Helper pour formater la date relative
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function DefiPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();

  const [activeChallenges, setActiveChallenges] = useState<ChallengeListItem[]>([]);
  const [recentChallenges, setRecentChallenges] = useState<ChallengeListItem[]>([]);
  const [stats, setStats] = useState<UserChallengeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin?redirect=/defi');
      return;
    }

    if (user) {
      fetchChallenges();
    }
  }, [user, authLoading, router]);

  const fetchChallenges = async () => {
    try {
      const supabase = createSupabaseBrowserClient();

      // Fetch active challenges (lobby or playing)
      const { data: active } = await supabase
        .from('challenges')
        .select(`
          id,
          code,
          time_per_question,
          status,
          created_at,
          host_id,
          course:courses(title),
          chapter:chapters(title),
          players:challenge_players(id, user_id, score, display_name)
        `)
        .in('status', ['lobby', 'playing'])
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch recent finished challenges where user participated
      const { data: recent } = await supabase
        .from('challenges')
        .select(`
          id,
          code,
          time_per_question,
          status,
          created_at,
          host_id,
          course:courses(title),
          chapter:chapters(title),
          players:challenge_players(id, user_id, score, display_name)
        `)
        .eq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch host profiles for all challenges
      const allHostIds = [
        ...(active?.map((c: any) => c.host_id) || []),
        ...(recent?.map((c: any) => c.host_id) || [])
      ].filter(Boolean);

      let hostProfiles: Record<string, { display_name: string; avatar_url: string | null }> = {};
      if (allHostIds.length > 0) {
        const { data: hosts } = await supabase
          .from('user_profiles')
          .select('id, display_name, avatar_url')
          .in('id', allHostIds);
        if (hosts) {
          hostProfiles = Object.fromEntries(hosts.map((h: any) => [h.id, { display_name: h.display_name, avatar_url: h.avatar_url }]));
        }
      }

      // Process challenges to add personal results
      const processChallenge = (c: any): ChallengeListItem => {
        const players = c.players || [];
        const sortedPlayers = [...players].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
        const myPlayer = players.find((p: any) => p.user_id === user?.id);
        const myRank = myPlayer ? sortedPlayers.findIndex((p: any) => p.id === myPlayer.id) + 1 : undefined;
        const winner = sortedPlayers[0];

        return {
          id: c.id,
          code: c.code,
          time_per_question: c.time_per_question,
          status: c.status,
          host_profile: hostProfiles[c.host_id] || { display_name: 'Hôte', avatar_url: null },
          course_title: c.course?.title,
          chapter_title: c.chapter?.title,
          player_count: players.length,
          created_at: c.created_at,
          my_rank: myRank,
          my_score: myPlayer?.score,
          winner_name: winner?.display_name,
        };
      };

      if (active) {
        setActiveChallenges(active.map(processChallenge));
      }

      // Filter recent to only show challenges user participated in
      if (recent) {
        const userChallenges = recent
          .filter((c: any) => c.players?.some((p: any) => p.user_id === user?.id))
          .slice(0, 5)
          .map(processChallenge);
        setRecentChallenges(userChallenges);

        // Calculate stats from challenges
        const wins = userChallenges.filter((c) => c.my_rank === 1).length;
        const challengePoints = userChallenges.reduce((sum, c) => sum + (c.my_score || 0), 0);

        // Fetch today's quiz points from daily_activity
        const today = new Date().toISOString().split('T')[0];
        const { data: dailyActivity } = await supabase
          .from('daily_activity')
          .select('points_earned')
          .eq('user_id', user?.id)
          .eq('activity_date', today)
          .single();

        const quizPoints = dailyActivity?.points_earned || 0;
        const totalPoints = challengePoints + quizPoints;

        setStats({
          total_played: userChallenges.length,
          total_wins: wins,
          total_points: totalPoints,
          current_streak: 0, // TODO: Calculate properly
          best_streak: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWithCode = () => {
    if (joinCode.trim()) {
      router.push(`/defi/rejoindre?code=${joinCode.trim().toUpperCase()}`);
    }
  };

  if (authLoading || loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PageHeaderWithMascot
        title="Mode Défi"
        subtitle="Affronte tes amis en temps réel"
        maxWidth="4xl"
        showDarkModeToggle
      />

      <div className="max-w-4xl mx-auto p-6">

        {/* Stats rapides - seulement si l'utilisateur a joué */}
        {stats && stats.total_played > 0 && (
          <div className={`rounded-xl p-4 mb-6 ${isDark ? 'bg-gray-800' : 'bg-white shadow-sm'}`}>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Gamepad2 className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                </div>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {stats.total_played}
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Défis joués
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                </div>
                <p className="text-2xl font-bold text-yellow-500">
                  {stats.total_wins}
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Victoires
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                </div>
                <p className="text-2xl font-bold text-orange-500">
                  {stats.total_points}
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Points
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions principales - Cards équilibrées */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Create challenge */}
          <Link
            href="/defi/creer"
            className={`group p-5 rounded-xl transition-all hover:scale-[1.02] ${
              isDark
                ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                : 'bg-gradient-to-br from-orange-500 to-orange-600'
            } text-white`}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white/20 group-hover:bg-white/30 transition-colors">
                <Plus className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-lg">Créer un défi</h2>
                <p className="text-sm text-white/80">
                  Invite tes amis
                </p>
              </div>
              <ArrowRight className="w-5 h-5 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          {/* Join with code */}
          <div className={`p-5 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white shadow-sm'}`}>
            <div className="flex items-center gap-4 mb-3">
              <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-orange-50'}`}>
                <Users className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h2 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Rejoindre
                </h2>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Avec un code
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinWithCode()}
                placeholder="CODE"
                maxLength={9}
                className={`flex-1 px-4 py-2.5 rounded-lg font-mono text-center text-lg tracking-widest uppercase ${
                  isDark
                    ? 'bg-gray-700 text-white placeholder-gray-500 border border-gray-600'
                    : 'bg-gray-50 text-gray-900 placeholder-gray-300 border border-gray-200'
                } focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent`}
              />
              <button
                onClick={handleJoinWithCode}
                disabled={!joinCode.trim()}
                className="px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                OK
              </button>
            </div>
          </div>
        </div>

        {/* Active challenges */}
        {activeChallenges.length > 0 && (
          <div className="mb-8">
            <h2 className={`text-sm font-semibold mb-3 flex items-center gap-2 uppercase tracking-wide ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <Play className="w-4 h-4 text-green-500" />
              En cours
            </h2>
            <div className="space-y-2">
              {activeChallenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} isDark={isDark} />
              ))}
            </div>
          </div>
        )}

        {/* Recent challenges */}
        {recentChallenges.length > 0 && (
          <div>
            <h2 className={`text-sm font-semibold mb-3 flex items-center gap-2 uppercase tracking-wide ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <Clock className="w-4 h-4" />
              Historique
            </h2>
            <div className="space-y-2">
              {recentChallenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} isDark={isDark} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {activeChallenges.length === 0 && recentChallenges.length === 0 && (
          <div className={`text-center py-12 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-white'}`}>
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
              isDark ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <Gamepad2 className={`w-8 h-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            </div>
            <p className={`text-lg font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Prêt à relever un défi ?
            </p>
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Crée un défi et invite tes amis !
            </p>
            <Link
              href="/defi/creer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Créer mon premier défi
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ChallengeCard({
  challenge,
  isDark,
}: {
  challenge: ChallengeListItem;
  isDark: boolean;
}) {
  const router = useRouter();
  const isFinished = challenge.status === 'finished';
  const isWinner = challenge.my_rank === 1;
  const isActive = challenge.status === 'lobby' || challenge.status === 'playing';

  // Icône selon le statut/résultat
  const getIcon = () => {
    if (isFinished) {
      if (isWinner) {
        return <Crown className="w-5 h-5 text-yellow-500" />;
      }
      return <Medal className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />;
    }
    if (challenge.status === 'playing') {
      return <Play className="w-5 h-5 text-green-500" />;
    }
    return <Users className="w-5 h-5 text-orange-500" />;
  };

  // Background de l'icône
  const getIconBg = () => {
    if (isFinished && isWinner) {
      return isDark ? 'bg-yellow-500/20' : 'bg-yellow-100';
    }
    if (challenge.status === 'playing') {
      return isDark ? 'bg-green-500/20' : 'bg-green-100';
    }
    return isDark ? 'bg-orange-500/20' : 'bg-orange-100';
  };

  return (
    <button
      onClick={() => router.push(`/defi/${challenge.code}`)}
      className={`w-full p-4 rounded-xl text-left transition-all hover:scale-[1.005] ${
        isDark
          ? 'bg-gray-800 hover:bg-gray-750'
          : 'bg-white hover:bg-gray-50 shadow-sm'
      } ${isFinished && isWinner ? (isDark ? 'ring-1 ring-yellow-500/30' : 'ring-1 ring-yellow-400/50') : ''}`}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getIconBg()}`}>
          {getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {challenge.chapter_title || challenge.course_title || 'Quiz'}
            </span>
            {isActive && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                challenge.status === 'lobby'
                  ? 'bg-green-500/20 text-green-500'
                  : 'bg-yellow-500/20 text-yellow-600'
              }`}>
                {challenge.status === 'lobby' ? 'En attente' : 'En jeu'}
              </span>
            )}
          </div>
          <div className={`flex items-center gap-2 text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <span className="font-mono text-xs">{challenge.code}</span>
            <span>•</span>
            <span>{challenge.player_count} joueur{challenge.player_count > 1 ? 's' : ''}</span>
            {isFinished && (
              <>
                <span>•</span>
                <span>{formatRelativeTime(challenge.created_at)}</span>
              </>
            )}
          </div>
        </div>

        {/* Right side - Result or action */}
        <div className="flex-shrink-0 text-right">
          {isFinished ? (
            <div>
              {challenge.my_rank !== undefined && (
                <p className={`font-bold ${
                  isWinner
                    ? 'text-yellow-500'
                    : challenge.my_rank === 2
                      ? isDark ? 'text-gray-300' : 'text-gray-600'
                      : challenge.my_rank === 3
                        ? 'text-amber-600'
                        : isDark ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {isWinner ? '🏆 1er' : `${challenge.my_rank}${challenge.my_rank === 2 ? 'nd' : 'ème'}`}
                </p>
              )}
              {challenge.my_score !== undefined && (
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {challenge.my_score} pts
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {challenge.status === 'playing' ? (
                <Eye className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              ) : (
                <ArrowRight className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
