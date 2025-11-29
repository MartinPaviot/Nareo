'use client';

import { BookOpen, HelpCircle, Trophy, Target } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface TodayStatsCardProps {
  stats: {
    quizzesCompleted: number;
    questionsAnswered: number;
    pointsEarned: number;
    accuracy: number;
  };
}

/**
 * Carte activité du jour - performance quotidienne
 *
 * CHANGEMENTS v2:
 * - Padding réduit: p-4 sm:p-5 (au lieu de p-4 sm:p-6)
 * - Titre responsive: text-base sm:text-lg (au lieu de text-lg)
 * - Margin titre réduit: mb-3 (au lieu de mb-3 sm:mb-4)
 * - Gap grille réduit: gap-2.5 sm:gap-3 (au lieu de gap-3 sm:gap-4)
 * - Rounded-2xl pour cohérence (au lieu de rounded-3xl)
 * - Shadow réduit: shadow-sm (au lieu de shadow-md)
 *
 * UX:
 * - Grille 2×2 équilibrée pour lecture rapide
 * - Icônes pour scan visuel rapide
 * - Chiffres en orange-600 (cohérence palette)
 * - Labels courts et clairs
 *
 * Design:
 * - CORRECTION: toutes les valeurs en text-orange-600 (pas de bleu/purple/green)
 * - Icônes sur fond gray-100 (sobre, cohérent)
 * - Chiffres en text-xl (pas text-2xl pour hiérarchie)
 *
 * Responsive:
 * - Mobile: padding réduit (p-4), grille 2×2 compacte
 * - Desktop: même layout avec plus d'espacement
 */
export default function TodayStatsCard({ stats }: TodayStatsCardProps) {
  const { translate } = useLanguage();

  const statsConfig = [
    {
      icon: BookOpen,
      label: translate('daily_ritual_quizzes'),
      value: stats.quizzesCompleted,
    },
    {
      icon: HelpCircle,
      label: translate('daily_ritual_questions'),
      value: stats.questionsAnswered,
    },
    {
      icon: Trophy,
      label: translate('daily_ritual_points'),
      value: stats.pointsEarned,
    },
    {
      icon: Target,
      label: translate('daily_ritual_accuracy'),
      value: `${stats.accuracy}%`,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">
        {translate('today_stats_title')}
      </h3>

      {/* Grille 2×2 */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {statsConfig.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              {/* Icône - toutes sur fond gris (cohérence) */}
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
              </div>

              {/* Valeur + label */}
              <div>
                {/* Chiffres en text-xl (orange pour tous) */}
                <p className="text-xl font-bold text-orange-600">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-600">
                  {stat.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
