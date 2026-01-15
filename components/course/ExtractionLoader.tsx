'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// Ordre des stages pour calculer les limites de progression
const stageOrder = ['queued', 'start', 'download', 'extraction', 'language_detection', 'structuring', 'insertion', 'done'];

// Mapping des stages vers les pourcentages cibles
const stageToProgress: Record<string, number> = {
  'queued': 0,
  'start': 5,
  'download': 10,
  'extraction': 35,
  'language_detection': 55,
  'structuring': 75,
  'insertion': 90,
  'done': 100
};

// Stage to translation key mapping
const stageTranslationKeys: Record<string, string> = {
  'queued': 'extraction_stage_queued',
  'start': 'extraction_stage_start',
  'download': 'extraction_stage_download',
  'extraction': 'extraction_stage_extraction',
  'language_detection': 'extraction_stage_language',
  'structuring': 'extraction_stage_structuring',
  'insertion': 'extraction_stage_insertion',
  'done': 'extraction_stage_done'
};

// Obtenir la limite max pour un stage (= début du stage suivant - 1)
function getMaxProgressForStage(stage: string): number {
  const currentIndex = stageOrder.indexOf(stage);
  if (currentIndex === -1 || currentIndex >= stageOrder.length - 1) {
    return 100;
  }
  const nextStage = stageOrder[currentIndex + 1];
  // On peut aller jusqu'à 1% avant le prochain stage
  return (stageToProgress[nextStage] ?? 100) - 1;
}

// GIF files disponibles
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

interface ExtractionLoaderProps {
  courseId: string | null;
  onComplete: () => void;
  /** File name to display during upload phase */
  fileName?: string;
  /** Whether we're still uploading (before extraction starts) */
  isUploading?: boolean;
  /** Cancel callback for upload phase */
  onCancel?: () => void;
}

