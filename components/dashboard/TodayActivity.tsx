'use client';

import { useRouter } from 'next/navigation';
import { BookOpen, HelpCircle, Zap, Target, Play, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

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
  textColor: string;
  iconBgColor: string;
}

function StatCard({ icon, value, label, bgColor, textColor, iconBgColor }: StatCardProps) {
  return (
    <div className={`${bgColor} rounded-2xl p-4 flex flex-col items-center justify-center gap-2`}>
      <div className={`w-10 h-10 ${iconBgColor} rounded-xl flex items-center justify-center`}>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
      <p className="text-xs text-gray-600 font-medium text-center">{label}</p>
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
    <div className="bg-white px-4 sm:px-6 py-5">
      {/* Title */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        {translate('today_activity_title')}
      </h2>

      {/* Stats Grid 2x2 */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard
          icon={<BookOpen className="w-5 h-5 text-orange-600" />}
          value={stats.quizzesCompleted}
          label={translate('today_quizzes')}
          bgColor="bg-orange-50"
          textColor="text-orange-700"
          iconBgColor="bg-orange-100"
        />
        <StatCard
          icon={<HelpCircle className="w-5 h-5 text-blue-600" />}
          value={stats.questionsAnswered}
          label={translate('today_questions')}
          bgColor="bg-blue-50"
          textColor="text-blue-700"
          iconBgColor="bg-blue-100"
        />
        <StatCard
          icon={<Zap className="w-5 h-5 text-purple-600" />}
          value={stats.pointsEarned}
          label={translate('today_points')}
          bgColor="bg-purple-50"
          textColor="text-purple-700"
          iconBgColor="bg-purple-100"
        />
        <StatCard
          icon={<Target className="w-5 h-5 text-green-600" />}
          value={`${stats.accuracy}%`}
          label={translate('today_accuracy')}
          bgColor="bg-green-50"
          textColor="text-green-700"
          iconBgColor="bg-green-100"
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
