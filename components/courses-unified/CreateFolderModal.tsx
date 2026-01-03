'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Folder } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useFoldersManagement } from '@/hooks/useFoldersManagement';
import { FOLDER_COLORS } from '@/lib/courses/constants';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateFolderModal({ isOpen, onClose }: CreateFolderModalProps) {
  const { isDark } = useTheme();
  const { createFolder } = useFoldersManagement();
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0].color);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    const folderId = await createFolder(name.trim(), selectedColor, '📁');
    setIsCreating(false);

    if (folderId) {
      setName('');
      setSelectedColor(FOLDER_COLORS[0].color);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating) {
      handleCreate();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className={`w-full max-w-md rounded-2xl shadow-xl ${
                isDark ? 'bg-neutral-900' : 'bg-white'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`flex items-center justify-between p-4 border-b ${
                isDark ? 'border-neutral-800' : 'border-gray-100'
              }`}>
                <h2 className={`text-lg font-semibold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
                  Nouveau dossier
                </h2>
                <button
                  onClick={onClose}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-neutral-800' : 'hover:bg-gray-100'
                  }`}
                >
                  <X className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Folder preview */}
                <div className="flex justify-center py-4">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${selectedColor}20` }}
                  >
                    <Folder className="w-10 h-10" style={{ color: selectedColor }} />
                  </div>
                </div>

                {/* Name input */}
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${
                    isDark ? 'text-neutral-300' : 'text-gray-700'
                  }`}>
                    Nom du dossier
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ex: Économie, Maths..."
                    autoFocus
                    className={`w-full px-4 py-2.5 rounded-xl border transition-colors ${
                      isDark
                        ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-orange-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-orange-500'
                    } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                  />
                </div>

                {/* Color picker */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-neutral-300' : 'text-gray-700'
                  }`}>
                    Couleur
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {FOLDER_COLORS.map((colorOption) => (
                      <button
                        key={colorOption.id}
                        onClick={() => setSelectedColor(colorOption.color)}
                        className={`w-8 h-8 rounded-full transition-transform ${
                          selectedColor === colorOption.color ? 'ring-2 ring-offset-2 scale-110' : ''
                        }`}
                        style={{
                          backgroundColor: colorOption.color,
                          '--tw-ring-color': colorOption.color,
                        } as React.CSSProperties}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className={`flex items-center justify-end gap-3 p-4 border-t ${
                isDark ? 'border-neutral-800' : 'border-gray-100'
              }`}>
                <button
                  onClick={onClose}
                  className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                    isDark
                      ? 'text-neutral-300 hover:bg-neutral-800'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!name.trim() || isCreating}
                  className="px-4 py-2 rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: '#ff751f' }}
                  onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#e5681b')}
                  onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#ff751f')}
                >
                  {isCreating ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
