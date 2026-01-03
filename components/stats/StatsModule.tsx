'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, BookOpen, Target, Trophy } from 'lucide-react';
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
import MasteryPreview from './MasteryPreview';
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
    <div className={`rounded-xl p-4 border shadow-sm text-center ${
      isDark
        ? 'bg-neutral-800 border-neutral-700'
        : 'bg-white border-gray-100'
    }`}>
      <div className="flex items-center justify-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
        <span className={`text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{label}</span>
      </div>
      <p className={`text-xl font-bold ${!valueColor ? (isDark ? 'text-white' : 'text-gray-900') : ''}`} style={valueColor ? { color: valueColor } : {}}>{value}</p>
      {subValue && <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>{subValue}</p>}
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

  const handleStartSession = () => {
    // Scroll to the courses section on the dashboard
    document.getElementById('courses-section')?.scrollIntoView({ behavior: 'smooth' });
  };

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StreakCard
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          state={streakState}
          freezesAvailable={freezesAvailable}
          previousStreakLost={previousStreakLost}
        />
        <DailyGoalCard
          current={todayActivity?.questions_answered || 0}
          target={todayActivity?.daily_goal_target || 15}
          completed={todayActivity?.daily_goal_completed || false}
          goalLevel={stats?.daily_goal_level || 'standard'}
          onGoalLevelChange={updateDailyGoalLevel}
        />
      </div>

      {/* Row 2: CTA */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full text-white py-4 px-6 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
        style={{ backgroundColor: '#ff751f' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
        onClick={handleStartSession}
      >
        {todayActivity?.questions_answered && todayActivity.questions_answered > 0
          ? translate('stats_cta_continue')
          : translate('stats_cta_start')}
        <ArrowRight className="w-5 h-5" />
      </motion.button>

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
          icon={Target}
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

      {/* Row 4: Mastery Preview */}
      <MasteryPreview />
    </div>
  );
}
