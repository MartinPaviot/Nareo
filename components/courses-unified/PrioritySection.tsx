'use client';

import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { PriorityItem } from '@/lib/courses/types';
import PriorityCard from './PriorityCard';

interface PrioritySectionProps {
  items: PriorityItem[];
}

export default function PrioritySection({ items }: PrioritySectionProps) {
  const { isDark } = useTheme();

  if (items.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-5 border ${
        isDark
          ? 'bg-gradient-to-r from-orange-950/50 to-yellow-950/30 border-orange-900/50'
          : 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-100'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-1.5 rounded-lg ${isDark ? 'bg-orange-900/50' : 'bg-orange-100'}`}>
          <Zap className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
        </div>
        <h2 className={`font-semibold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
          À réviser en priorité
        </h2>
      </div>

      {/* Priority items list */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <PriorityCard item={item} />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
