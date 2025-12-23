'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Clock,
  Target,
  Check,
  ChevronDown,
  Settings2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { TIME_OPTIONS, DEFAULT_TIME_PER_QUESTION } from '@/types/defi';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

// Limites pour le temps personnalisé
const MIN_CUSTOM_TIME = 5;
const MAX_CUSTOM_TIME = 120;

interface Course {
  id: string;
  title: string;
  chapters: { id: string; title: string }[];
}

export default function CreateChallengePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    searchParams.get('courseId')
  );
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    searchParams.get('chapterId')
  );
  const [timePerQuestion, setTimePerQuestion] = useState(DEFAULT_TIME_PER_QUESTION);
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCourseSelect, setShowCourseSelect] = useState(false);
  const [showChapterSelect, setShowChapterSelect] = useState(false);
  const customTimeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin?redirect=/defi/creer');
      return;
    }

    if (user) {
      fetchCourses();
    }
  }, [user, authLoading, router]);

  const fetchCourses = async () => {
    try {
      const supabase = createSupabaseBrowserClient();

      const { data: coursesData } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          chapters(id, title, order_index)
        `)
        .eq('user_id', user?.id)
        .eq('quiz_status', 'ready')
        .order('created_at', { ascending: false });

      if (coursesData) {
        setCourses(
          coursesData.map((c: any) => ({
            id: c.id,
            title: c.title,
            chapters: (c.chapters || [])
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((ch: any) => ({ id: ch.id, title: ch.title })),
          }))
        );

        // Auto-select course if courseId is in URL
        const courseId = searchParams.get('courseId');
        if (courseId) {
          setSelectedCourseId(courseId);
        }
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const selectedChapter = selectedCourse?.chapters.find(
    (ch) => ch.id === selectedChapterId
  );

  // Vérifier si le temps personnalisé est valide
  const isValidCustomTime = !isCustomTime || (
    customTimeInput !== '' &&
    parseInt(customTimeInput, 10) >= MIN_CUSTOM_TIME &&
    parseInt(customTimeInput, 10) <= MAX_CUSTOM_TIME
  );

  const handleCreate = async () => {
    if (!selectedCourseId && !selectedChapterId) {
      setError('Sélectionne un cours ou un chapitre');
      return;
    }

    if (isCustomTime && !isValidCustomTime) {
      setError(`Le temps doit être entre ${MIN_CUSTOM_TIME} et ${MAX_CUSTOM_TIME} secondes`);
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const finalTimePerQuestion = isCustomTime
        ? parseInt(customTimeInput, 10)
        : timePerQuestion;

      const response = await fetch('/api/defi/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourseId,
          chapterId: selectedChapterId,
          timePerQuestion: finalTimePerQuestion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création du défi');
      }

      router.push(`/defi/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setCreating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/defi"
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'
            }`}
          >
            <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
          </Link>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Créer un défi
            </h1>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Configure ton défi multijoueur
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className={`mb-6 p-4 rounded-xl ${
            isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
          }`}>
            {error}
          </div>
        )}

        {/* Course selection */}
        <div className={`rounded-xl p-6 mb-6 ${
          isDark ? 'bg-gray-800' : 'bg-white shadow-md'
        }`}>
          <h2 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Sélectionner le contenu
          </h2>

          {/* Course dropdown */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Cours
            </label>
            <div className="relative">
              <button
                onClick={() => setShowCourseSelect(!showCourseSelect)}
                className={`w-full p-3 rounded-lg text-left flex items-center justify-between ${
                  isDark
                    ? 'bg-gray-700 text-white border border-gray-600'
                    : 'bg-gray-50 text-gray-900 border border-gray-200'
                }`}
              >
                <span>
                  {selectedCourse?.title || 'Sélectionner un cours'}
                </span>
                <ChevronDown className={`w-5 h-5 transition-transform ${
                  showCourseSelect ? 'rotate-180' : ''
                }`} />
              </button>

              {showCourseSelect && (
                <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto ${
                  isDark ? 'bg-gray-700' : 'bg-white border border-gray-200'
                }`}>
                  {courses.length === 0 ? (
                    <div className={`p-4 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Aucun cours avec quiz disponible
                    </div>
                  ) : (
                    courses.map((course) => (
                      <button
                        key={course.id}
                        onClick={() => {
                          setSelectedCourseId(course.id);
                          setSelectedChapterId(null);
                          setShowCourseSelect(false);
                        }}
                        className={`w-full p-3 text-left flex items-center justify-between ${
                          selectedCourseId === course.id
                            ? isDark
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'bg-orange-50 text-orange-700'
                            : isDark
                              ? 'hover:bg-gray-600 text-white'
                              : 'hover:bg-gray-50 text-gray-900'
                        }`}
                      >
                        <span>{course.title}</span>
                        {selectedCourseId === course.id && (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Chapter dropdown (optional) */}
          {selectedCourse && selectedCourse.chapters.length > 0 && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Chapitre (optionnel)
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowChapterSelect(!showChapterSelect)}
                  className={`w-full p-3 rounded-lg text-left flex items-center justify-between ${
                    isDark
                      ? 'bg-gray-700 text-white border border-gray-600'
                      : 'bg-gray-50 text-gray-900 border border-gray-200'
                  }`}
                >
                  <span>
                    {selectedChapter?.title || 'Tout le cours'}
                  </span>
                  <ChevronDown className={`w-5 h-5 transition-transform ${
                    showChapterSelect ? 'rotate-180' : ''
                  }`} />
                </button>

                {showChapterSelect && (
                  <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto ${
                    isDark ? 'bg-gray-700' : 'bg-white border border-gray-200'
                  }`}>
                    <button
                      onClick={() => {
                        setSelectedChapterId(null);
                        setShowChapterSelect(false);
                      }}
                      className={`w-full p-3 text-left flex items-center justify-between ${
                        !selectedChapterId
                          ? isDark
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-orange-50 text-orange-700'
                          : isDark
                            ? 'hover:bg-gray-600 text-white'
                            : 'hover:bg-gray-50 text-gray-900'
                      }`}
                    >
                      <span>Tout le cours</span>
                      {!selectedChapterId && <Check className="w-4 h-4" />}
                    </button>
                    {selectedCourse.chapters.map((chapter) => (
                      <button
                        key={chapter.id}
                        onClick={() => {
                          setSelectedChapterId(chapter.id);
                          setShowChapterSelect(false);
                        }}
                        className={`w-full p-3 text-left flex items-center justify-between ${
                          selectedChapterId === chapter.id
                            ? isDark
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'bg-orange-50 text-orange-700'
                            : isDark
                              ? 'hover:bg-gray-600 text-white'
                              : 'hover:bg-gray-50 text-gray-900'
                        }`}
                      >
                        <span>{chapter.title}</span>
                        {selectedChapterId === chapter.id && (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Time per question selection */}
        <div className={`rounded-xl p-6 mb-6 ${
          isDark ? 'bg-gray-800' : 'bg-white shadow-md'
        }`}>
          <h2 className={`font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Clock className="w-5 h-5" />
            Temps par question
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TIME_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setTimePerQuestion(option.value);
                  setIsCustomTime(false);
                  setCustomTimeInput('');
                }}
                className={`p-4 rounded-xl text-center transition-all ${
                  !isCustomTime && timePerQuestion === option.value
                    ? 'bg-orange-500/20 border-2 border-orange-500'
                    : isDark
                      ? 'bg-gray-700 hover:bg-gray-600 border-2 border-transparent'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {option.value}s
                </div>
                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {option.description}
                </div>
              </button>
            ))}

            {/* Option "Autre" */}
            <button
              onClick={() => {
                setIsCustomTime(true);
                setTimeout(() => customTimeInputRef.current?.focus(), 100);
              }}
              className={`p-4 rounded-xl text-center transition-all ${
                isCustomTime
                  ? 'bg-orange-500/20 border-2 border-orange-500'
                  : isDark
                    ? 'bg-gray-700 hover:bg-gray-600 border-2 border-transparent'
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <Settings2 className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
              </div>
              <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Autre
              </div>
            </button>
          </div>

          {/* Input personnalisé */}
          {isCustomTime && (
            <div className="mt-4">
              <div className={`p-4 rounded-xl ${
                isDark ? 'bg-gray-700' : 'bg-gray-50'
              }`}>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Temps personnalisé (en secondes)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    ref={customTimeInputRef}
                    type="number"
                    min={MIN_CUSTOM_TIME}
                    max={MAX_CUSTOM_TIME}
                    value={customTimeInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCustomTimeInput(value);
                      const numValue = parseInt(value, 10);
                      if (!isNaN(numValue) && numValue >= MIN_CUSTOM_TIME && numValue <= MAX_CUSTOM_TIME) {
                        setTimePerQuestion(numValue);
                      }
                    }}
                    placeholder={`${MIN_CUSTOM_TIME}-${MAX_CUSTOM_TIME}`}
                    className={`flex-1 p-3 rounded-lg text-lg font-bold text-center ${
                      isDark
                        ? 'bg-gray-800 border border-gray-600 text-white placeholder-gray-500'
                        : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400'
                    } focus:outline-none focus:border-orange-500`}
                  />
                  <span className={`text-lg font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    secondes
                  </span>
                </div>
                <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Entre {MIN_CUSTOM_TIME} et {MAX_CUSTOM_TIME} secondes
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={creating || (!selectedCourseId && !selectedChapterId) || (isCustomTime && !isValidCustomTime)}
          className={`w-full py-4 rounded-xl font-medium text-lg transition-colors flex items-center justify-center gap-2 ${
            creating || (!selectedCourseId && !selectedChapterId) || (isCustomTime && !isValidCustomTime)
              ? 'bg-gray-500 cursor-not-allowed'
              : 'bg-orange-500 hover:bg-orange-600'
          } text-white`}
        >
          {creating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Création en cours...
            </>
          ) : (
            <>
              <Target className="w-5 h-5" />
              Créer le défi
            </>
          )}
        </button>
      </div>
    </div>
  );
}
