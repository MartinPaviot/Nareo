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
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChallengeListItem, UserChallengeStats } from '@/types/defi';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import PageHeaderWithMascot from '@/components/layout/PageHeaderWithMascot';
import CreateChallengeModal from '@/components/defi/CreateChallengeModal';
import JoinChallengeModal from '@/components/defi/JoinChallengeModal';

// Helper pour formater la date relative
function formatRelativeTime(dateString: string, translate: (key: string, params?: Record<string, string | number>) => string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return translate('relative_time_now');
  if (diffMins < 60) return translate('relative_time_minutes_ago', { minutes: diffMins });
  if (diffHours < 24) return translate('relative_time_hours_ago', { hours: diffHours });
  if (diffDays === 1) return translate('relative_time_yesterday');
  if (diffDays < 7) return translate('relative_time_days_ago', { days: diffDays });
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function DefiPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  const [activeChallenges, setActiveChallenges] = useState<ChallengeListItem[]>([]);
  const [recentChallenges, setRecentChallenges] = useState<ChallengeListItem[]>([]);
  const [stats, setStats] = useState<UserChallengeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const handleDeleteChallenge = (id: string) => {
    setActiveChallenges((prev) => prev.filter((c) => c.id !== id));
    setRecentChallenges((prev) => prev.filter((c) => c.id !== id));
  };

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
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PageHeaderWithMascot
        title={translate('challenge_mode')}
        maxWidth="4xl"
        showDarkModeToggle
      />

      <div className="max-w-4xl mx-auto p-6 flex-1">
        {/* Titre de la page */}
        <h1 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {translate('challenge_subtitle')}
        </h1>

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
                  {translate('challenge_played')}
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
                  {translate('challenge_victories')}
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
                  {translate('challenge_points')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions principales - Cards équilibrées */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Create challenge */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="group p-5 rounded-xl transition-all hover:scale-[1.02] text-white text-left"
            style={{ background: 'linear-gradient(to bottom right, #ff751f, #e5681b)' }}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white/20 group-hover:bg-white/30 transition-colors">
                <Plus className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-lg">{translate('challenge_create')}</h2>
                <p className="text-sm text-white/80">
                  {translate('challenge_invite_friends')}
                </p>
              </div>
              <ArrowRight className="w-5 h-5 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
          </button>

          {/* Join with code */}
          <button
            onClick={() => setShowJoinModal(true)}
            className={`p-5 rounded-xl text-left transition-all hover:scale-[1.02] ${isDark ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white shadow-sm hover:shadow-md'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-orange-50'}`}>
                <Users className="w-6 h-6 text-orange-500" />
              </div>
              <div className="flex-1">
                <h2 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {translate('challenge_join')}
                </h2>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {translate('challenge_with_code')}
                </p>
              </div>
              <ArrowRight className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            </div>
          </button>
        </div>

        {/* Active challenges */}
        {activeChallenges.length > 0 && (
          <div className="mb-8">
            <h2 className={`text-sm font-semibold mb-3 flex items-center gap-2 uppercase tracking-wide ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <Play className="w-4 h-4 text-green-500" />
              {translate('challenge_in_progress')}
            </h2>
            <div className="space-y-2">
              {activeChallenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} isDark={isDark} onDelete={handleDeleteChallenge} />
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
              {translate('challenge_history')}
            </h2>
            <div className="space-y-2">
              {recentChallenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} isDark={isDark} onDelete={handleDeleteChallenge} />
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
              {translate('challenge_ready')}
            </p>
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {translate('challenge_create_invite')}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors"
              style={{ backgroundColor: '#ff751f' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
            >
              <Plus className="w-4 h-4" />
              {translate('challenge_create_first')}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className={`border-t mt-auto ${
        isDark
          ? 'bg-neutral-900/50 border-neutral-800'
          : 'bg-gray-50/50 border-gray-100'
      }`}>
        <div className={`max-w-4xl mx-auto px-4 py-1.5 flex items-center justify-center gap-4 text-[10px] ${
          isDark ? 'text-neutral-500' : 'text-gray-400'
        }`}>
          <span>© 2026 Nareo</span>
          <span className={isDark ? 'text-neutral-700' : 'text-gray-300'}>·</span>
          <span className="hover:text-orange-500 transition-colors cursor-pointer">
            Contact
          </span>
        </div>
      </footer>

      {/* Modals */}
      {showCreateModal && (
        <CreateChallengeModal onClose={() => setShowCreateModal(false)} />
      )}
      {showJoinModal && (
        <JoinChallengeModal onClose={() => setShowJoinModal(false)} />
      )}
    </div>
  );
}

function ChallengeCard({
  challenge,
  isDark,
  onDelete,
}: {
  challenge: ChallengeListItem;
  isDark: boolean;
  onDelete?: (id: string) => void;
}) {
  const router = useRouter();
  const { translate } = useLanguage();
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const isFinished = challenge.status === 'finished';
  const isWinner = challenge.my_rank === 1;
  const isActive = challenge.status === 'lobby' || challenge.status === 'playing';
  const canDelete = challenge.status !== 'playing';

  const openDeleteModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/defi/delete?id=${challenge.id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok && data.success) {
        console.log('[defi] Challenge deleted successfully:', challenge.id);
        if (onDelete) {
          onDelete(challenge.id);
        }
      } else {
        console.error('[defi] Failed to delete challenge:', data.error || 'Unknown error');
        alert(data.error || 'Erreur lors de la suppression');
      }
    } catch (err) {
      console.error('[defi] Error deleting challenge:', err);
      alert('Erreur lors de la suppression du défi');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

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
    <>
      <div
        onClick={() => router.push(`/defi/${challenge.code}`)}
        className={`w-full p-4 rounded-xl text-left transition-all hover:scale-[1.005] cursor-pointer ${
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
                  {challenge.status === 'lobby' ? translate('challenge_waiting') : translate('challenge_playing')}
                </span>
              )}
            </div>
            <div className={`flex items-center gap-2 text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="font-mono text-xs">{challenge.code}</span>
              <span>•</span>
              <span>{challenge.player_count} {challenge.player_count > 1 ? translate('challenge_players_plural') : translate('challenge_players')}</span>
              {isFinished && (
                <>
                  <span>•</span>
                  <span>{formatRelativeTime(challenge.created_at, translate)}</span>
                </>
              )}
            </div>
          </div>

          {/* Right side - Result, action, or delete */}
          <div className="flex-shrink-0 flex items-center gap-2">
            {isFinished ? (
              <div className="text-right">
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

            {/* Delete button */}
            {canDelete && onDelete && (
              <button
                onClick={openDeleteModal}
                disabled={deleting}
                className="p-2 rounded-lg transition-colors disabled:opacity-50"
                style={{ color: '#9ca3af' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(217, 26, 28, 0.2)' : '#fff6f3';
                  e.currentTarget.style.color = '#d91a1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#9ca3af';
                }}
                title={translate('delete', 'Supprimer')}
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDeleteModal(false)}
          />
          <div
            className={`relative w-full max-w-sm rounded-2xl shadow-xl p-6 ${
              isDark ? 'bg-neutral-900' : 'bg-white'
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: '#fff6f3' }}
              >
                <Trash2 className="w-6 h-6" style={{ color: '#d91a1c' }} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {translate('challenge_delete_title', 'Supprimer ce défi ?')}
              </h3>
              <p className={`text-sm mb-6 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {translate('challenge_delete_desc', 'Cette action est irréversible.')}
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                    isDark
                      ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {translate('cancel', 'Annuler')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#d91a1c' }}
                  onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#b81618')}
                  onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#d91a1c')}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {translate('deleting', 'Suppression...')}
                    </>
                  ) : (
                    translate('delete', 'Supprimer')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
