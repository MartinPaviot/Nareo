'use client';

import { useState, useEffect } from 'react';
import { getTimeUntilMidnight, formatCountdown } from '@/lib/stats/utils';

export function useStreakCountdown() {
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

  return timeLeft;
}
