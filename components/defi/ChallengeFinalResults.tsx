'use client';

import { useRouter } from 'next/navigation';
import {
  Trophy,
  Medal,
  Award,
  Clock,
  Target,
  Zap,
  Home,
  RotateCcw,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Challenge, FinalScore } from '@/types/defi';

interface ChallengeFinalResultsProps {
  challenge: Challenge;
  finalScores: FinalScore[];
  playerId: string;
}

export default function ChallengeFinalResults({
  challenge,
  finalScores,
  playerId,
}: ChallengeFinalResultsProps) {
  const router = useRouter();
  const { isDark } = useTheme();

  const myResult = finalScores.find((s) => s.player_id === playerId);
  const myRank = myResult?.rank || finalScores.length;
  const isWinner = myRank === 1;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-8 h-8 text-yellow-500" />;
      case 2:
        return <Medal className="w-8 h-8 text-gray-400" />;
      case 3:
        return <Award className="w-8 h-8 text-orange-400" />;
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

  const getRankBgColor = (rank: number) => {
    switch (rank) {
      case 1:
        return isDark ? 'bg-yellow-500/20' : 'bg-yellow-100';
      case 2:
        return isDark ? 'bg-gray-500/20' : 'bg-gray-100';
      case 3:
        return isDark ? 'bg-orange-500/20' : 'bg-orange-100';
      default:
        return isDark ? 'bg-gray-800' : 'bg-gray-50';
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-2xl mx-auto p-6">
        {/* Winner celebration */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">
            {isWinner ? '🎉' : myRank <= 3 ? '🏆' : '👏'}
          </div>
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {isWinner
              ? 'Victoire !'
              : myRank <= 3
                ? `${myRank}${myRank === 2 ? 'ème' : 'ème'} place !`
                : 'Défi terminé !'}
          </h1>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {challenge.question_count} questions • {challenge.time_per_question}s/question
            {challenge.chapter?.title && ` • ${challenge.chapter.title}`}
          </p>
        </div>

        {/* Personal stats */}
        {myResult && (
          <div className={`rounded-xl p-6 mb-6 ${
            isWinner
              ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30'
              : isDark
                ? 'bg-gray-800'
                : 'bg-white shadow-md'
          }`}>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className={`text-3xl font-bold ${
                  isWinner ? 'text-yellow-500' : isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {myResult.score}
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Score total
                </div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  +{myResult.points_earned}
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Points gagnés
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-700">
              <div className="flex items-center gap-2">
                <Target className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <div>
                  <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {myResult.correct_answers}/{myResult.total_answers}
                  </div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Bonnes réponses
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <div>
                  <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {myResult.average_time_ms > 0
                      ? `${(myResult.average_time_ms / 1000).toFixed(1)}s`
                      : '-'}
                  </div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Temps moyen
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <div>
                  <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {Math.round((myResult.correct_answers / Math.max(myResult.total_answers, 1)) * 100)}%
                  </div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Précision
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full leaderboard */}
        <div className={`rounded-xl p-6 mb-6 ${
          isDark ? 'bg-gray-800' : 'bg-white shadow-md'
        }`}>
          <h2 className={`font-semibold mb-4 flex items-center gap-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            <Trophy className="w-5 h-5 text-yellow-500" />
            Classement final
          </h2>

          <div className="space-y-2">
            {finalScores.map((score) => (
              <div
                key={score.player_id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  score.player_id === playerId
                    ? isDark
                      ? 'bg-orange-500/20 border border-orange-500/30'
                      : 'bg-orange-50 border border-orange-200'
                    : getRankBgColor(score.rank)
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    getRankBgColor(score.rank)
                  }`}>
                    {getRankIcon(score.rank) || (
                      <span className={`font-bold ${getRankColor(score.rank)}`}>
                        {score.rank}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {score.player_name}
                      {score.player_id === playerId && (
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                          isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700'
                        }`}>
                          Toi
                        </span>
                      )}
                    </p>
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {score.correct_answers}/{score.total_answers} bonnes réponses
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg ${
                    score.rank === 1 ? 'text-yellow-500' : isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {score.score}
                  </p>
                  <p className={`text-sm text-green-500`}>
                    +{score.points_earned}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => router.push('/defi')}
            className="w-full py-3 px-4 rounded-xl font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Retour aux défis
          </button>

          <button
            onClick={() => router.push(`/defi/creer?chapterId=${challenge.chapter_id}`)}
            className={`w-full py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
              isDark
                ? 'bg-gray-800 hover:bg-gray-700 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <RotateCcw className="w-5 h-5" />
            Nouveau défi
          </button>
        </div>
      </div>
    </div>
  );
}
