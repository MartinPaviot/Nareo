'use client';

import { Shield } from 'lucide-react';
import { motion } from 'framer-motion';

interface StreakFreezeIndicatorProps {
  count: number;
}

export default function StreakFreezeIndicator({ count }: StreakFreezeIndicatorProps) {
  if (count <= 0) return null;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded-full"
    >
      <Shield className="w-4 h-4 text-blue-500" />
      <span className="text-xs font-semibold text-blue-600">{count}</span>
    </motion.div>
  );
}
