'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Shield } from 'lucide-react';
import type { MilestoneReward } from '@/lib/stats/types';
import { STREAK_MILESTONES } from '@/lib/stats/constants';
import ConfettiEffect from './ConfettiEffect';

interface MilestoneModalProps {
  reward: MilestoneReward;
  onClose: () => void;
}

export default function MilestoneModal({ reward, onClose }: MilestoneModalProps) {
  const [showConfetti, setShowConfetti] = useState(true);

  // Find the milestone details
  const milestone = STREAK_MILESTONES.find(m => m.days === reward.milestone);

  useEffect(() => {
    // Stop confetti after 3 seconds
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <ConfettiEffect active={showConfetti} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.5, opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-yellow-50" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 transition-colors z-10"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>

          <div className="relative z-10">
            {/* Emoji celebration */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              className="text-6xl mb-4"
            >
              {milestone?.emoji || '🎉'}
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-gray-900 mb-2"
            >
              {reward.milestone} jours !
            </motion.h2>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-gray-600 mb-6"
            >
              {milestone?.message || 'Felicitations pour ta serie !'}
            </motion.p>

            {/* Rewards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              {/* XP Reward */}
              <div className="flex items-center justify-center gap-2 p-3 bg-orange-100 rounded-xl">
                <Star className="w-5 h-5 text-orange-500" />
                <span className="font-bold text-orange-600">+{reward.xp} XP</span>
              </div>

              {/* Freeze Reward */}
              {reward.freeze && (
                <div className="flex items-center justify-center gap-2 p-3 bg-blue-100 rounded-xl">
                  <Shield className="w-5 h-5 text-blue-500" />
                  <span className="font-bold text-blue-600">+1 Streak Freeze</span>
                </div>
              )}
            </motion.div>

            {/* Continue button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              onClick={onClose}
              className="mt-6 w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
            >
              Continuer
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
