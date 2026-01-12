'use client';

import { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import GenerationProgress from './GenerationProgress';

// Animated GIFs available in /public/gifs/loading/
const LOADING_GIFS = [
  '/gifs/loading/giphy.gif',
  '/gifs/loading/giphy (1).gif',
  '/gifs/loading/giphy (2).gif',
  '/gifs/loading/giphy (3).gif',
  '/gifs/loading/giphy (4).gif',
  '/gifs/loading/giphy (5).gif',
  '/gifs/loading/giphy (6).gif',
  '/gifs/loading/giphy (7).gif',
  '/gifs/loading/giphy (8).gif',
  '/gifs/loading/giphy (9).gif',
  '/gifs/loading/giphy (10).gif',
  '/gifs/loading/giphy (11).gif',
  '/gifs/loading/giphy (12).gif',
  '/gifs/loading/giphy (13).gif',
];

// Rotation interval for GIFs (in milliseconds)
const GIF_ROTATION_INTERVAL = 6000;

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
  const [gifIndex, setGifIndex] = useState(() =>
    Math.floor(Math.random() * LOADING_GIFS.length)
  );
  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * LOADING_MESSAGE_KEYS.length)
  );
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');

  // Rotate GIFs
  useEffect(() => {
    const timer = setInterval(() => {
      setGifIndex((prev) => (prev + 1) % LOADING_GIFS.length);
    }, GIF_ROTATION_INTERVAL);

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
      {/* Animated GIF with frame/border like ExtractionLoader */}
      <div className={`relative w-full max-w-sm mx-auto h-48 sm:h-56 rounded-xl overflow-hidden mb-4 ${
        isDark ? 'bg-neutral-800' : 'bg-gray-900'
      }`}>
        {LOADING_GIFS.map((src, index) => (
          <img
            key={src}
            src={src}
            alt="Loading animation"
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
              index === gifIndex ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
      </div>

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
