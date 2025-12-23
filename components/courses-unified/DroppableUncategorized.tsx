'use client';

import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

interface DroppableUncategorizedProps {
  children: React.ReactNode;
}

export default function DroppableUncategorized({ children }: DroppableUncategorizedProps) {
  const { isDark } = useTheme();
  const { isOver, setNodeRef } = useDroppable({
    id: 'uncategorized',
    data: {
      type: 'uncategorized',
      folderId: null,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className="relative"
    >
      {/* Drop indicator */}
      {isOver && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`absolute inset-0 rounded-2xl border-2 border-dashed z-10 pointer-events-none ${
            isDark ? 'border-gray-500 bg-gray-500/10' : 'border-gray-400 bg-gray-50'
          }`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`px-4 py-2 rounded-xl font-medium shadow-lg ${
              isDark ? 'bg-neutral-700 text-neutral-200' : 'bg-gray-600 text-white'
            }`}>
              Retirer du dossier
            </div>
          </div>
        </motion.div>
      )}

      {children}
    </div>
  );
}
