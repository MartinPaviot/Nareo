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
  customStyles?: {
    bg?: string;
    iconBg?: string;
    text?: string;
  };
}

function StatCard({ icon, value, label, bgColor, darkBgColor, textColor, darkTextColor, iconBgColor, darkIconBgColor, isDark, customStyles }: StatCardProps) {
  return (
    <div
      className={`rounded-xl p-3 flex flex-col items-center justify-center gap-1 ${customStyles ? '' : (isDark ? darkBgColor : bgColor)}`}
      style={customStyles?.bg ? { backgroundColor: customStyles.bg } : {}}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${customStyles ? '' : (isDark ? darkIconBgColor : iconBgColor)}`}
        style={customStyles?.iconBg ? { backgroundColor: customStyles.iconBg } : {}}
      >
        {icon}
      </div>
      <p
        className={`text-xl font-bold ${customStyles ? '' : (isDark ? darkTextColor : textColor)}`}
        style={customStyles?.text ? { color: customStyles.text } : {}}
      >
        {value}
      </p>
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
    <div className={`px-4 sm:px-6 py-4 ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
      {/* Title */}
      <h2 className={`text-base font-bold mb-3 ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
        {translate('today_activity_title')}
      </h2>

      {/* Stats Grid 2x2 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <StatCard
          icon={<BookOpen className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />}
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
          icon={<HelpCircle className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />}
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
          icon={<Zap className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />}
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
          icon={<Target className="w-4 h-4" style={{ color: isDark ? '#5cb978' : '#379f5a' }} />}
          value={`${stats.accuracy}%`}
          label={translate('today_accuracy')}
          bgColor=""
          darkBgColor=""
          textColor=""
          darkTextColor=""
          iconBgColor=""
          darkIconBgColor=""
          isDark={isDark}
          customStyles={{
            bg: isDark ? 'rgba(55, 159, 90, 0.15)' : 'rgba(55, 159, 90, 0.1)',
            iconBg: isDark ? 'rgba(55, 159, 90, 0.3)' : 'rgba(55, 159, 90, 0.2)',
            text: isDark ? '#5cb978' : '#379f5a'
          }}
        />
      </div>

      {/* CTA Button */}
      <button
        onClick={handleCTAClick}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
        style={{ backgroundColor: '#ff751f' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
      >
        {hasQuizAvailable ? (
          <>
            <Play className="w-4 h-4" />
            {translate('today_cta_quiz')}
          </>
        ) : (
          <>
            {translate('today_cta_choose')}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
}
