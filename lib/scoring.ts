import { BadgeType } from '@/types/concept.types';

export const PHASE_SCORES = {
  1: 10,  // MCQ
  2: 30,  // Short Answer
  3: 60,  // Reflective
} as const;

export const MAX_SCORE_PER_CONCEPT = 100;

export function calculateTotalScore(
  phase1Score: number,
  phase2Score: number,
  phase3Score: number
): number {
  return phase1Score + phase2Score + phase3Score;
}

export function calculateBadge(totalScore: number): BadgeType {
  if (totalScore >= 100) return 'gold';
  if (totalScore >= 80) return 'silver';
  if (totalScore >= 60) return 'bronze';
  return null;
}

export function isConceptMastered(totalScore: number): boolean {
  return totalScore >= 60;
}

export function calculateProgressPercentage(
  completedConcepts: number,
  totalConcepts: number
): number {
  if (totalConcepts === 0) return 0;
  return Math.round((completedConcepts / totalConcepts) * 100);
}

export function checkStreakReward(masteredInRow: number): boolean {
  return masteredInRow >= 3;
}

export function getPhaseMaxScore(phase: 1 | 2 | 3): number {
  return PHASE_SCORES[phase];
}

export function normalizeScore(score: number, maxScore: number): number {
  return Math.min(Math.max(0, score), maxScore);
}
