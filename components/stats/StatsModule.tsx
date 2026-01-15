'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Crosshair, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUserStats } from '@/hooks/useUserStats';
import { useDailyActivity } from '@/hooks/useDailyActivity';
import { useStreak } from '@/hooks/useStreak';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getPrecision } from '@/lib/stats/utils';
import StreakCard from './StreakCard';
import DailyGoalCard from './DailyGoalCard';
import XPDisplay from './XPDisplay';
import WelcomeActionSection from './WelcomeActionSection';
import MilestoneModal from './MilestoneModal';
import StatsModuleSkeleton from './StatsModuleSkeleton';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  valueColor?: string;
  isDark?: boolean;
}

function StatCard({ icon: Icon, label, value, subValue, valueColor, isDark = false }: StatCardProps) {
  return (
    <div
      className={`rounded-md px-3 py-2 border shadow-sm text-center transition-all duration-200 cursor-default ${
        isDark
          ? 'bg-neutral-800 border-neutral-700 hover:border-neutral-600 hover:shadow-md'
          : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-md'
      }`}
      style={{ transform: 'translateY(0)' }}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div className="flex items-center justify-center gap-1 mb-0">
        <Icon className={`w-3 h-3 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
        <span className={`text-[11px] font-medium ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{label}</span>
      </div>
      <p className={`text-sm font-bold leading-tight ${!valueColor ? (isDark ? 'text-white' : 'text-gray-900') : ''}`} style={valueColor ? { color: valueColor } : {}}>{value}</p>
      {subValue && <p className={`text-[11px] leading-tight ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>{subValue}</p>}
    </div>
  );
}

export default function StatsModule() {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const { stats, isLoading: statsLoading, updateDailyGoalLevel } = useUserStats();
  const { todayActivity, isLoading: activityLoading } = useDailyActivity();
  const { currentStreak, longestStreak, streakState, freezesAvailable, previousStreakLost, checkMilestones } = useStreak();

  const [milestoneRewards, setMilestoneRewards] = useState<any[]>([]);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [currentMilestoneIndex, setCurrentMilestoneIndex] = useState(0);

  const isLoading = statsLoading || activityLoading;

  // Check for milestones on mount
  useEffect(() => {
    const checkForMilestones = async () => {
      const rewards = await checkMilestones();
      if (rewards.length > 0) {
        setMilestoneRewards(rewards);
        setShowMilestoneModal(true);
      }
    };

    if (!isLoading && currentStreak > 0) {
      checkForMilestones();
    }
  }, [isLoading, currentStreak, checkMilestones]);

  const handleCloseMilestone = () => {
    if (currentMilestoneIndex < milestoneRewards.length - 1) {
      setCurrentMilestoneIndex(prev => prev + 1);
    } else {
      setShowMilestoneModal(false);
      setCurrentMilestoneIndex(0);
    }
  };

  if (isLoading) {
    return <StatsModuleSkeleton />;
  }

  const precision = todayActivity?.questions_answered && todayActivity.questions_answered > 0
    ? getPrecision(todayActivity.questions_correct || 0, todayActivity.questions_answered)
    : 0;

  return (
    <div className="space-y-4">
      {/* Milestone Modal */}
      {showMilestoneModal && milestoneRewards.length > 0 && (
        <MilestoneModal
          reward={milestoneRewards[currentMilestoneIndex]}
          onClose={handleCloseMilestone}
        />
      )}

      {/* Row 1: Streak + Daily Goal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StreakCard
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          state={streakState}
          freezesAvailable={freezesAvailable}
          previousStreakLost={previousStreakLost}
        />
        <DailyGoalCard
          activityUnits={todayActivity?.activity_units || 0}
          target={todayActivity?.daily_goal_target || 35}
          completed={todayActivity?.daily_goal_completed || false}
          goalLevel={stats?.daily_goal_level || 'standard'}
          onGoalLevelChange={updateDailyGoalLevel}
        />
      </div>

      {/* Row 2: Welcome Action Section */}
      <WelcomeActionSection />

      {/* Row 3: Stats secondaires */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={BookOpen}
          label={translate('stats_label_quiz')}
          value={todayActivity?.quizzes_completed || 0}
          subValue={translate('stats_label_today')}
          isDark={isDark}
        />
        <StatCard
          icon={Crosshair}
          label={translate('stats_label_precision')}
          value={`${precision}%`}
          subValue={translate('stats_label_today')}
          valueColor={precision >= 70 ? '#379f5a' : precision >= 50 ? '#ca8a04' : '#ef4444'}
          isDark={isDark}
        />
        <XPDisplay totalXP={stats?.total_xp || 0} compact />
        <StatCard
          icon={Trophy}
          label={translate('stats_label_record')}
          value={`${longestStreak}${translate('stats_days_abbreviation')}`}
          subValue={translate('stats_label_best_streak')}
          isDark={isDark}
        />
      </div>
    </div>
  );
}
