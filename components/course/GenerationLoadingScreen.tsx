'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Loader2, StopCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import GenerationProgress from './GenerationProgress';

// After this many seconds with no progress change, show the "stuck" warning
// Only show if progress is stuck AND no new questions are being generated
const STUCK_TIMEOUT_SECONDS = 120; // 2 minutes

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
  /** Number of items generated so far (deprecated for quiz) */
  itemsGenerated?: number;
  /** Total items to generate (deprecated for quiz) */
  totalItems?: number;
  /** Number of chapters with questions ready (for quiz) */
  chaptersReady?: number;
  /** Total number of chapters (for quiz) */
  totalChapters?: number;
  /** Course ID for force-stop functionality */
  courseId?: string;
  /** Callback when generation is force-stopped */
  onForceStop?: () => void;
  /** Raw progress from server (not smoothed) - used for stuck detection */
  rawProgress?: number;
  /** Unique key to force remount of progress component (changes when regeneration starts) */
  progressKey?: string | number;
}

export default function GenerationLoadingScreen({
  type,
  className = '',
  progress,
  progressMessage,
  compact = false,
  itemsGenerated,
  totalItems,
  chaptersReady,
  totalChapters,
  courseId,
  onForceStop,
  rawProgress,
  progressKey,
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

  // Track progress AND questions generated to detect stuck state
  // Use rawProgress (from server) instead of smoothed progress to detect stuck
  const progressToTrack = rawProgress ?? progress;
  const [lastProgress, setLastProgress] = useState(progressToTrack);
  const [lastItemsGenerated, setLastItemsGenerated] = useState(itemsGenerated ?? 0);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [isStuck, setIsStuck] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Detect when RAW progress OR items generated changes
  useEffect(() => {
    const currentItems = itemsGenerated ?? 0;
    const hasProgressChanged = progressToTrack !== lastProgress;
    const hasItemsChanged = currentItems !== lastItemsGenerated;

    if (hasProgressChanged || hasItemsChanged) {
      if (hasProgressChanged) {
        setLastProgress(progressToTrack);
      }
      if (hasItemsChanged) {
        setLastItemsGenerated(currentItems);
      }
      setLastActivityTime(Date.now());
      setIsStuck(false);
    }
  }, [progressToTrack, lastProgress, itemsGenerated, lastItemsGenerated]);

  // Check if generation is stuck (no activity for STUCK_TIMEOUT_SECONDS)
  useEffect(() => {
    const checkStuck = () => {
      const secondsSinceLastActivity = (Date.now() - lastActivityTime) / 1000;
      if (secondsSinceLastActivity >= STUCK_TIMEOUT_SECONDS && !isStuck) {
        console.log(`[GenerationLoadingScreen] Generation appears stuck - no activity for ${STUCK_TIMEOUT_SECONDS}s`);
        setIsStuck(true);
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkStuck, 30000);

    return () => clearInterval(interval);
  }, [lastActivityTime, isStuck]);

  // Force stop handler
  const handleForceStop = useCallback(async () => {
    if (!courseId || isStopping) return;

    setIsStopping(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/quiz/force-stop`, {
        method: 'POST',
      });

      if (response.ok) {
        onForceStop?.();
      } else {
        console.error('Failed to force stop generation');
      }
    } catch (error) {
      console.error('Error force stopping generation:', error);
    } finally {
      setIsStopping(false);
    }
  }, [courseId, isStopping, onForceStop]);

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

      {/* Generation progress - now uses chaptersReady/totalChapters for deterministic progress */}
      {type !== 'extraction' && (
        <div className="w-full max-w-sm mx-auto mb-4">
          <GenerationProgress
            key={progressKey}
            type={type as 'quiz' | 'flashcards' | 'note'}
            message={progressMessage}
            itemsGenerated={itemsGenerated}
            totalItems={totalItems}
            chaptersReady={chaptersReady}
            totalChapters={totalChapters}
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

      {/* Stuck warning with force stop button */}
      {isStuck && courseId && type === 'quiz' && (
        <div className={`mt-4 p-4 rounded-xl ${
          isDark ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-50 border border-orange-100'
        }`}>
          <p className={`text-sm mb-3 ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
            {translate('quiz_generation_stuck') || 'La génération semble bloquée. Vous pouvez l\'arrêter et utiliser les questions déjà générées.'}
          </p>
          <button
            onClick={handleForceStop}
            disabled={isStopping}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDark
                ? 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/30'
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
            } disabled:opacity-50`}
          >
            {isStopping ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {translate('stopping') || 'Arrêt en cours...'}
              </>
            ) : (
              <>
                <StopCircle className="w-4 h-4" />
                {translate('quiz_force_stop') || 'Arrêter la génération'}
              </>
            )}
          </button>
        </div>
      )}
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
