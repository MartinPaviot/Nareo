'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Target,
  Users,
  Plus,
  ArrowRight,
  Play,
  Crown,
  Eye,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChallengeListItem } from '@/types/defi';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import CreateChallengeModal from './CreateChallengeModal';
import JoinChallengeModal from './JoinChallengeModal';

export default function ChallengeSection() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  const [activeChallenges, setActiveChallenges] = useState<ChallengeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchActiveChallenges();

      // Subscribe to realtime updates for challenges
      const supabase = createSupabaseBrowserClient();
      const channel = supabase
        .channel('challenges-section')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'challenges',
          },
          () => {
            // Refetch when any challenge changes
            fetchActiveChallenges();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchActiveChallenges = async () => {
    try {
      const supabase = createSupabaseBrowserClient();

      // Fetch active challenges where user is a participant or host
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
        .limit(5);

      if (active) {
        // Filter to only challenges where user is host or participant
        const userChallenges = active.filter((c: any) =>
          c.host_id === user?.id || c.players?.some((p: any) => p.user_id === user?.id)
        );

        // Fetch host profiles
        const hostIds = userChallenges.map((c: any) => c.host_id).filter(Boolean);
        let hostProfiles: Record<string, { display_name: string; avatar_url: string | null }> = {};

        if (hostIds.length > 0) {
          const { data: hosts } = await supabase
            .from('user_profiles')
            .select('id, display_name, avatar_url')
            .in('id', hostIds);
          if (hosts) {
            hostProfiles = Object.fromEntries(hosts.map((h: any) => [h.id, { display_name: h.display_name, avatar_url: h.avatar_url }]));
          }
        }

        const processed = userChallenges.map((c: any): ChallengeListItem => ({
          id: c.id,
          code: c.code,
          time_per_question: c.time_per_question,
          status: c.status,
          host_profile: hostProfiles[c.host_id] || { display_name: 'Hôte', avatar_url: null },
          course_title: c.course?.title,
          chapter_title: c.chapter?.title,
          player_count: c.players?.length || 0,
          created_at: c.created_at,
        }));

        setActiveChallenges(processed);
      }
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className={`rounded-2xl border-2 overflow-hidden ${
          isDark ? 'border-neutral-700 bg-neutral-900/50' : 'border-gray-200 bg-white'
        }`}
      >
        {/* Header */}
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {translate('challenge_mode', 'Mode Défi')}
              </h2>
            </div>
            <Link
              href="/defi"
              className={`text-sm font-medium flex items-center gap-1 transition-colors ${
                isDark ? 'text-neutral-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {translate('see_all', 'Voir tout')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            {translate('challenge_subtitle', 'Affronte tes amis en temps réel')}
          </p>
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-4">
          <div className="flex gap-2">
            {/* Create button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-colors"
              style={{ backgroundColor: '#ff751f' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
            >
              <Plus className="w-4 h-4" />
              {translate('challenge_create', 'Créer un défi')}
            </button>

            {/* Join button */}
            <button
              onClick={() => setShowJoinModal(true)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                isDark
                  ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4" />
              {translate('challenge_join', 'Rejoindre')}
            </button>
          </div>
        </div>

        {/* Active challenges */}
        {loading ? (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-center py-4">
              <Loader2 className={`w-5 h-5 animate-spin ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
            </div>
          </div>
        ) : activeChallenges.length > 0 ? (
          <div className={`border-t ${isDark ? 'border-neutral-800' : 'border-gray-100'}`}>
            <div className="p-4 pt-3">
              <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${
                isDark ? 'text-neutral-500' : 'text-gray-400'
              }`}>
                <Play className="w-3.5 h-3.5 text-green-500" />
                {translate('challenge_in_progress', 'En cours')}
              </h3>
              <div className="space-y-2">
                {activeChallenges.map((challenge) => (
                  <ActiveChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    isDark={isDark}
                    translate={translate}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateChallengeModal onClose={() => setShowCreateModal(false)} />
      )}
      {showJoinModal && (
        <JoinChallengeModal onClose={() => setShowJoinModal(false)} />
      )}
    </>
  );
}

function ActiveChallengeCard({
  challenge,
  isDark,
  translate,
}: {
  challenge: ChallengeListItem;
  isDark: boolean;
  translate: (key: string, fallback?: string) => string;
}) {
  const router = useRouter();
  const isPlaying = challenge.status === 'playing';

  return (
    <button
      onClick={() => router.push(`/defi/${challenge.code}`)}
      className={`w-full p-3 rounded-xl text-left transition-all hover:scale-[1.01] flex items-center gap-3 ${
        isDark
          ? 'bg-neutral-800 hover:bg-neutral-750'
          : 'bg-gray-50 hover:bg-gray-100'
      }`}
    >
      {/* Icon */}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isPlaying
            ? isDark ? 'bg-green-500/20' : 'bg-green-100'
            : isDark ? 'bg-orange-500/20' : 'bg-orange-100'
        }`}
      >
        {isPlaying ? (
          <Play className="w-4 h-4 text-green-500" />
        ) : (
          <Users className="w-4 h-4 text-orange-500" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {challenge.chapter_title || challenge.course_title || 'Quiz'}
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
              isPlaying
                ? 'bg-yellow-500/20 text-yellow-600'
                : 'bg-green-500/20 text-green-500'
            }`}
          >
            {isPlaying
              ? translate('challenge_playing', 'En jeu')
              : translate('challenge_waiting', 'En attente')
            }
          </span>
        </div>
        <div className={`flex items-center gap-2 text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
          <span className="font-mono">{challenge.code}</span>
          <span>•</span>
          <span>
            {challenge.player_count}{' '}
            {challenge.player_count > 1
              ? translate('challenge_players_plural', 'joueurs')
              : translate('challenge_players', 'joueur')
            }
          </span>
        </div>
      </div>

      {/* Arrow */}
      <ArrowRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
    </button>
  );
}
