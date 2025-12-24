'use client';

import {
  Trophy,
  Medal,
  Award,
  Target,
  Zap,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLeaderboard } from '@/hooks/defi/useLeaderboard';

interface WeeklyLeaderboardProps {
  userId: string;
}

export default function WeeklyLeaderboard({ userId }: WeeklyLeaderboardProps) {
  const { isDark } = useTheme();
  const { translate, currentLanguage: language } = useLanguage();
  const { leaderboard, myRank, myPoints, loading, error, refetch } = useLeaderboard(userId);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-orange-400" />;
      default:
        return null;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'text-yellow-500';
      case 2:
        return 'text-gray-400';
      case 3:
        return 'text-orange-400';
      default:
        return isDark ? 'text-gray-500' : 'text-gray-400';
    }
  };

  const getRankBgColor = (rank: number, isMe: boolean) => {
    if (isMe) {
      return isDark ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-blue-50 border border-blue-200';
    }
    switch (rank) {
      case 1:
        return isDark ? 'bg-yellow-500/10' : 'bg-yellow-50';
      case 2:
        return isDark ? 'bg-gray-500/10' : 'bg-gray-50';
      case 3:
        return isDark ? 'bg-orange-500/10' : 'bg-orange-50';
      default:
        return isDark ? 'bg-gray-700' : 'bg-gray-50';
    }
  };

  // Get current week dates
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const weekStart = new Date(now);
  weekStart.setDate(diff);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const formatDate = (date: Date) => {
    const localeMap: Record<string, string> = { fr: 'fr-FR', en: 'en-US', de: 'de-DE' };
    return date.toLocaleDateString(localeMap[language] || 'fr-FR', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className={`rounded-xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white shadow-md'}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white shadow-md'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className={`font-semibold flex items-center gap-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            <Trophy className="w-5 h-5 text-yellow-500" />
            {translate('leaderboard_weekly_title')}
          </h2>
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {formatDate(weekStart)} - {formatDate(weekEnd)}
          </p>
        </div>
        <button
          onClick={refetch}
          className={`p-2 rounded-lg transition-colors ${
            isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        </button>
      </div>

      {/* My position summary */}
      {myRank && (
        <div className={`mb-6 p-4 rounded-lg ${
          isDark ? 'bg-blue-500/20' : 'bg-blue-50'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {translate('leaderboard_your_position')}
              </p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : `#${myRank}`}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {translate('leaderboard_your_points')}
              </p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {myPoints}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 ? (
        <div className="space-y-2">
          {leaderboard.map((entry) => {
            const isMe = entry.user_id === userId;

            return (
              <div
                key={entry.id}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  getRankBgColor(entry.rank, isMe)
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className={`w-8 text-center font-bold ${getRankColor(entry.rank)}`}>
                    {getRankIcon(entry.rank) || `#${entry.rank}`}
                  </div>

                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    entry.rank === 1
                      ? 'bg-yellow-500/20 text-yellow-500'
                      : entry.rank === 2
                        ? 'bg-gray-500/20 text-gray-400'
                        : entry.rank === 3
                          ? 'bg-orange-500/20 text-orange-400'
                          : isDark
                            ? 'bg-gray-600 text-gray-400'
                            : 'bg-gray-200 text-gray-500'
                  }`}>
                    {entry.user_profile.display_name[0].toUpperCase()}
                  </div>

                  {/* Name */}
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {entry.user_profile.display_name}
                      {isMe && (
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                          isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {translate('challenge_you')}
                        </span>
                      )}
                    </p>
                    <div className={`flex items-center gap-3 text-xs ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {entry.challenges_played} {translate('leaderboard_challenges')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {entry.challenges_won} {translate('leaderboard_victories')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Points */}
                <div className="text-right">
                  <p className={`font-bold text-lg ${
                    entry.rank === 1 ? 'text-yellow-500' : isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {entry.points}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {translate('leaderboard_points')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{translate('leaderboard_no_ranking')}</p>
          <p className="text-sm mt-1">{translate('leaderboard_play_challenges')}</p>
        </div>
      )}
    </div>
  );
}
