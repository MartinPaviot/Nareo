'use client';

import { motion } from 'framer-motion';
import { Flame, Shield } from 'lucide-react';
import type { StreakState } from '@/lib/stats/types';

interface StreakFlameProps {
  state: StreakState;
  size?: 'sm' | 'md' | 'lg';
}

export default function StreakFlame({ state, size = 'md' }: StreakFlameProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  const iconSize = sizeClasses[size];

  if (state === 'on_fire') {
    return (
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: "easeInOut"
        }}
        className="relative"
      >
        <Flame className={`${iconSize} text-orange-500`} />
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute inset-0 blur-md bg-orange-400 rounded-full -z-10"
        />
      </motion.div>
    );
  }

  if (state === 'at_risk') {
    return (
      <motion.div
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: 1,
          ease: "easeInOut"
        }}
      >
        <Flame className={`${iconSize} text-yellow-500`} />
      </motion.div>
    );
  }

  if (state === 'protected') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="relative"
      >
        <Shield className={`${iconSize} text-blue-500`} />
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 blur-sm bg-blue-400 rounded-full -z-10"
        />
      </motion.div>
    );
  }

  if (state === 'lost') {
    return (
      <motion.div
        initial={{ rotate: 0 }}
        animate={{ rotate: [0, -10, 0] }}
        transition={{ duration: 0.5 }}
      >
        <Flame className={`${iconSize} text-gray-300`} />
      </motion.div>
    );
  }

  // new_user
  return <Flame className={`${iconSize} text-gray-300`} />;
}
