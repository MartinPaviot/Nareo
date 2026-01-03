'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Copy,
  Share2,
  Check,
  Crown,
  Loader2,
  LogOut,
  Play,
  Clock,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useChallengeRoom } from '@/hooks/defi/useChallengeRoom';
import {
  Challenge,
  MIN_PLAYERS_TO_START,
  MAX_PLAYERS_PER_CHALLENGE,
} from '@/types/defi';
import ChallengeGame from './ChallengeGame';
import ChallengeFinalResults from './ChallengeFinalResults';

interface ChallengeLobbyProps {
  challenge: Challenge;
  playerId: string;
  userId: string | null;
  displayName: string;
  isHost: boolean;
}

export default function ChallengeLobby({
  challenge,
  playerId,
  userId,
  displayName,
  isHost,
}: ChallengeLobbyProps) {
  const router = useRouter();
  const { translate } = useLanguage();
  const { isDark } = useTheme();

  const [copied, setCopied] = useState(false);
  const [localReady, setLocalReady] = useState(isHost);

  const {
    isConnected,
    players,
    gameStatus,
    currentQuestion,
    currentQuestionIndex,
    timeRemaining,
    scores,
    lastQuestionResults,
    finalScores,
    showingResults,
    resultsCountdown,
    setReady,
    startGame,
    submitAnswer,
    leaveRoom,
    error,
  } = useChallengeRoom({
    challengeCode: challenge.code,
    playerId,
    userId,
    displayName,
    isHost,
    questionCount: challenge.question_count,
    timePerQuestion: challenge.time_per_question,
  });

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/defi/rejoindre?code=${challenge.code}`
    : '';

  // Check if all players are ready
  const allPlayersReady = players.length >= MIN_PLAYERS_TO_START &&
    players.every((p) => p.is_ready);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(challenge.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Rejoins mon défi !',
          text: `Rejoins mon défi sur Nareo avec le code ${challenge.code}`,
          url: joinUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      handleCopyCode();
    }
  };

  const handleToggleReady = async () => {
    const newReady = !localReady;
    setLocalReady(newReady);
    await setReady(newReady);
  };

  const handleLeave = async () => {
    await leaveRoom();
    router.push('/defi');
  };

  // Show game if playing
  if (gameStatus === 'playing' || gameStatus === 'starting') {
    return (
      <ChallengeGame
        challenge={challenge}
        playerId={playerId}
        displayName={displayName}
        isHost={isHost}
        gameStatus={gameStatus}
        currentQuestion={currentQuestion}
        currentQuestionIndex={currentQuestionIndex}
        timeRemaining={timeRemaining}
        players={players}
        scores={scores}
        lastQuestionResults={lastQuestionResults}
        showingResults={showingResults}
        resultsCountdown={resultsCountdown}
        onSubmitAnswer={submitAnswer}
      />
    );
  }

  // Show final results if finished
  if (gameStatus === 'finished' && finalScores) {
    return (
      <ChallengeFinalResults
        challenge={challenge}
        finalScores={finalScores}
        playerId={playerId}
      />
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🎮</div>
          <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {translate('challenge_waiting_players')}
          </h1>
          {challenge.chapter?.title && (
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {challenge.chapter.title}
            </p>
          )}
          {challenge.course?.title && !challenge.chapter?.title && (
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {challenge.course.title}
            </p>
          )}
        </div>

        {/* Connection status */}
        {!isConnected && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
          }`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{translate('challenge_connecting')}</span>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div
            className="mb-4 p-3 rounded-lg"
            style={{
              backgroundColor: isDark ? 'rgba(217, 26, 28, 0.15)' : 'rgba(217, 26, 28, 0.1)',
              color: isDark ? '#e94446' : '#d91a1c'
            }}
          >
            {error.message}
          </div>
        )}

        {/* Code and share section */}
        <div className={`rounded-xl p-6 mb-8 text-center ${
          isDark ? 'bg-gray-800' : 'bg-white shadow-md'
        }`}>
          <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {translate('challenge_code_label')}
          </p>
          <p className={`text-4xl font-mono font-bold tracking-wider mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            {challenge.code}
          </p>

          <div className="flex gap-2 justify-center">
            <button
              onClick={handleCopyCode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span>{translate('friends_code_copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>{translate('copy')}</span>
                </>
              )}
            </button>
            <button
              onClick={handleShare}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>Partager</span>
            </button>
          </div>
        </div>

        {/* Players list */}
        <div className={`rounded-xl p-6 mb-8 ${
          isDark ? 'bg-gray-800' : 'bg-white shadow-md'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`font-semibold flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              <Users className="w-5 h-5" />
              {translate('challenge_players_plural')} ({players.length}/{MAX_PLAYERS_PER_CHALLENGE})
            </h2>
          </div>

          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  isDark ? 'bg-gray-700' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                    player.is_host
                      ? 'bg-yellow-500/20 text-yellow-500'
                      : isDark
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-orange-100 text-orange-600'
                  }`}>
                    {player.is_host ? (
                      <Crown className="w-5 h-5" />
                    ) : (
                      player.display_name[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {player.display_name}
                      {player.is_host && (
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                          isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {translate('challenge_host')}
                        </span>
                      )}
                      {player.id === playerId && (
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                          isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {translate('challenge_you')}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  {player.is_ready ? (
                    <span className="flex items-center gap-1 text-green-500 font-medium">
                      <Check className="w-4 h-4" />
                      {translate('challenge_player_ready')}
                    </span>
                  ) : (
                    <span className={`flex items-center gap-1 ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      <Clock className="w-4 h-4" />
                      {translate('challenge_waiting')}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {players.length === 0 && (
              <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p>{translate('challenge_loading')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {!isHost && (
            <button
              onClick={handleToggleReady}
              disabled={!isConnected}
              className={`w-full py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                localReady
                  ? isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {localReady ? (
                <>
                  <Check className="w-5 h-5" />
                  {translate('challenge_cancel_ready')}
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  {translate('challenge_ready_toggle')}
                </>
              )}
            </button>
          )}

          {isHost && (
            <button
              onClick={startGame}
              disabled={!allPlayersReady || !isConnected}
              className={`w-full py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                allPlayersReady
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : isDark
                    ? 'bg-gray-700 text-gray-400'
                    : 'bg-gray-200 text-gray-500'
              } disabled:cursor-not-allowed`}
            >
              {allPlayersReady ? (
                <>
                  <Play className="w-5 h-5" />
                  {translate('challenge_launch')}
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5" />
                  {translate('challenge_waiting_for_ready', { ready: String(players.filter((p) => p.is_ready).length), total: String(players.length) })}
                </>
              )}
            </button>
          )}

          <button
            onClick={handleLeave}
            className={`w-full py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
              isDark
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
          >
            <LogOut className="w-5 h-5" />
            {translate('challenge_leave')}
          </button>
        </div>

        {/* Challenge info */}
        <div className={`mt-8 text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <p className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{challenge.question_count} questions</span>
            <span>•</span>
            <span>{challenge.time_per_question}s par question</span>
          </p>
        </div>
      </div>
    </div>
  );
}
