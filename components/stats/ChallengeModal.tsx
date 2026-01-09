'use client';

import { useEffect, useState } from 'react';
import { X, PlusCircle, Users, Trophy } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import CreateChallengeModal from '@/components/defi/CreateChallengeModal';
import JoinChallengeModal from '@/components/defi/JoinChallengeModal';

interface ChallengeModalProps {
  onClose: () => void;
}

export default function ChallengeModal({ onClose }: ChallengeModalProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleCreateChallenge = () => {
    setShowCreateModal(true);
  };

  const handleJoinChallenge = () => {
    setShowJoinModal(true);
  };

  // If showing a sub-modal, render it instead
  if (showCreateModal) {
    return <CreateChallengeModal onClose={onClose} />;
  }

  if (showJoinModal) {
    return <JoinChallengeModal onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md rounded-2xl shadow-xl ${
          isDark ? 'bg-neutral-900' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-6 border-b ${
            isDark ? 'border-neutral-800' : 'border-gray-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {translate('challenge_modal_title', 'Mode Défi')}
              </h2>
              <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {translate('challenge_modal_subtitle', 'Défie tes amis')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          {/* Create Challenge */}
          <button
            onClick={handleCreateChallenge}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors ${
              isDark
                ? 'bg-neutral-800 border-neutral-700 hover:border-orange-500/50'
                : 'bg-gray-50 border-gray-200 hover:border-orange-300'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
              <PlusCircle className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {translate('challenge_create', 'Créer un défi')}
              </p>
              <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {translate('challenge_create_desc', 'Défie tes amis')}
              </p>
            </div>
          </button>

          {/* Join Challenge */}
          <button
            onClick={handleJoinChallenge}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors ${
              isDark
                ? 'bg-neutral-800 border-neutral-700 hover:border-orange-500/50'
                : 'bg-gray-50 border-gray-200 hover:border-orange-300'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {translate('challenge_join', 'Rejoindre un défi')}
              </p>
              <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {translate('challenge_join_desc', "Entre un code d'invitation")}
              </p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div
          className={`p-6 border-t ${
            isDark ? 'border-neutral-800' : 'border-gray-100'
          }`}
        >
          <button
            onClick={onClose}
            className={`w-full px-4 py-3 rounded-xl font-medium transition-colors ${
              isDark
                ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {translate('cancel', 'Annuler')}
          </button>
        </div>
      </div>
    </div>
  );
}
