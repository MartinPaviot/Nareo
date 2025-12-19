'use client';

import { useRouter } from 'next/navigation';
import { BookOpen, HelpCircle, Zap, Target, Play, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface TodayActivityProps {
  stats: {
    quizzesCompleted: number;
    questionsAnswered: number;
    pointsEarned: number;
    accuracy: number;
  };
  hasQuizAvailable?: boolean;
  onStartQuiz?: () => void;
  onChooseChapter?: () => void;
}

interface StatCardProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  bgColor: string;
  darkBgColor: string;
  textColor: string;
  darkTextColor: string;
  iconBgColor: string;
  darkIconBgColor: string;
  isDark: boolean;
}

function StatCard({ icon, value, label, bgColor, darkBgColor, textColor, darkTextColor, iconBgColor, darkIconBgColor, isDark }: StatCardProps) {
  return (
    <div className={`rounded-2xl p-4 flex flex-col items-center justify-center gap-2 ${isDark ? darkBgColor : bgColor}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? darkIconBgColor : iconBgColor}`}>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${isDark ? darkTextColor : textColor}`}>{value}</p>
      <p className={`text-xs font-medium text-center ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>{label}</p>
    </div>
  );
}

export default function TodayActivity({
  stats,
  hasQuizAvailable = false,
  onStartQuiz,
  onChooseChapter,
}: TodayActivityProps) {
  const router = useRouter();
  const { translate } = useLanguage();
  const { isDark } = useTheme();

  const handleCTAClick = () => {
    if (hasQuizAvailable && onStartQuiz) {
      onStartQuiz();
    } else if (onChooseChapter) {
      onChooseChapter();
    } else {
      // Scroll to courses section
      document.getElementById('courses-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className={`px-4 sm:px-6 py-5 ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
      {/* Title */}
      <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
        {translate('today_activity_title')}
      </h2>

      {/* Stats Grid 2x2 */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard
          icon={<BookOpen className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />}
          value={stats.quizzesCompleted}
          label={translate('today_quizzes')}
          bgColor="bg-orange-50"
          darkBgColor="bg-orange-950/40"
          textColor="text-orange-700"
          darkTextColor="text-orange-400"
          iconBgColor="bg-orange-100"
          darkIconBgColor="bg-orange-900/50"
          isDark={isDark}
        />
        <StatCard
          icon={<HelpCircle className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />}
          value={stats.questionsAnswered}
          label={translate('today_questions')}
          bgColor="bg-blue-50"
          darkBgColor="bg-blue-950/40"
          textColor="text-blue-700"
          darkTextColor="text-blue-400"
          iconBgColor="bg-blue-100"
          darkIconBgColor="bg-blue-900/50"
          isDark={isDark}
        />
        <StatCard
          icon={<Zap className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />}
          value={stats.pointsEarned}
          label={translate('today_points')}
          bgColor="bg-purple-50"
          darkBgColor="bg-purple-950/40"
          textColor="text-purple-700"
          darkTextColor="text-purple-400"
          iconBgColor="bg-purple-100"
          darkIconBgColor="bg-purple-900/50"
          isDark={isDark}
        />
        <StatCard
          icon={<Target className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />}
          value={`${stats.accuracy}%`}
          label={translate('today_accuracy')}
          bgColor="bg-green-50"
          darkBgColor="bg-green-950/40"
          textColor="text-green-700"
          darkTextColor="text-green-400"
          iconBgColor="bg-green-100"
          darkIconBgColor="bg-green-900/50"
          isDark={isDark}
        />
      </div>

      {/* CTA Button */}
      <button
        onClick={handleCTAClick}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
      >
        {hasQuizAvailable ? (
          <>
            <Play className="w-5 h-5" />
            {translate('today_cta_quiz')}
          </>
        ) : (
          <>
            {translate('today_cta_choose')}
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );
}
