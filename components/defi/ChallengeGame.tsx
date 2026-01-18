'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Check,
  X,
  Trophy,
  Users,
  Lightbulb,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MathText from '@/components/ui/MathText';
import {
  Challenge,
  ChallengeQuestion,
  ChallengeStatus,
  RealtimePlayer,
  QuestionResults,
  QuestionData,
} from '@/types/defi';

interface ChallengeGameProps {
  challenge: Challenge;
  playerId: string;
  displayName: string;
  isHost: boolean;
  gameStatus: ChallengeStatus;
  currentQuestion: ChallengeQuestion | null;
  currentQuestionIndex: number;
  timeRemaining: number;
  players: RealtimePlayer[];
  scores: Record<string, number>;
  lastQuestionResults: QuestionResults | null;
  showingResults: boolean;
  resultsCountdown: number;
  onSubmitAnswer: (answer: string) => Promise<{
    isCorrect: boolean;
    pointsEarned: number;
    correctAnswer: string;
  } | null>;
}

export default function ChallengeGame({
  challenge,
  playerId,
  displayName,
  isHost,
  gameStatus,
  currentQuestion,
  currentQuestionIndex,
  timeRemaining,
  players,
  scores,
  lastQuestionResults,
  showingResults,
  resultsCountdown,
  onSubmitAnswer,
}: ChallengeGameProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState<{
    isCorrect: boolean;
    pointsEarned: number;
    correctAnswer: string;
  } | null>(null);
  const [fillBlankInput, setFillBlankInput] = useState('');

  // Reset state when question changes
  useEffect(() => {
    setSelectedAnswer(null);
    setHasAnswered(false);
    setAnswerResult(null);
    setFillBlankInput('');
  }, [currentQuestion?.id]);

  const handleSelectAnswer = useCallback(async (answer: string) => {
    if (hasAnswered || !currentQuestion) return;

    setSelectedAnswer(answer);
    setHasAnswered(true);

    const result = await onSubmitAnswer(answer);
    if (result) {
      setAnswerResult(result);
    }
  }, [hasAnswered, currentQuestion, onSubmitAnswer]);

  const handleFillBlankSubmit = useCallback(() => {
    if (fillBlankInput.trim()) {
      handleSelectAnswer(fillBlankInput.trim());
    }
  }, [fillBlankInput, handleSelectAnswer]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (hasAnswered || !currentQuestion) return;

      const questionData = currentQuestion.question_data as QuestionData;

      if (questionData.type === 'multiple_choice') {
        const key = e.key.toUpperCase();
        const options = questionData.options;
        const index = key.charCodeAt(0) - 65; // A=0, B=1, etc.
        if (index >= 0 && index < options.length) {
          handleSelectAnswer(options[index]);
        }
      } else if (questionData.type === 'true_false') {
        if (e.key === 'v' || e.key === 'V' || e.key === '1') {
          handleSelectAnswer('Vrai');
        } else if (e.key === 'f' || e.key === 'F' || e.key === '2') {
          handleSelectAnswer('Faux');
        }
      } else if (questionData.type === 'fill_blank' && e.key === 'Enter') {
        handleFillBlankSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasAnswered, currentQuestion, handleSelectAnswer, handleFillBlankSubmit]);

  // Starting countdown
  if (gameStatus === 'starting') {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className={`text-8xl font-bold mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            {timeRemaining || 3}
          </div>
          <p className={`text-xl ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {translate('challenge_starting')}
          </p>
        </div>
      </div>
    );
  }

  // Show results between questions
  if (showingResults && lastQuestionResults) {
    // Trouver mon résultat
    const myResult = lastQuestionResults.player_results.find(r => r.player_id === playerId);
    const sortedByScore = [...lastQuestionResults.player_results].sort((a, b) => b.new_score - a.new_score);

    // Trouver ma position dans le classement général
    const myRank = sortedByScore.findIndex(r => r.player_id === playerId) + 1;

    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Timer en haut - toujours visible */}
        <div className={`sticky top-0 z-10 ${isDark ? 'bg-gray-900/95' : 'bg-gray-50/95'} backdrop-blur-sm`}>
          <div className="max-w-2xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Question {currentQuestionIndex + 1}/{challenge.question_count}
              </span>
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${resultsCountdown <= 3 ? 'text-orange-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <span className={`font-bold ${resultsCountdown <= 3 ? 'text-orange-500' : isDark ? 'text-white' : 'text-gray-900'}`}>
                  {resultsCountdown}s
                </span>
              </div>
            </div>
            {/* Barre de progression fine */}
            <div className={`h-1 mt-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-1000 ease-linear"
                style={{ width: `${(resultsCountdown / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 pb-6">
          {/* Mon résultat - EN PREMIER, très visible */}
          {myResult && (
            <div
              className="mt-4 rounded-2xl p-5 border-2"
              style={{
                background: myResult.is_correct
                  ? 'linear-gradient(to bottom right, rgba(55, 159, 90, 0.2), rgba(55, 159, 90, 0.1))'
                  : 'linear-gradient(to bottom right, #ffeae5, #fff6f3)',
                borderColor: myResult.is_correct ? 'rgba(55, 159, 90, 0.3)' : 'rgba(217, 26, 28, 0.3)'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: myResult.is_correct ? '#379f5a' : '#d91a1c' }}
                  >
                    {myResult.is_correct ? (
                      <Check className="w-7 h-7 text-white" />
                    ) : (
                      <X className="w-7 h-7 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-xl font-bold" style={{ color: myResult.is_correct ? '#379f5a' : '#d91a1c' }}>
                      {myResult.is_correct ? translate('challenge_correct_answer') : translate('challenge_wrong_answer')}
                    </p>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {myResult.response_time_ms > 0
                        ? translate('challenge_answered_in', { time: (myResult.response_time_ms / 1000).toFixed(1) })
                        : translate('challenge_time_up')}
                      {' • '}
                      {translate('challenge_rank_position', { rank: String(myRank) })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-bold ${
                    myResult.points_earned > 0 ? 'text-green-500' : isDark ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    +{myResult.points_earned}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{translate('leaderboard_points')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Section éducative - Question + Réponse correcte (style neutre) */}
          <div className={`rounded-xl overflow-hidden mt-4 ${isDark ? 'bg-gray-800' : 'bg-white shadow-sm'}`}>
            {/* La question */}
            <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {translate('challenge_question_label')}
              </p>
              <p className={`font-medium leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                {lastQuestionResults.question_text}
              </p>
            </div>

            {/* La réponse attendue - style neutre/informatif */}
            <div className={`p-4 border-b ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-100 bg-gray-50'}`}>
              <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {translate('challenge_expected_answer')}
              </p>
              <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {lastQuestionResults.correct_answer}
              </p>
            </div>

            {/* Explication pédagogique */}
            {lastQuestionResults.explanation && (
              <div className={`p-4 ${isDark ? 'bg-gray-800/50' : 'bg-white'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isDark ? 'bg-amber-500/20' : 'bg-amber-100'
                  }`}>
                    <Lightbulb className={`w-3.5 h-3.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                      {translate('challenge_remember')}
                    </p>
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {lastQuestionResults.explanation}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Classement général - Card avec scores totaux */}
          <div className={`mt-4 rounded-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white shadow-sm'}`}>
            <div className={`px-4 py-3 flex items-center justify-between border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              <h3 className={`text-sm font-medium flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Trophy className="w-4 h-4 text-orange-500" />
                {translate('challenge_ranking')}
              </h3>
              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {translate('challenge_total_score')}
              </span>
            </div>
            <div>
              {sortedByScore.map((result, index) => (
                <div
                  key={result.player_id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    index < sortedByScore.length - 1 ? (isDark ? 'border-b border-gray-700/50' : 'border-b border-gray-50') : ''
                  } ${
                    result.player_id === playerId
                      ? isDark ? 'bg-orange-500/10' : 'bg-orange-50'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Position avec style médaille */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : index === 1
                          ? 'bg-gray-400/20 text-gray-400'
                          : index === 2
                            ? 'bg-amber-600/20 text-amber-600'
                            : isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {index + 1}
                    </div>

                    {/* Nom et indicateur de réponse */}
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${
                        result.player_id === playerId
                          ? 'text-orange-500'
                          : isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {result.player_name}
                      </span>
                      {result.player_id === playerId && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {translate('challenge_you').toLowerCase()}
                        </span>
                      )}
                      {/* Petit indicateur correct/incorrect */}
                      <span className="text-xs" style={{ color: result.is_correct ? '#379f5a' : '#d91a1c' }}>
                        {result.is_correct ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>

                  {/* Score et points gagnés */}
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${
                      result.points_earned > 0 ? 'text-green-500' : isDark ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      {result.points_earned > 0 ? `+${result.points_earned}` : '-'}
                    </span>
                    <span className={`font-bold min-w-[40px] text-right ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {result.new_score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No question yet
  if (!currentQuestion) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className={`text-xl ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {translate('challenge_loading_question')}
          </div>
        </div>
      </div>
    );
  }

  const questionData = currentQuestion.question_data as QuestionData;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header with timer and progress */}
      <div className={`sticky top-0 z-10 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Progress */}
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Question {currentQuestionIndex + 1}/{challenge.question_count}
            </div>

            {/* Timer */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                timeRemaining <= 10 && timeRemaining > 5
                  ? 'bg-yellow-500/20 text-yellow-500'
                  : timeRemaining > 10
                    ? isDark
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-gray-100 text-gray-600'
                    : ''
              }`}
              style={timeRemaining <= 5 ? { backgroundColor: '#fff6f3', color: '#d91a1c' } : {}}
            >
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">{timeRemaining}s</span>
            </div>

            {/* Players answered */}
            <div className={`flex items-center gap-2 text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <Users className="w-4 h-4" />
              {players.filter((p) => p.hasAnswered).length}/{players.length}
            </div>
          </div>

          {/* Progress bar */}
          <div className={`mt-3 h-1 rounded-full overflow-hidden ${
            isDark ? 'bg-gray-700' : 'bg-gray-200'
          }`}>
            <div
              className="h-full bg-orange-500 transition-all duration-1000"
              style={{
                width: `${(timeRemaining / challenge.time_per_question) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="max-w-2xl mx-auto p-6">
        <div className={`rounded-xl p-6 mb-6 ${
          isDark ? 'bg-gray-800' : 'bg-white shadow-md'
        }`}>
          <p className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {questionData.type === 'multiple_choice' && <MathText>{questionData.prompt}</MathText>}
            {questionData.type === 'true_false' && <MathText>{questionData.statement}</MathText>}
            {questionData.type === 'fill_blank' && <MathText>{questionData.sentence}</MathText>}
          </p>
        </div>

        {/* Answer options */}
        {questionData.type === 'multiple_choice' && (
          <div className="space-y-3">
            {questionData.options.map((option, index) => {
              const letter = String.fromCharCode(65 + index);
              const isSelected = selectedAnswer === option;
              // Ne pas révéler la bonne réponse - juste montrer si sélectionné
              // La réponse sera révélée dans l'écran des résultats

              return (
                <button
                  key={index}
                  onClick={() => handleSelectAnswer(option)}
                  disabled={hasAnswered}
                  className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                    isSelected
                      ? isDark
                        ? 'bg-orange-500/20 border-2 border-orange-500'
                        : 'bg-orange-50 border-2 border-orange-500'
                      : isDark
                        ? 'bg-gray-800 hover:bg-gray-700 border-2 border-gray-700'
                        : 'bg-white hover:bg-gray-50 border-2 border-gray-200 shadow-sm'
                  } disabled:cursor-not-allowed`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    isSelected
                      ? 'bg-orange-500 text-white'
                      : isDark
                        ? 'bg-gray-700 text-gray-300'
                        : 'bg-gray-100 text-gray-600'
                  }`}>
                    {letter}
                  </span>
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
                    <MathText>{option}</MathText>
                  </span>
                  {isSelected && hasAnswered && (
                    <Check className="ml-auto w-5 h-5 text-orange-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {questionData.type === 'true_false' && (
          <div className="grid grid-cols-2 gap-4">
            {[{ value: 'Vrai', key: 'challenge_true' }, { value: 'Faux', key: 'challenge_false' }].map(({ value: option, key }) => {
              const isSelected = selectedAnswer === option;
              // Ne pas révéler la bonne réponse - la réponse sera révélée dans l'écran des résultats

              return (
                <button
                  key={option}
                  onClick={() => handleSelectAnswer(option)}
                  disabled={hasAnswered}
                  className={`p-6 rounded-xl font-bold text-xl transition-all ${
                    isSelected
                      ? 'bg-orange-500/20 border-2 border-orange-500 text-orange-500'
                      : isDark
                        ? 'bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 text-white'
                        : 'bg-white hover:bg-gray-50 border-2 border-gray-200 text-gray-900 shadow-sm'
                  } disabled:cursor-not-allowed`}
                >
                  {translate(key)}
                </button>
              );
            })}
          </div>
        )}

        {questionData.type === 'fill_blank' && (
          <div className="space-y-4">
            <input
              type="text"
              value={fillBlankInput}
              onChange={(e) => setFillBlankInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFillBlankSubmit()}
              disabled={hasAnswered}
              placeholder={translate('challenge_your_answer')}
              className={`w-full p-4 rounded-xl text-lg ${
                hasAnswered
                  ? isDark
                    ? 'bg-orange-500/20 border-2 border-orange-500 text-white'
                    : 'bg-orange-50 border-2 border-orange-500 text-gray-900'
                  : isDark
                    ? 'bg-gray-800 border-2 border-gray-700 text-white placeholder-gray-500'
                    : 'bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:border-orange-500 disabled:cursor-not-allowed`}
            />
            <button
              onClick={handleFillBlankSubmit}
              disabled={hasAnswered || !fillBlankInput.trim()}
              className={`w-full py-3 rounded-xl font-medium transition-colors ${
                hasAnswered || !fillBlankInput.trim()
                  ? isDark
                    ? 'bg-gray-700 text-gray-500'
                    : 'bg-gray-200 text-gray-400'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              } disabled:cursor-not-allowed`}
            >
              {translate('challenge_validate')}
            </button>
          </div>
        )}

        {/* Answer feedback - Ne pas révéler la réponse, juste confirmer l'envoi */}
        {hasAnswered && (
          <div className={`mt-6 p-4 rounded-xl ${
            isDark ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'
          }`}>
            <div className="flex items-center gap-3">
              <Check className="w-6 h-6 text-orange-500" />
              <div>
                <p className={`font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                  {translate('challenge_answer_sent')}
                </p>
                <p className={`text-sm ${isDark ? 'text-orange-300' : 'text-orange-500'}`}>
                  {translate('challenge_waiting_others_short')}
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
