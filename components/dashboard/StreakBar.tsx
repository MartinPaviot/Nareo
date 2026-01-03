'use client';

import Image from 'next/image';
import { Flame, Trophy } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface StreakBarProps {
  currentStreak: number;
  longestStreak: number;
}

/**
 * Bandeau streak horizontal - motivation quotidienne
 *
 * CHANGEMENTS v4:
 * - Mascotte agrandie: w-20 h-20 sm:w-24 sm:h-24
 * - Espacement mascotte optimisé: gap-3 sm:gap-4
 * - Padding: p-4 sm:p-5
 * - Gap stats: gap-4 sm:gap-5
 *
 * UX:
 * - Format bandeau fin pour ne pas fragmenter la page
 * - Fond orange pâle pour lien avec la marque
 * - Mascotte Happy.png en micro-avatar (rôle de cheerleader)
 * - Texte motivant pour inciter à la régularité
 *
 * Design:
 * - Chiffres en text-xl (pas text-2xl pour garder hiérarchie)
 * - Icônes sur fond orange/yellow
 *
 * Responsive:
 * - Mobile: mascotte w-20 h-20
 * - Desktop: mascotte w-24 h-24
 */
export default function StreakBar({ currentStreak, longestStreak }: StreakBarProps) {
  const { translate } = useLanguage();

  return (
    <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 rounded-2xl border border-orange-200/50 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Stats de streak */}
        <div className="flex items-center gap-4 sm:gap-5">
          {/* Série actuelle */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ff751f' }}>
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <p className="text-xl font-bold text-orange-600">{currentStreak}</p>
              <p className="text-xs text-gray-600">{translate('streak_current_label')}</p>
            </div>
          </div>

          {/* Record */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500 rounded-full flex items-center justify-center">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <p className="text-xl font-bold text-yellow-600">{longestStreak}</p>
              <p className="text-xs text-gray-600">{translate('streak_record_label')}</p>
            </div>
          </div>
        </div>

        {/* Message motivant + mascotte */}
        <div className="flex items-center gap-3 sm:gap-4">
          <p className="text-xs sm:text-sm font-medium text-gray-700 text-center sm:text-right">
            {translate('streak_motivation_text')}
          </p>

          {/* Mascotte Happy (cheerleader) - Agrandie */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
            <Image
              src="/chat/Happy.png"
              alt="Mascot encouraging"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
