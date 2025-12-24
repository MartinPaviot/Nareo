'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { getTimeUntilMidnight, formatCountdown } from '@/lib/stats/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface StreakCountdownProps {
  compact?: boolean;
}

export default function StreakCountdown({ compact = false }: StreakCountdownProps) {
  const { translate } = useLanguage();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateCountdown = () => {
      const time = getTimeUntilMidnight();
      setTimeLeft(formatCountdown(time));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  if (compact) {
    return (
      <div className="flex items-center justify-end gap-1.5 text-sm mt-1">
        <Clock className="w-3.5 h-3.5 text-yellow-600" />
        <span className="text-yellow-700 font-medium">
          <span className="font-mono font-bold">{timeLeft}</span>
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 flex items-center gap-2 text-sm"
    >
      <Clock className="w-4 h-4 text-yellow-600" />
      <span className="text-yellow-700 font-medium">
        {translate('streak_time_remaining')}: <span className="font-mono font-bold">{timeLeft}</span>
      </span>
    </motion.div>
  );
}
