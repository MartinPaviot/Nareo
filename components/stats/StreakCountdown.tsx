'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { getTimeUntilMidnight, formatCountdown } from '@/lib/stats/utils';

export default function StreakCountdown() {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 flex items-center gap-2 text-sm"
    >
      <Clock className="w-4 h-4 text-yellow-600" />
      <span className="text-yellow-700 font-medium">
        Temps restant: <span className="font-mono font-bold">{timeLeft}</span>
      </span>
    </motion.div>
  );
}
