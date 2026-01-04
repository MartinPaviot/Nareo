'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  X,
  Loader2,
  Clock,
  Target,
  Check,
  ChevronDown,
  Settings2,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { TIME_OPTIONS, DEFAULT_TIME_PER_QUESTION } from '@/types/defi';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

const MIN_CUSTOM_TIME = 5;
const MAX_CUSTOM_TIME = 120;

interface Course {
  id: string;
  title: string;
  quiz_status: string | null;
  chapters: { id: string; title: string }[];
}

interface CreateChallengeModalProps {
  onClose: () => void;
  preselectedCourseId?: string;
  preselectedChapterId?: string;
}

export default function CreateChallengeModal({
  onClose,
  preselectedCourseId,
  preselectedChapterId,
}: CreateChallengeModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    preselectedCourseId || null
  );
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    preselectedChapterId || null
  );
  const [timePerQuestion, setTimePerQuestion] = useState(DEFAULT_TIME_PER_QUESTION);
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCourseSelect, setShowCourseSelect] = useState(false);
  const [showChapterSelect, setShowChapterSelect] = useState(false);
  const customTimeInputRef = useRef<HTMLInputElement>(null);
  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const chapterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchCourses();
    }
  }, [user]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(event.target as Node)) {
        setShowCourseSelect(false);
      }
      if (chapterDropdownRef.current && !chapterDropdownRef.current.contains(event.target as Node)) {
        setShowChapterSelect(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCourses = async () => {
    try {
      // Use API route to fetch courses (avoids RLS issues on client)
      const response = await fetch('/api/defi/courses');

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error fetching courses:', errorData);
        setLoading(false);
        return;
      }

      const coursesData = await response.json();
      console.log('[CreateChallengeModal] Fetched courses:', coursesData);
      console.log('[CreateChallengeModal] preselectedCourseId:', preselectedCourseId);

      if (coursesData && Array.isArray(coursesData)) {
        const mappedCourses = coursesData.map((c: any) => ({
          id: c.id,
          title: c.title,
          quiz_status: c.quiz_status,
          chapters: (c.chapters || [])
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((ch: any) => ({ id: ch.id, title: ch.title })),
        }));
        setCourses(mappedCourses);

        // Auto-select preselected course if it exists in the list
        if (preselectedCourseId) {
          const found = mappedCourses.find((c: Course) => c.id === preselectedCourseId);
          console.log('[CreateChallengeModal] Preselected course found:', found);
          if (found) {
            setSelectedCourseId(preselectedCourseId);
          }
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

  const isValidCustomTime = !isCustomTime || (
    customTimeInput !== '' &&
    parseInt(customTimeInput, 10) >= MIN_CUSTOM_TIME &&
    parseInt(customTimeInput, 10) <= MAX_CUSTOM_TIME
  );

  // Check if quiz needs to be generated
  const needsQuizGeneration = selectedCourse &&
    !['ready', 'partial'].includes(selectedCourse.quiz_status || '');

  const generateQuizForCourse = async (courseId: string): Promise<boolean> => {
    setGeneratingQuiz(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { niveau: 'intermediaire' } }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la génération du quiz');
      }

      // For SSE stream, we need to consume it
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }

      return true;
    } catch (err) {
      console.error('Quiz generation error:', err);
      throw err;
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const handleCreate = async () => {
    console.log('[CreateChallengeModal] handleCreate called', {
      selectedCourseId,
      selectedChapterId,
      timePerQuestion,
      isCustomTime,
      customTimeInput,
    });

    if (!selectedCourseId && !selectedChapterId) {
      setError(translate('challenge_select_content', 'Sélectionne un cours ou un chapitre'));
      return;
    }

    if (isCustomTime && !isValidCustomTime) {
      setError(`Le temps doit être entre ${MIN_CUSTOM_TIME} et ${MAX_CUSTOM_TIME} secondes`);
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // If quiz needs to be generated, do it first
      if (needsQuizGeneration && selectedCourseId) {
        console.log('[CreateChallengeModal] Generating quiz first...');
        await generateQuizForCourse(selectedCourseId);
      }

      const finalTimePerQuestion = isCustomTime
        ? parseInt(customTimeInput, 10)
        : timePerQuestion;

      console.log('[CreateChallengeModal] Creating challenge with:', {
        courseId: selectedCourseId,
        chapterId: selectedChapterId,
        timePerQuestion: finalTimePerQuestion,
      });

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
      console.log('[CreateChallengeModal] API response:', { status: response.status, data });

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création du défi');
      }

      console.log('[CreateChallengeModal] Redirecting to:', `/defi/${data.code}`);
      router.push(`/defi/${data.code}`);
      onClose();
    } catch (err) {
      console.error('[CreateChallengeModal] Error:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setCreating(false);
    }
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl ${
          isDark ? 'bg-neutral-900' : 'bg-white'
        }`}
      >
        {/* Header */}
        <div
          className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {translate('challenge_create', 'Créer un défi')}
              </h2>
              <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {translate('challenge_invite_friends', 'Invite tes amis')}
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
        <div className="p-6 space-y-6">
          {/* Error */}
          {error && (
            <div
              className="p-4 rounded-xl flex items-center gap-3"
              style={{
                backgroundColor: isDark ? 'rgba(217, 26, 28, 0.15)' : '#fff6f3',
                color: isDark ? '#f87171' : '#d91a1c'
              }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : courses.length === 0 ? (
            /* No courses available */
            <div
              className={`p-6 rounded-xl text-center ${
                isDark ? 'bg-neutral-800' : 'bg-gray-50'
              }`}
            >
              <BookOpen
                className={`w-12 h-12 mx-auto mb-4 ${
                  isDark ? 'text-neutral-600' : 'text-gray-300'
                }`}
              />
              <h3
                className={`font-semibold mb-2 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {translate('dashboard_no_courses_title', 'Aucun cours disponible')}
              </h3>
              <p
                className={`text-sm mb-4 ${
                  isDark ? 'text-neutral-400' : 'text-gray-500'
                }`}
              >
                {translate(
                  'challenge_no_quiz_courses',
                  'Génère d\'abord un quiz sur l\'un de tes cours pour créer un défi.'
                )}
              </p>
              <Link
                href="/dashboard"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                {translate('go_to_dashboard', 'Aller au tableau de bord')}
              </Link>
            </div>
          ) : (
            <>
              {/* Course selection */}
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-neutral-300' : 'text-gray-700'
                  }`}
                >
                  {translate('course', 'Cours')}
                </label>
                <div className="relative" ref={courseDropdownRef}>
                  <button
                    onClick={() => {
                      setShowCourseSelect(!showCourseSelect);
                      setShowChapterSelect(false);
                    }}
                    className={`w-full p-3 rounded-xl text-left flex items-center justify-between transition-colors ${
                      isDark
                        ? 'bg-neutral-800 text-white border border-neutral-700 hover:border-neutral-600'
                        : 'bg-gray-50 text-gray-900 border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className={!selectedCourse ? (isDark ? 'text-neutral-500' : 'text-gray-400') : ''}>
                      {selectedCourse?.title || translate('select_course', 'Sélectionner un cours')}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${
                        showCourseSelect ? 'rotate-180' : ''
                      } ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}
                    />
                  </button>

                  {showCourseSelect && (
                    <div
                      className={`absolute z-20 w-full mt-2 rounded-xl shadow-lg max-h-60 overflow-auto ${
                        isDark ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-gray-200'
                      }`}
                    >
                      {courses.map((course) => {
                        const hasQuiz = ['ready', 'partial'].includes(course.quiz_status || '');
                        return (
                          <button
                            key={course.id}
                            onClick={() => {
                              setSelectedCourseId(course.id);
                              setSelectedChapterId(null);
                              setShowCourseSelect(false);
                            }}
                            className={`w-full p-3 text-left flex items-center justify-between transition-colors ${
                              selectedCourseId === course.id
                                ? isDark
                                  ? 'bg-orange-500/20 text-orange-400'
                                  : 'bg-orange-50 text-orange-600'
                                : isDark
                                  ? 'hover:bg-neutral-700 text-white'
                                  : 'hover:bg-gray-50 text-gray-900'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="truncate">{course.title}</span>
                              {!hasQuiz && (
                                <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded ${
                                  isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'
                                }`}>
                                  {translate('quiz_to_generate', 'Quiz à générer')}
                                </span>
                              )}
                            </div>
                            {selectedCourseId === course.id && (
                              <Check className="w-4 h-4 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Chapter selection (optional) */}
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-neutral-300' : 'text-gray-700'
                  }`}
                >
                  {translate('chapter', 'Chapitre')} ({translate('optional', 'optionnel')})
                </label>
                <div className="relative" ref={chapterDropdownRef}>
                  <button
                    onClick={() => {
                      if (selectedCourse && selectedCourse.chapters.length > 0) {
                        setShowChapterSelect(!showChapterSelect);
                        setShowCourseSelect(false);
                      }
                    }}
                    disabled={!selectedCourse || selectedCourse.chapters.length === 0}
                    className={`w-full p-3 rounded-xl text-left flex items-center justify-between transition-colors ${
                      !selectedCourse || selectedCourse.chapters.length === 0
                        ? isDark
                          ? 'bg-neutral-800/50 text-neutral-500 border border-neutral-700 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                        : isDark
                          ? 'bg-neutral-800 text-white border border-neutral-700 hover:border-neutral-600'
                          : 'bg-gray-50 text-gray-900 border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span>
                      {!selectedCourse
                        ? translate('select_course_first', 'Sélectionne un cours')
                        : selectedChapter?.title || translate('all_course', 'Tout le cours')
                      }
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${
                        showChapterSelect ? 'rotate-180' : ''
                      } ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}
                    />
                  </button>

                  {showChapterSelect && selectedCourse && selectedCourse.chapters.length > 0 && (
                    <div
                      className={`absolute z-20 w-full mt-2 rounded-xl shadow-lg max-h-60 overflow-auto ${
                        isDark ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-gray-200'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedChapterId(null);
                          setShowChapterSelect(false);
                        }}
                        className={`w-full p-3 text-left flex items-center justify-between transition-colors ${
                          !selectedChapterId
                            ? isDark
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'bg-orange-50 text-orange-600'
                            : isDark
                              ? 'hover:bg-neutral-700 text-white'
                              : 'hover:bg-gray-50 text-gray-900'
                        }`}
                      >
                        <span>{translate('all_course', 'Tout le cours')}</span>
                        {!selectedChapterId && <Check className="w-4 h-4" />}
                      </button>
                      {selectedCourse.chapters.map((chapter) => (
                        <button
                          key={chapter.id}
                          onClick={() => {
                            setSelectedChapterId(chapter.id);
                            setShowChapterSelect(false);
                          }}
                          className={`w-full p-3 text-left flex items-center justify-between transition-colors ${
                            selectedChapterId === chapter.id
                              ? isDark
                                ? 'bg-orange-500/20 text-orange-400'
                                : 'bg-orange-50 text-orange-600'
                              : isDark
                                ? 'hover:bg-neutral-700 text-white'
                                : 'hover:bg-gray-50 text-gray-900'
                          }`}
                        >
                          <span className="truncate">{chapter.title}</span>
                          {selectedChapterId === chapter.id && (
                            <Check className="w-4 h-4 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Time per question */}
              <div>
                <label
                  className={`flex items-center gap-2 text-sm font-medium mb-3 ${
                    isDark ? 'text-neutral-300' : 'text-gray-700'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  {translate('time_per_question', 'Temps par question')}
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {TIME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setTimePerQuestion(option.value);
                        setIsCustomTime(false);
                        setCustomTimeInput('');
                      }}
                      className={`p-3 rounded-xl text-center transition-all ${
                        !isCustomTime && timePerQuestion === option.value
                          ? 'bg-orange-500/20 border-2 border-orange-500'
                          : isDark
                            ? 'bg-neutral-800 hover:bg-neutral-700 border-2 border-transparent'
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <div
                        className={`text-lg font-bold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {option.value}s
                      </div>
                      <div
                        className={`text-xs ${
                          isDark ? 'text-neutral-400' : 'text-gray-500'
                        }`}
                      >
                        {option.description}
                      </div>
                    </button>
                  ))}

                  {/* Custom time option */}
                  <button
                    onClick={() => {
                      setIsCustomTime(true);
                      setTimeout(() => customTimeInputRef.current?.focus(), 100);
                    }}
                    className={`p-3 rounded-xl text-center transition-all ${
                      isCustomTime
                        ? 'bg-orange-500/20 border-2 border-orange-500'
                        : isDark
                          ? 'bg-neutral-800 hover:bg-neutral-700 border-2 border-transparent'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <Settings2
                      className={`w-5 h-5 mx-auto ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                    />
                    <div
                      className={`text-xs mt-1 ${
                        isDark ? 'text-neutral-400' : 'text-gray-500'
                      }`}
                    >
                      {translate('other', 'Autre')}
                    </div>
                  </button>
                </div>

                {/* Custom time input */}
                {isCustomTime && (
                  <div className="mt-3 flex justify-center">
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
                      placeholder="20"
                      className={`w-20 px-3 py-2 rounded-lg text-center font-bold ${
                        isDark
                          ? 'bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500'
                          : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400'
                      } focus:outline-none focus:border-orange-500`}
                    />
                    <span
                      className={`ml-2 self-center text-sm ${
                        isDark ? 'text-neutral-400' : 'text-gray-500'
                      }`}
                    >
                      s
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && courses.length > 0 && (
          <div
            className={`sticky bottom-0 flex gap-3 p-6 border-t ${
              isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-100'
            }`}
          >
            <button
              onClick={onClose}
              disabled={creating}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                isDark
                  ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              {translate('cancel', 'Annuler')}
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || generatingQuiz || (!selectedCourseId && !selectedChapterId) || (isCustomTime && !isValidCustomTime)}
              className="flex-1 px-4 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generatingQuiz ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {translate('generating_quiz', 'Génération du quiz...')}
                </>
              ) : creating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {translate('creating', 'Création...')}
                </>
              ) : (
                <>
                  <Target className="w-5 h-5" />
                  {needsQuizGeneration
                    ? translate('generate_and_create', 'Générer & Créer')
                    : translate('challenge_create', 'Créer le défi')
                  }
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
