'use client';

import { useLanguage } from '@/contexts/LanguageContext';

interface MascotProps {
  mood?: 'encouraging' | 'celebrating' | 'thinking' | 'neutral' | 'motivating';
  message?: string;
  context?: 'streak' | 'quiz_start' | 'quiz_complete' | 'perfect_score' | 'new_badge' | 'welcome';
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
}

/**
 * Aristo'Chat Mascot Component
 * A friendly chat mascot that provides context-aware encouragement and feedback
 */
export default function Mascot({
  mood = 'neutral',
  message,
  context,
  size = 'medium',
  animated = true,
}: MascotProps) {
  const { translate } = useLanguage();

  // Get contextual message if none provided
  const getMessage = (): string => {
    if (message) return message;

    switch (context) {
      case 'welcome':
        return translate('mascot_welcome');
      case 'streak':
        return translate('mascot_streak');
      case 'quiz_start':
        return translate('mascot_quiz_start');
      case 'quiz_complete':
        return translate('mascot_quiz_complete');
      case 'perfect_score':
        return translate('mascot_perfect_score');
      case 'new_badge':
        return translate('mascot_new_badge');
      default:
        return translate('mascot_default');
    }
  };

  // Get mascot emoji based on mood
  const getMascotEmoji = (): string => {
    switch (mood) {
      case 'celebrating':
        return '🎉';
      case 'encouraging':
        return '💪';
      case 'thinking':
        return '🤔';
      case 'motivating':
        return '⭐';
      default:
        return '🐱';
    }
  };

  // Size classes
  const sizeClasses = {
    small: 'text-4xl',
    medium: 'text-6xl',
    large: 'text-8xl',
  };

  const containerSizeClasses = {
    small: 'p-3',
    medium: 'p-4',
    large: 'p-6',
  };

  return (
    <div
      className={`inline-flex flex-col items-center gap-3 ${containerSizeClasses[size]}`}
    >
      {/* Mascot Character */}
      <div
        className={`${sizeClasses[size]} ${
          animated ? 'animate-bounce' : ''
        } select-none`}
        role="img"
        aria-label="Aristo'Chat mascot"
      >
        {getMascotEmoji()}
      </div>

      {/* Message Bubble */}
      {getMessage() && (
        <div className="relative">
          {/* Speech bubble tail */}
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-orange-100"></div>

          {/* Message */}
          <div className="bg-orange-100 text-orange-900 rounded-2xl px-4 py-3 shadow-md max-w-xs">
            <p className="text-sm font-medium text-center leading-relaxed">
              {getMessage()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
