'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useFoldersManagement } from '@/hooks/useFoldersManagement';
import { FOLDER_COLORS } from '@/lib/courses/constants';

// Subject icons organized by category
const FOLDER_ICONS = [
  // General
  { emoji: '📁', label: 'Dossier' },
  { emoji: '📚', label: 'Livres' },
  { emoji: '📖', label: 'Lecture' },
  // Sciences
  { emoji: '🔬', label: 'Sciences' },
  { emoji: '🧪', label: 'Chimie' },
  { emoji: '⚗️', label: 'Laboratoire' },
  { emoji: '🧬', label: 'Biologie' },
  { emoji: '🔭', label: 'Astronomie' },
  // Math & Physics
  { emoji: '📐', label: 'Géométrie' },
  { emoji: '🔢', label: 'Maths' },
  { emoji: '➗', label: 'Calcul' },
  { emoji: '⚡', label: 'Physique' },
  // Languages & Literature
  { emoji: '🌍', label: 'Géographie' },
  { emoji: '🗣️', label: 'Langues' },
  { emoji: '✍️', label: 'Écriture' },
  { emoji: '📝', label: 'Notes' },
  // Arts & Music
  { emoji: '🎨', label: 'Art' },
  { emoji: '🎵', label: 'Musique' },
  { emoji: '🎭', label: 'Théâtre' },
  // Tech & Business
  { emoji: '💻', label: 'Informatique' },
  { emoji: '📊', label: 'Économie' },
  { emoji: '💼', label: 'Business' },
  { emoji: '⚖️', label: 'Droit' },
  // History & Philosophy
  { emoji: '🏛️', label: 'Histoire' },
  { emoji: '🧠', label: 'Philosophie' },
  // Health & Sports
  { emoji: '🏥', label: 'Médecine' },
  { emoji: '⚽', label: 'Sport' },
  // Other
  { emoji: '🎓', label: 'Diplôme' },
  { emoji: '💡', label: 'Idées' },
  { emoji: '🌱', label: 'Environnement' },
];

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateFolderModal({ isOpen, onClose }: CreateFolderModalProps) {
  const { isDark } = useTheme();
  const { createFolder } = useFoldersManagement();
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0].color);
  const [selectedIcon, setSelectedIcon] = useState('📁');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setError(null);
    setIsCreating(true);
    const result = await createFolder(name.trim(), selectedColor, selectedIcon);
    setIsCreating(false);

    if (result.success) {
      setName('');
      setSelectedColor(FOLDER_COLORS[0].color);
      setSelectedIcon('📁');
      setError(null);
      onClose();
    } else {
      // Traduire les erreurs courantes
      if (result.error?.includes('already exists')) {
        setError('Un dossier avec ce nom existe déjà');
      } else {
        setError(result.error || 'Une erreur est survenue');
      }
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (error) setError(null);
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
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                    style={{ backgroundColor: `${selectedColor}20` }}
                  >
                    {selectedIcon}
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
                    onChange={handleNameChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Ex: Économie, Maths..."
                    autoFocus
                    className={`w-full px-4 py-2.5 rounded-xl border transition-colors ${
                      error
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                        : isDark
                          ? 'border-neutral-700 focus:border-orange-500'
                          : 'border-gray-200 focus:border-orange-500'
                    } ${
                      isDark
                        ? 'bg-neutral-800 text-neutral-100 placeholder-neutral-500'
                        : 'bg-white text-gray-900 placeholder-gray-400'
                    } focus:outline-none focus:ring-2 ${!error && 'focus:ring-orange-500/20'}`}
                  />
                  {/* Error message */}
                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="mt-2 text-sm text-red-500"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Icon picker */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-neutral-300' : 'text-gray-700'
                  }`}>
                    Icône
                  </label>
                  <div className={`max-h-32 overflow-y-auto rounded-xl p-2 ${
                    isDark ? 'bg-neutral-800' : 'bg-gray-50'
                  }`}>
                    <div className="grid grid-cols-10 gap-1">
                      {FOLDER_ICONS.map((icon) => (
                        <button
                          key={icon.emoji}
                          onClick={() => setSelectedIcon(icon.emoji)}
                          title={icon.label}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${
                            selectedIcon === icon.emoji
                              ? 'bg-orange-500/20 ring-2 ring-orange-500 scale-110'
                              : isDark
                                ? 'hover:bg-neutral-700'
                                : 'hover:bg-gray-200'
                          }`}
                        >
                          {icon.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
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