export default function ExtractionLoader({ courseId, onComplete, fileName, isUploading = false, onCancel }: ExtractionLoaderProps) {
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const [displayProgress, setDisplayProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('queued');
  const [courseTitle, setCourseTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const [notFoundCount, setNotFoundCount] = useState(0);
  const MAX_FAILURES = 15;
  const MAX_NOT_FOUND_RETRIES = 10;

  // Refs pour la progression fluide
  const targetProgressRef = useRef(0);
  const maxProgressRef = useRef(4); // Max pour le stage actuel (queued -> start à 5%)
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef(Date.now());
  const uploadProgressRef = useRef(0); // Track progress during upload phase
  const wasUploadingRef = useRef(isUploading); // Track previous isUploading state

  // Ref stable pour onComplete afin d'éviter les re-renders du useEffect
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Ref pour tracker si onComplete a déjà été appelé
  const hasCompletedRef = useRef(false);

  // Debug: Log courseId on mount
  useEffect(() => {
    console.log(`[ExtractionLoader] Mounted with courseId: ${courseId}`);
  }, [courseId]);

  // Sélection aléatoire du GIF au mount
  const selectedGif = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * LOADING_GIFS.length);
    return LOADING_GIFS[randomIndex];
  }, []);

  const stageMessage = translate(stageTranslationKeys[currentStage] || 'extraction_stage_extraction');

  // Detect transition from upload to extraction phase - preserve progress
  useEffect(() => {
    if (wasUploadingRef.current && !isUploading) {
      // Transition from upload to extraction: ensure progress doesn't drop
      const savedProgress = uploadProgressRef.current;
      if (savedProgress > 0) {
        // Set minimum target to saved progress so we never go below it
        targetProgressRef.current = Math.max(targetProgressRef.current, savedProgress);
      }
    }
    wasUploadingRef.current = isUploading;
  }, [isUploading]);

  // Animation fluide de la progression
  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const elapsed = now - lastUpdateTimeRef.current;
      lastUpdateTimeRef.current = now;

      setDisplayProgress(current => {
        // During upload phase, store progress for transition
        if (isUploading) {
          uploadProgressRef.current = current;
        }

        // IMPORTANT: Never allow progress to decrease
        const target = Math.max(targetProgressRef.current, current);
        const maxAllowed = Math.max(maxProgressRef.current, current);

        // Si on est en dessous de la cible du stage actuel, rattraper rapidement
        if (current < target) {
          const diff = target - current;
          const speed = Math.max(1, diff * 0.15); // Rattrapage rapide
          const increment = speed * (elapsed / 16);
          return Math.min(current + increment, target);
        }

        // Si on a atteint la cible, continuer à progresser lentement
        // jusqu'à la limite max du stage (prochain stage - 1%)
        // Système dégressif : plus on se rapproche du max, plus on ralentit
        if (current < maxAllowed) {
          // Calculer la distance restante jusqu'au max (en %)
          const remaining = maxAllowed - current;
          const range = maxAllowed - target; // Plage totale de progression lente

          // Ratio de progression (1 = début, 0 = proche du max)
          const progressRatio = range > 0 ? remaining / range : 0;

          // Vitesse dégressive : de 0.5%/s au début à 0.05%/s proche du max
          // Formule: vitesse = baseSpeed * (0.1 + 0.9 * ratio²)
          // Cela donne une courbe qui ralentit de plus en plus
          const baseSpeed = 0.5; // 1% toutes les 2 secondes au maximum
          const minSpeedFactor = 0.1; // 10% de la vitesse de base au minimum
          const speedFactor = minSpeedFactor + (1 - minSpeedFactor) * (progressRatio * progressRatio);
          const speed = baseSpeed * speedFactor;

          const slowIncrement = (elapsed / 1000) * speed;
          return Math.min(current + slowIncrement, maxAllowed);
        }

        // On a atteint le max du stage, on attend le prochain stage
        return current;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isUploading]);

  // Polling du status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/courses/${courseId}/status`);

      if (!response.ok) {
        // Handle 404 separately - course might not exist yet in database
        if (response.status === 404) {
          console.warn(`[ExtractionLoader] Course ${courseId} not found yet (404), will retry...`);
          return 'not_found';
        }
        console.warn(`[ExtractionLoader] Status API returned ${response.status}`);
        return 'error';
      }

      const data = await response.json();

      // DEBUG - Afficher la réponse complète
      console.log('=== STATUS DEBUG ===');
      console.log('Full Response:', data);
      console.log('Course status:', data.course?.status);
      console.log('Job object:', data.job);
      console.log('Job stage:', data.job?.stage);
      console.log('====================');

      // Vérifier les erreurs
      if (data.job?.status === 'failed' || data.course?.status === 'failed') {
        // Utiliser une clé de traduction générique au lieu du message brut du backend
        console.error('[ExtractionLoader] Job failed:', data.job?.error_message || data.course?.error_message);
        setError('extraction_error_failed');
        return 'complete';
      }

      // Mettre à jour le titre
      if (data.course?.title) {
        setCourseTitle(data.course.title);
      }

      // Mettre à jour le stage et la progression cible
      const stage = data.job?.stage || 'queued';
      const newTargetProgress = stageToProgress[stage] ?? 0;
      const newMaxProgress = getMaxProgressForStage(stage);

      console.log(`[ExtractionLoader] Stage: ${stage}, Target: ${newTargetProgress}%, Max: ${newMaxProgress}%`);

      setCurrentStage(stage);
      // Never go below the progress achieved during upload phase
      const minProgress = uploadProgressRef.current;
      targetProgressRef.current = Math.max(newTargetProgress, minProgress);
      maxProgressRef.current = Math.max(newMaxProgress, minProgress);

      // Vérifier si terminé
      if (stage === 'done' || data.course?.status === 'ready') {
        targetProgressRef.current = 100;
        maxProgressRef.current = 100;
        setCurrentStage('done');
        return 'complete';
      }

      return 'continue';
    } catch (err) {
      console.error('[ExtractionLoader] Fetch error:', err);
      return 'error';
    }
  }, [courseId]);

  // Effect de polling - only when we have a courseId (not during upload)
  useEffect(() => {
    // Don't poll if we're still uploading or don't have a courseId
    if (isUploading || !courseId) {
      return;
    }

    let intervalId: NodeJS.Timeout;
    let isMounted = true;
    let currentFailures = 0;
    let currentNotFound = 0;

    const poll = async () => {
      const result = await fetchStatus();

      if (!isMounted) return;

      // Handle 404 (course not found yet) - this can happen right after redirect
      // before the database transaction is fully committed
      if (result === 'not_found') {
        currentNotFound++;
        setNotFoundCount(currentNotFound);
        console.log(`[ExtractionLoader] Not found retry ${currentNotFound}/${MAX_NOT_FOUND_RETRIES}`);

        if (currentNotFound >= MAX_NOT_FOUND_RETRIES) {
          setError('extraction_error_not_found');
          clearInterval(intervalId);
        }
        return;
      }

      // Handle other errors
      if (result === 'error') {
        currentFailures++;
        setFailureCount(currentFailures);

        if (currentFailures >= MAX_FAILURES) {
          setError('extraction_error_connection');
          clearInterval(intervalId);
        }
        return;
      }

      // Reset on success
      currentFailures = 0;
      currentNotFound = 0;
      setFailureCount(0);
      setNotFoundCount(0);

      if (result === 'complete' && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        setIsCompleting(true);
        clearInterval(intervalId);
        console.log('[ExtractionLoader] Extraction complete, calling onComplete in 500ms...');
        // Attendre 500ms avant d'appeler onComplete via la ref stable
        setTimeout(() => {
          console.log('[ExtractionLoader] Calling onComplete now');
          onCompleteRef.current();
        }, 500);
      }
    };

    // Fetch initial avec un petit délai pour laisser la DB se synchroniser
    const initialDelay = setTimeout(() => {
      if (isMounted) {
        poll();
        // Polling toutes les 2 secondes
        intervalId = setInterval(poll, 2000);
      }
    }, 500); // 500ms delay before first poll

    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
      clearInterval(intervalId);
    };
  }, [fetchStatus, isUploading, courseId]);

  // État d'erreur
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className={`rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden ${
          isDark ? 'bg-neutral-900' : 'bg-white'
        }`}>
          <div className="p-6 flex flex-col items-center text-center">
            <div className={`rounded-full p-3 mb-3 ${
              isDark ? 'bg-red-900/30' : 'bg-red-100'
            }`}>
              <AlertCircle className={`w-8 h-8 ${
                isDark ? 'text-red-400' : 'text-red-500'
              }`} />
            </div>
            <h2 className={`text-lg font-semibold mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {translate('extraction_error_title')}
            </h2>
            <p className={`text-sm mb-5 ${
              isDark ? 'text-neutral-400' : 'text-gray-600'
            }`}>
              {translate(error)}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {translate('extraction_refresh_page')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Modal principale
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md overflow-hidden ${
        isDark ? 'bg-neutral-900' : 'bg-white'
      }`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${
          isDark ? 'border-neutral-800' : 'border-gray-100'
        }`}>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <span className={`font-medium text-sm ${
              isDark ? 'text-neutral-200' : 'text-gray-700'
            }`}>
              {isUploading ? translate('global_drop_processing', 'Envoi du fichier...') : translate('extraction_importing')}
            </span>
          </div>
        </div>

        {/* Contenu */}
        <div className="p-4">
          {/* Container du GIF - taille réduite */}
          <div className={`relative w-full h-32 sm:h-40 rounded-xl overflow-hidden ${
            isDark ? 'bg-neutral-800' : 'bg-gray-900'
          }`}>
            <img
              src={selectedGif}
              alt={translate('extraction_loading_alt')}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Barre de progression */}
          <div className="mt-3">
            <div className={`w-full h-1.5 rounded-full overflow-hidden ${
              isDark ? 'bg-neutral-800' : 'bg-gray-200'
            }`}>
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-none"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            <p className={`text-right text-xs mt-1 ${
              isDark ? 'text-neutral-500' : 'text-gray-400'
            }`}>
              {Math.round(displayProgress)}%
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-4 py-3 border-t ${
          isDark ? 'border-neutral-800 bg-neutral-800/50' : 'border-gray-100 bg-gray-50'
        }`}>
          <div className="min-w-0 flex-1">
            <p className={`font-medium text-sm truncate ${
              isDark ? 'text-neutral-100' : 'text-gray-900'
            }`}>
              {isUploading && fileName ? fileName : (courseTitle || translate('extraction_loading'))}
            </p>
            <p className={`text-xs ${
              isDark ? 'text-neutral-500' : 'text-gray-500'
            }`}>
              {isUploading ? translate('global_drop_uploading', 'Envoi en cours...') : stageMessage}
            </p>
          </div>
          {isUploading && onCancel && (
            <button
              onClick={onCancel}
              className={`ml-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isDark
                  ? 'text-neutral-400 hover:text-white hover:bg-neutral-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              }`}
            >
              {translate('global_drop_cancel', 'Annuler')}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
