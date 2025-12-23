'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  ChallengeQuestion,
  BroadcastEvent,
  RealtimePlayer,
  ChallengeStatus,
  QuestionResults,
  FinalScore,
} from '@/types/defi';

// Constantes pour le timing du jeu (style Kahoot)
const COUNTDOWN_SECONDS = 3; // Compte à rebours avant le début
const RESULTS_DISPLAY_SECONDS = 10; // Temps d'affichage des résultats entre les questions

interface UseChallengeRoomOptions {
  challengeCode: string;
  playerId: string;
  userId: string | null;
  displayName: string;
  isHost: boolean;
  questionCount: number;
  timePerQuestion: number;
}

interface UseChallengeRoomReturn {
  // State
  isConnected: boolean;
  players: RealtimePlayer[];
  gameStatus: ChallengeStatus;
  currentQuestion: ChallengeQuestion | null;
  currentQuestionIndex: number;
  timeRemaining: number;
  scores: Record<string, number>;
  lastQuestionResults: QuestionResults | null;
  finalScores: FinalScore[] | null;
  showingResults: boolean;
  resultsCountdown: number; // Timer pour l'écran des résultats

  // Actions
  setReady: (ready: boolean) => Promise<void>;
  startGame: () => Promise<void>;
  submitAnswer: (answer: string) => Promise<{
    isCorrect: boolean;
    pointsEarned: number;
    correctAnswer: string;
  } | null>;
  leaveRoom: () => Promise<void>;

  // Errors
  error: Error | null;
}

