'use client';

import { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import GenerationProgress from './GenerationProgress';

// Mascot images available in /public/chat/
const MASCOT_IMAGES = [
  '/chat/mascotte.png',
  '/chat/Happy.png',
  '/chat/Processing.png',
  '/chat/Drag_and_Drop.png',
];

// Rotation interval for mascot images (in milliseconds)
const MASCOT_ROTATION_INTERVAL = 5000;

// Rotation interval for messages (in milliseconds)
const MESSAGE_ROTATION_INTERVAL = 8000;

// Translation keys for loading messages
const LOADING_MESSAGE_KEYS = [
  'course_loading_message_1',
  'course_loading_message_2',
  'course_loading_message_3',
  'course_loading_message_4',
  'course_loading_message_5',
  'course_loading_message_6',
  'course_loading_message_7',
  'course_loading_message_8',
  'course_loading_message_9',
  'course_loading_message_10',
];

export type GenerationType = 'extraction' | 'quiz' | 'note' | 'flashcards';

interface GenerationLoadingScreenProps {
  type: GenerationType;
  className?: string;
  /** Optional progress percentage (0-100) */
  progress?: number;
  /** Optional custom message to display instead of generic one */
  progressMessage?: string;
  /** Show as a compact inline version (no card wrapper) */
  compact?: boolean;
  /** Number of items generated so far */
  itemsGenerated?: number;
  /** Total items to generate (if known) */
  totalItems?: number;
}

export default function GenerationLoadingScreen({
  type,
  className = '',
  progress,
  progressMessage,
  compact = false,
  itemsGenerated,
  totalItems,
}: GenerationLoadingScreenProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();

  // Random starting index for variety
  const [mascotIndex, setMascotIndex] = useState(() =>
    Math.floor(Math.random() * MASCOT_IMAGES.length)
  );
  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * LOADING_MESSAGE_KEYS.length)
  );
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');

  // Rotate mascot images
  useEffect(() => {
    const timer = setInterval(() => {
      setMascotIndex((prev) => (prev + 1) % MASCOT_IMAGES.length);
    }, MASCOT_ROTATION_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  // Rotate messages with fade effect
  useEffect(() => {
    const timer = setInterval(() => {
      // Fade out
      setFadeState('out');

      // Change message after fade out
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGE_KEYS.length);
        setFadeState('in');
      }, 300);
    }, MESSAGE_ROTATION_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  // Get title and description based on type
  const { title, description, timeEstimate } = useMemo(() => {
    switch (type) {
      case 'extraction':
        return {
          title: translate('extraction_loading_title') || 'Extraction du cours en cours...',
          description: translate('extraction_loading_description') || 'Une fois terminée, vous pourrez générer votre fiche de révision, quiz et flashcards.',
          timeEstimate: translate('extraction_time_estimate') || 'Environ 1 à 2 minutes',
        };
      case 'quiz':
        return {
          title: translate('quiz_generating_title') || 'Génération du quiz...',
          description: translate('quiz_generating_description_full') || 'Nous créons des questions personnalisées basées sur votre cours.',
          timeEstimate: translate('generation_time_estimate') || 'Environ 2 à 3 minutes',
        };
      case 'note':
        return {
          title: translate('note_generating_title') || 'Génération de la fiche de révision...',
          description: translate('note_generating_description_full') || 'Nous structurons votre cours en une fiche de révision optimisée.',
          timeEstimate: translate('generation_time_estimate') || 'Environ 2 à 3 minutes',
        };
      case 'flashcards':
        return {
          title: translate('flashcards_generating_title') || 'Génération des flashcards...',
          description: translate('flashcards_generating_description_full') || 'Nous créons des cartes mémo pour réviser efficacement.',
          timeEstimate: translate('generation_time_estimate') || 'Environ 2 à 3 minutes',
        };
      default:
        return {
          title: translate('loading') || 'Chargement...',
          description: '',
          timeEstimate: '',
        };
    }
  }, [type, translate]);

  const content = (
    <>
      {/* Mascot with rotation */}
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-4">
        {MASCOT_IMAGES.map((src, index) => (
          <img
            key={src}
            src={src}
            alt="Nareo"
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
              index === mascotIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              animation: index === mascotIndex ? 'gentle-bounce 2s ease-in-out infinite' : 'none'
            }}
          />
        ))}
      </div>

      {/* Title */}
      <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
        {title}
      </h3>

      {/* Description */}
      <p className={`text-sm mb-3 max-w-md mx-auto ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
        {description}
      </p>

      {/* Generation progress with Claude-like animation */}
      {type !== 'extraction' && (
        <div className="w-full max-w-sm mx-auto mb-4">
          <GenerationProgress
            type={type as 'quiz' | 'flashcards' | 'note'}
            progress={progress || 0}
            message={progressMessage}
            itemsGenerated={itemsGenerated}
            totalItems={totalItems}
          />
        </div>
      )}

      {/* Time estimate badge */}
      {timeEstimate && (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium mb-4 ${
          isDark ? 'bg-orange-500/15 text-orange-300' : 'bg-orange-100 text-orange-700'
        }`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {timeEstimate}
        </div>
      )}

      {/* Rotating quote */}
      <div className={`mt-4 px-4 py-3 rounded-xl ${
        isDark ? 'bg-neutral-800/50' : 'bg-gray-50'
      }`}>
        <p className={`text-sm italic transition-opacity duration-300 ${
          fadeState === 'in' ? 'opacity-100' : 'opacity-0'
        } ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
          "{translate(LOADING_MESSAGE_KEYS[messageIndex])}"
        </p>
      </div>

      {/* Subtle animated dots */}
      <div className="flex justify-center gap-1 mt-4">
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-orange-400' : 'bg-orange-500'}`} style={{ animationDelay: '0ms' }} />
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-orange-400' : 'bg-orange-500'}`} style={{ animationDelay: '200ms' }} />
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-orange-400' : 'bg-orange-500'}`} style={{ animationDelay: '400ms' }} />
      </div>

      <style jsx>{`
        @keyframes gentle-bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
      `}</style>
    </>
  );

  if (compact) {
    return <div className={`text-center ${className}`}>{content}</div>;
  }

  return (
    <div className={`rounded-2xl border shadow-sm p-6 sm:p-8 text-center transition-colors ${
      isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
    } ${className}`}>
      {content}
    </div>
  );
}
