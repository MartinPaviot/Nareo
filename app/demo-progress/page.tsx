'use client';

import { useState, useEffect } from 'react';
import GenerationProgress from '@/components/course/GenerationProgress';
import { useTheme } from '@/contexts/ThemeContext';

export default function DemoProgressPage() {
  const { isDark } = useTheme();
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [itemsGenerated, setItemsGenerated] = useState(0);

  const messages = [
    'Analyse du contenu...',
    'Génération des questions...',
    'Création des flashcards...',
    'Finalisation...',
  ];

  // Simulate progress
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + 2;
        if (newProgress >= 100) {
          // Reset after reaching 100%
          setTimeout(() => {
            setProgress(0);
            setStep(0);
            setItemsGenerated(0);
          }, 2000);
          return 100;
        }
        return newProgress;
      });

      // Update step based on progress
      setStep(prev => {
        if (progress < 25) return 0;
        if (progress < 50) return 1;
        if (progress < 75) return 2;
        return 3;
      });

      // Simulate items being generated
      setItemsGenerated(prev => Math.min(prev + 1, 20));
    }, 500);

    return () => clearInterval(interval);
  }, [isRunning, progress]);

  return (
    <div className={`min-h-screen p-8 ${isDark ? 'bg-neutral-950' : 'bg-gray-50'}`}>
      <div className="max-w-2xl mx-auto space-y-12">
        <h1 className={`text-3xl font-bold ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
          Demo - Indicateur de progression
        </h1>

        {/* Controls */}
        <div className="flex gap-4">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            {isRunning ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={() => {
              setProgress(0);
              setStep(0);
              setItemsGenerated(0);
            }}
            className="px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700"
          >
            Reset
          </button>
        </div>

        {/* Quiz Progress - Full */}
        <div className={`p-6 rounded-2xl ${isDark ? 'bg-neutral-900' : 'bg-white'} shadow-lg`}>
          <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>
            Quiz Generation (Full)
          </h2>
          <GenerationProgress
            type="quiz"
            progress={progress}
            message={messages[step]}
            itemsGenerated={itemsGenerated}
            totalItems={20}
          />
        </div>

        {/* Quiz Progress - Compact */}
        <div className={`p-6 rounded-2xl ${isDark ? 'bg-neutral-900' : 'bg-white'} shadow-lg`}>
          <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>
            Quiz Generation (Compact)
          </h2>
          <GenerationProgress
            type="quiz"
            progress={progress}
            message={messages[step]}
            itemsGenerated={itemsGenerated}
            totalItems={20}
            compact
          />
        </div>

        {/* Flashcards Progress */}
        <div className={`p-6 rounded-2xl ${isDark ? 'bg-neutral-900' : 'bg-white'} shadow-lg`}>
          <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>
            Flashcards Generation (Compact)
          </h2>
          <GenerationProgress
            type="flashcards"
            progress={progress}
            message={messages[step]}
            itemsGenerated={itemsGenerated}
            totalItems={30}
            compact
          />
        </div>

        {/* Note Progress */}
        <div className={`p-6 rounded-2xl ${isDark ? 'bg-neutral-900' : 'bg-white'} shadow-lg`}>
          <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>
            Revision Sheet Generation (Full)
          </h2>
          <GenerationProgress
            type="note"
            progress={progress}
            message={messages[step]}
            chapterIndex={Math.floor(progress / 25) + 1}
            totalChapters={4}
            chapterTitle="Les bases de la thermodynamique"
          />
        </div>
      </div>
    </div>
  );
}