export function useChallengeRoom({
  challengeCode,
  playerId,
  userId,
  displayName,
  isHost,
  questionCount,
  timePerQuestion,
}: UseChallengeRoomOptions): UseChallengeRoomReturn {
  const supabase = createSupabaseBrowserClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [players, setPlayers] = useState<RealtimePlayer[]>([]);
  const [gameStatus, setGameStatus] = useState<ChallengeStatus>('lobby');
  const [currentQuestion, setCurrentQuestion] = useState<ChallengeQuestion | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [lastQuestionResults, setLastQuestionResults] = useState<QuestionResults | null>(null);
  const [finalScores, setFinalScores] = useState<FinalScore[] | null>(null);
  const [showingResults, setShowingResults] = useState(false);
  const [resultsCountdown, setResultsCountdown] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const resultsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<number>(0);
  const hasAnsweredRef = useRef<boolean>(false);
  const processingEndRef = useRef<boolean>(false);

  // Clear results timer helper
  const clearResultsTimer = useCallback(() => {
    if (resultsTimerRef.current) {
      clearInterval(resultsTimerRef.current);
      resultsTimerRef.current = null;
    }
  }, []);

  // Clear timer helper
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ==============================================
  // HOST: Envoyer les résultats de la question
  // ==============================================
  const sendQuestionResults = useCallback(async (question: ChallengeQuestion) => {
    if (!isHost || !channelRef.current || processingEndRef.current) return;
    processingEndRef.current = true;

    try {
      // Récupérer toutes les réponses pour cette question
      const { data: answers } = await supabase
        .from('challenge_answers')
        .select('*')
        .eq('question_id', question.id);

      // Récupérer tous les joueurs avec leurs scores actuels
      const { data: allPlayers } = await supabase
        .from('challenge_players')
        .select('id, display_name, score')
        .eq('challenge_id', question.challenge_id);

      // Construire les résultats
      const playerResults = allPlayers?.map((player) => {
        const playerAnswer = answers?.find((a) => a.player_id === player.id);
        return {
          player_id: player.id,
          player_name: player.display_name,
          answer: playerAnswer?.answer || '',
          is_correct: playerAnswer?.is_correct || false,
          response_time_ms: playerAnswer?.response_time_ms || 0,
          points_earned: playerAnswer?.points_earned || 0,
          new_score: player.score,
        };
      }) || [];

      // Extraire le texte de la question selon le type
      const questionData = question.question_data as any;
      let questionText = '';
      if (questionData.type === 'multiple_choice') {
        questionText = questionData.prompt || '';
      } else if (questionData.type === 'true_false') {
        questionText = questionData.statement || '';
      } else if (questionData.type === 'fill_blank') {
        questionText = questionData.sentence || '';
      }

      // Broadcast les résultats
      await channelRef.current.send({
        type: 'broadcast',
        event: 'game_event',
        payload: {
          type: 'QUESTION_END',
          results: {
            question_text: questionText,
            correct_answer: question.correct_answer,
            explanation: questionData.explanation || '',
            player_results: playerResults,
          },
        } as BroadcastEvent,
      });
    } catch (err) {
      console.error('Error sending question results:', err);
    }
  }, [isHost, supabase]);

  // ==============================================
  // HOST: Passer à la question suivante ou terminer
  // ==============================================
  const advanceToNextQuestion = useCallback(async (currentQ: ChallengeQuestion, currentIdx: number) => {
    if (!isHost || !channelRef.current) return;

    const nextIndex = currentIdx + 1;

    try {
      // Vérifier s'il y a une question suivante
      const { data: nextQ } = await supabase
        .from('challenge_questions')
        .select('*')
        .eq('challenge_id', currentQ.challenge_id)
        .eq('question_index', nextIndex)
        .maybeSingle();

      if (nextQ) {
        // Mettre à jour le challenge
        await supabase
          .from('challenges')
          .update({ current_question_index: nextIndex })
          .eq('id', currentQ.challenge_id);

        // Marquer la question comme affichée
        await supabase
          .from('challenge_questions')
          .update({ shown_at: new Date().toISOString() })
          .eq('id', nextQ.id);

        // Broadcast la nouvelle question
        await channelRef.current.send({
          type: 'broadcast',
          event: 'game_event',
          payload: {
            type: 'QUESTION',
            question: nextQ,
            timeLimit: timePerQuestion,
          } as BroadcastEvent,
        });
      } else {
        // Fin du jeu
        const response = await fetch('/api/defi/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeCode }),
        });

        const data = await response.json();

        if (response.ok && channelRef.current) {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'game_event',
            payload: {
              type: 'GAME_END',
              finalScores: data.finalScores,
            } as BroadcastEvent,
          });
        }
      }
    } catch (err) {
      console.error('Error advancing to next question:', err);
    } finally {
      processingEndRef.current = false;
    }
  }, [isHost, supabase, challengeCode, timePerQuestion]);

  // Initialize the channel
  useEffect(() => {
    const channelName = `challenge:${challengeCode}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: playerId },
      },
    });

    channelRef.current = channel;

    // ==============================
    // PRESENCE: Player tracking
    // ==============================
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const playersList: RealtimePlayer[] = [];

      Object.entries(state).forEach(([key, presences]) => {
        const presence = (presences as any[])[0];
        if (presence) {
          playersList.push({
            id: key,
            display_name: presence.display_name,
            avatar_url: presence.avatar_url,
            is_ready: presence.is_ready || false,
            is_host: presence.is_host || false,
            hasAnswered: presence.hasAnswered || false,
            score: presence.score || 0,
          });
        }
      });

      setPlayers(playersList);
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('Player joined:', key, newPresences);
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('Player left:', key, leftPresences);
    });

    // ==============================
    // BROADCAST: Game events
    // ==============================
    channel.on('broadcast', { event: 'game_event' }, ({ payload }) => {
      const event = payload as BroadcastEvent;

      switch (event.type) {
        case 'GAME_START':
          setGameStatus('starting');
          setTimeRemaining(event.countdown);
          setLastQuestionResults(null);
          setFinalScores(null);
          setShowingResults(false);

          // Countdown timer
          clearTimer();
          timerRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
              if (prev <= 1) {
                clearTimer();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          break;

        case 'QUESTION':
          clearTimer();
          setGameStatus('playing');
          setCurrentQuestion(event.question);
          setCurrentQuestionIndex(event.question.question_index);
          setTimeRemaining(event.timeLimit);
          setLastQuestionResults(null);
          setShowingResults(false);
          questionStartTimeRef.current = Date.now();
          hasAnsweredRef.current = false;
          processingEndRef.current = false;

          // Reset hasAnswered pour tous les joueurs
          setPlayers((prev) =>
            prev.map((p) => ({ ...p, hasAnswered: false }))
          );

          // Timer de la question - L'hôte déclenche la fin quand le temps est écoulé
          timerRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
              if (prev <= 1) {
                clearTimer();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          break;

        case 'PLAYER_ANSWERED':
          setPlayers((prev) =>
            prev.map((p) =>
              p.id === event.playerId
                ? { ...p, hasAnswered: true }
                : p
            )
          );
          break;

        case 'QUESTION_END':
          clearTimer();
          clearResultsTimer();
          setShowingResults(true);
          setLastQuestionResults(event.results);
          setResultsCountdown(RESULTS_DISPLAY_SECONDS);

          // Démarrer le countdown des résultats
          resultsTimerRef.current = setInterval(() => {
            setResultsCountdown((prev) => {
              if (prev <= 1) {
                clearResultsTimer();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          // Mettre à jour les scores
          const newScores: Record<string, number> = {};
          event.results.player_results.forEach((r) => {
            newScores[r.player_id] = r.new_score;
          });
          setScores(newScores);
          break;

        case 'GAME_END':
          clearTimer();
          setGameStatus('finished');
          setFinalScores(event.finalScores);
          setShowingResults(false);
          break;

        case 'PLAYER_LEFT':
          setPlayers((prev) => prev.filter((p) => p.id !== event.playerId));
          break;

        case 'HOST_CANCELLED':
          setGameStatus('cancelled');
          setError(new Error("L'hôte a annulé le défi"));
          break;
      }
    });

    // Subscribe
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);

        await channel.track({
          display_name: displayName,
          is_ready: isHost,
          is_host: isHost,
          hasAnswered: false,
          score: 0,
          joined_at: new Date().toISOString(),
        });
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setIsConnected(false);
      }
    });

    return () => {
      clearTimer();
      clearResultsTimer();
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [challengeCode, playerId, displayName, isHost, supabase, clearTimer, clearResultsTimer]);

  // ==============================================
  // HOST: Gérer la fin automatique du temps OU quand tous ont répondu
  // ==============================================
  useEffect(() => {
    if (!isHost || !currentQuestion || showingResults || processingEndRef.current) return;

    // Quand le temps atteint 0, l'hôte déclenche les résultats
    if (timeRemaining === 0 && gameStatus === 'playing') {
      sendQuestionResults(currentQuestion);
    }
  }, [timeRemaining, isHost, currentQuestion, gameStatus, showingResults, sendQuestionResults]);

  // HOST: Quand tous les joueurs ont répondu, passer aux résultats immédiatement
  useEffect(() => {
    if (!isHost || !currentQuestion || showingResults || processingEndRef.current) return;
    if (gameStatus !== 'playing') return;

    // Vérifier si tous les joueurs ont répondu
    const allAnswered = players.length > 0 && players.every((p) => p.hasAnswered);

    if (allAnswered) {
      // Arrêter le timer et passer aux résultats
      clearTimer();
      sendQuestionResults(currentQuestion);
    }
  }, [isHost, currentQuestion, showingResults, gameStatus, players, clearTimer, sendQuestionResults]);

  // ==============================================
  // HOST: Passer automatiquement à la question suivante après les résultats
  // ==============================================
  useEffect(() => {
    if (!isHost || !showingResults || !currentQuestion) return;

    const timer = setTimeout(() => {
      advanceToNextQuestion(currentQuestion, currentQuestionIndex);
    }, RESULTS_DISPLAY_SECONDS * 1000);

    return () => clearTimeout(timer);
  }, [isHost, showingResults, currentQuestion, currentQuestionIndex, advanceToNextQuestion]);

  // ==============================================
  // Actions
  // ==============================================

  const setReady = useCallback(
    async (ready: boolean) => {
      if (!channelRef.current) return;

      try {
        await channelRef.current.track({
          display_name: displayName,
          is_ready: ready,
          is_host: isHost,
          hasAnswered: false,
          score: scores[playerId] || 0,
        });

        await supabase
          .from('challenge_players')
          .update({ is_ready: ready })
          .eq('id', playerId);
      } catch (err) {
        console.error('Error setting ready:', err);
        setError(err instanceof Error ? err : new Error('Failed to set ready'));
      }
    },
    [displayName, isHost, playerId, scores, supabase]
  );

  const startGame = useCallback(async () => {
    if (!isHost) {
      setError(new Error("Seul l'hôte peut démarrer le défi"));
      return;
    }

    try {
      const response = await fetch('/api/defi/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start game');
      }

      if (channelRef.current) {
        // Broadcast le début du jeu
        await channelRef.current.send({
          type: 'broadcast',
          event: 'game_event',
          payload: {
            type: 'GAME_START',
            countdown: COUNTDOWN_SECONDS,
          } as BroadcastEvent,
        });

        // Après le countdown, envoyer la première question
        setTimeout(async () => {
          if (data.firstQuestion && channelRef.current) {
            await supabase
              .from('challenges')
              .update({ status: 'playing', current_question_index: 0 })
              .eq('code', challengeCode);

            await supabase
              .from('challenge_questions')
              .update({ shown_at: new Date().toISOString() })
              .eq('id', data.firstQuestion.id);

            await channelRef.current.send({
              type: 'broadcast',
              event: 'game_event',
              payload: {
                type: 'QUESTION',
                question: data.firstQuestion,
                timeLimit: data.timePerQuestion,
              } as BroadcastEvent,
            });
          }
        }, COUNTDOWN_SECONDS * 1000);
      }
    } catch (err) {
      console.error('Error starting game:', err);
      setError(err instanceof Error ? err : new Error('Failed to start game'));
    }
  }, [isHost, challengeCode, supabase]);

  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!currentQuestion || hasAnsweredRef.current) return null;
      hasAnsweredRef.current = true;

      const responseTimeMs = Date.now() - questionStartTimeRef.current;

      try {
        const response = await fetch('/api/defi/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeCode,
            questionId: currentQuestion.id,
            answer,
            responseTimeMs,
            playerId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          hasAnsweredRef.current = false;
          throw new Error(data.error || 'Failed to submit answer');
        }

        // Mettre à jour le state local IMMÉDIATEMENT (avant le broadcast)
        // C'est crucial car les broadcasts ne sont pas reçus par l'émetteur
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === playerId
              ? { ...p, hasAnswered: true, score: data.newScore }
              : p
          )
        );

        setScores((prev) => ({
          ...prev,
          [playerId]: data.newScore,
        }));

        if (channelRef.current) {
          // Broadcast aux autres joueurs
          await channelRef.current.send({
            type: 'broadcast',
            event: 'game_event',
            payload: {
              type: 'PLAYER_ANSWERED',
              playerId,
              playerName: displayName,
            } as BroadcastEvent,
          });

          // Mettre à jour Presence pour la synchronisation
          await channelRef.current.track({
            display_name: displayName,
            is_ready: true,
            is_host: isHost,
            hasAnswered: true,
            score: data.newScore,
          });
        }

        return {
          isCorrect: data.isCorrect,
          pointsEarned: data.pointsEarned,
          correctAnswer: data.correctAnswer,
        };
      } catch (err) {
        console.error('Error submitting answer:', err);
        setError(err instanceof Error ? err : new Error('Failed to submit answer'));
        return null;
      }
    },
    [currentQuestion, challengeCode, playerId, displayName, isHost]
  );

  const leaveRoom = useCallback(async () => {
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'game_event',
        payload: {
          type: 'PLAYER_LEFT',
          playerId,
        } as BroadcastEvent,
      });

      await channelRef.current.untrack();
    }

    await supabase
      .from('challenge_players')
      .update({ is_connected: false })
      .eq('id', playerId);
  }, [playerId, supabase]);

  return {
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
  };
}
