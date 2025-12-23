'use client';

import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

interface DroppableFolderProps {
  folderId: string;
  folderName: string;
  folderColor: string;
  children: React.ReactNode;
}

export default function DroppableFolder({
  folderId,
  folderName,
  folderColor,
  children,
}: DroppableFolderProps) {
  const { isDark } = useTheme();
  const { isOver, setNodeRef } = useDroppable({
    id: `folder-${folderId}`,
    data: {
      type: 'folder',
      folderId,
      folderName,
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
            isDark ? 'border-orange-500 bg-orange-500/10' : 'border-orange-500 bg-orange-50'
          }`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="px-4 py-2 rounded-xl font-medium text-white shadow-lg"
              style={{ backgroundColor: folderColor }}
            >
              Deposer dans "{folderName}"
            </div>
          </div>
        </motion.div>
      )}

      {children}
    </div>
  );
}
