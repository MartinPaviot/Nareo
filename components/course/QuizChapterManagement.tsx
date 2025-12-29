'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  RotateCcw,
  Plus,
  X,
  Trash2,
  Pencil,
  Play,
  Lock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Check,
  ListChecks,
  ToggleLeft,
  TextCursor,
  Gamepad2,
  UserPlus,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import ChapterScoreBadge from './ChapterScoreBadge';
import QuizPersonnalisationScreen from './QuizPersonnalisationScreen';
import { QuizConfig, DEFAULT_QUIZ_CONFIG } from '@/types/quiz-personnalisation';

// Question type translation keys
const QUESTION_TYPE_KEYS: Record<string, string> = {
  mcq: 'quiz_question_type_mcq',
  multiple_choice: 'quiz_question_type_mcq',
  true_false: 'quiz_question_type_true_false',
  fill_blank: 'quiz_question_type_fill_blank',
};

const QUESTION_TYPE_ICONS: Record<string, typeof ListChecks> = {
  mcq: ListChecks,
  multiple_choice: ListChecks,
  true_false: ToggleLeft,
  fill_blank: TextCursor,
};

interface Question {
  id: string;
  chapterId: string;
  type: string;
  questionText: string;
  options: string[] | null;
  correctOptionIndex: number | null;
  answerText: string | null;
  explanation: string | null;
  questionNumber: number;
  acceptedAnswers: string[] | null;
  attempted?: boolean;
  isCorrect?: boolean | null;
}

interface ChapterWithQuestions {
  id: string;
  title: string;
  orderIndex: number;
  questions: Question[];
}

interface Chapter {
  id: string;
  title: string;
  summary: string | null;
  difficulty: string | null;
  order_index: number;
  question_count: number;
  has_access: boolean;
  completed: boolean;
  in_progress: boolean;
  score: number | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
}

interface QuizChapterManagementProps {
  courseId: string;
  courseTitle: string;
  chapters: Chapter[];
  quizStatus?: string;
  savedQuizConfig?: QuizConfig | null; // Config sauvegardée en base pour régénération
  onChapterClick: (chapter: Chapter, index: number) => void;
  onRegenerateQuiz: (config: QuizConfig) => void;
  isGenerating?: boolean;
  generationProgress?: number; // Progress percentage (0-100)
  generationMessage?: string; // Current step message
  hasFullAccess?: boolean;
  isDemoId?: boolean;
  refetch: () => void;
}

export default function QuizChapterManagement({
  courseId,
  courseTitle,
  chapters,
  quizStatus,
  savedQuizConfig,
  onChapterClick,
  onRegenerateQuiz,
  isGenerating = false,
  generationProgress = 0,
  generationMessage = '',
  hasFullAccess = false,
  isDemoId = false,
  refetch,
}: QuizChapterManagementProps) {
  const router = useRouter();
  const { translate } = useLanguage();
  const { user } = useAuth();
  const { isDark } = useTheme();

  // State for questions management
  const [questionsData, setQuestionsData] = useState<ChapterWithQuestions[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Form states
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [newQuestionType, setNewQuestionType] = useState<'mcq' | 'true_false' | 'fill_blank'>('mcq');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newOptions, setNewOptions] = useState<string[]>(['', '', '', '']);
  const [newCorrectIndex, setNewCorrectIndex] = useState<number>(0);
  const [newAnswerText, setNewAnswerText] = useState('');
  const [newExplanation, setNewExplanation] = useState('');

  // Loading states
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);

  // Config mémoire pour régénération - utilise la config sauvegardée si disponible
  const [lastQuizConfig, setLastQuizConfig] = useState<QuizConfig>(
    savedQuizConfig || DEFAULT_QUIZ_CONFIG
  );

  // Mettre à jour la config locale quand savedQuizConfig change (données chargées)
  useEffect(() => {
    console.log('[QuizChapterManagement] savedQuizConfig changed:', savedQuizConfig);
    if (savedQuizConfig) {
      console.log('[QuizChapterManagement] Updating lastQuizConfig with savedQuizConfig');
      setLastQuizConfig(savedQuizConfig);
    }
  }, [savedQuizConfig]);

  // Debug: log current config state
  useEffect(() => {
    console.log('[QuizChapterManagement] Current lastQuizConfig:', lastQuizConfig);
  }, [lastQuizConfig]);

  // Fetch questions for expanded chapter
  const fetchQuestions = useCallback(async () => {
    if (!courseId || isDemoId) return;

    setLoadingQuestions(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/quiz`);
      if (response.ok) {
        const data = await response.json();
        setQuestionsData(data.chapters || []);
      }
    } catch (err) {
      console.error('Error fetching questions:', err);
    } finally {
      setLoadingQuestions(false);
    }
  }, [courseId, isDemoId]);

  // Load questions when quiz is ready
  useEffect(() => {
    if (quizStatus === 'ready' || quizStatus === 'partial') {
      fetchQuestions();
    }
  }, [quizStatus, fetchQuestions]);

  // Get questions for a specific chapter
  const getChapterQuestions = (chapterId: string): Question[] => {
    const chapter = questionsData.find(c => c.id === chapterId);
    return chapter?.questions || [];
  };

  // Reset form
  const resetForm = () => {
    setNewQuestionType('mcq');
    setNewQuestionText('');
    setNewOptions(['', '', '', '']);
    setNewCorrectIndex(0);
    setNewAnswerText('');
    setNewExplanation('');
    setSelectedChapterId('');
    setSelectedQuestion(null);
  };

  // Open add modal for a specific chapter
  const openAddModal = (chapterId: string) => {
    resetForm();
    setSelectedChapterId(chapterId);
    setShowAddModal(true);
  };

  // Open edit modal for a question
  const openEditModal = (question: Question) => {
    setSelectedQuestion(question);
    setSelectedChapterId(question.chapterId);
    setNewQuestionType(question.type as 'mcq' | 'true_false' | 'fill_blank');
    setNewQuestionText(question.questionText || '');
    setNewOptions(question.options || ['', '', '', '']);
    setNewCorrectIndex(question.correctOptionIndex ?? 0);
    setNewAnswerText(question.answerText || '');
    setNewExplanation(question.explanation || '');
    setShowEditModal(true);
  };

  // Open delete modal for a question
  const openDeleteModal = (question: Question) => {
    setSelectedQuestion(question);
    setShowDeleteModal(true);
  };

  // Add new question
  const handleAddQuestion = async () => {
    if (!selectedChapterId || !newQuestionText.trim()) return;

    setAddingQuestion(true);
    try {
      const body: any = {
        chapterId: selectedChapterId,
        type: newQuestionType,
        questionText: newQuestionText.trim(),
        explanation: newExplanation.trim() || null,
      };

      if (newQuestionType === 'mcq') {
        body.options = newOptions.filter(o => o.trim());
        body.correctOptionIndex = newCorrectIndex;
      } else if (newQuestionType === 'true_false') {
        body.correctOptionIndex = newCorrectIndex; // 0 = true, 1 = false
      } else if (newQuestionType === 'fill_blank') {
        body.answerText = newAnswerText.trim();
        body.acceptedAnswers = [newAnswerText.trim()];
      }

      const response = await fetch(`/api/courses/${courseId}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add question');
      }

      // Refresh data
      await fetchQuestions();
      await refetch();
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      console.error('Error adding question:', err);
    } finally {
      setAddingQuestion(false);
    }
  };

  // Edit question
  const handleEditQuestion = async () => {
    if (!selectedQuestion || !newQuestionText.trim()) return;

    setEditingQuestion(true);
    try {
      const body: any = {
        questionId: selectedQuestion.id,
        questionText: newQuestionText.trim(),
        explanation: newExplanation.trim() || null,
      };

      if (newQuestionType === 'mcq') {
        body.options = newOptions.filter(o => o.trim());
        body.correctOptionIndex = newCorrectIndex;
      } else if (newQuestionType === 'true_false') {
        body.correctOptionIndex = newCorrectIndex;
      } else if (newQuestionType === 'fill_blank') {
        body.answerText = newAnswerText.trim();
        body.acceptedAnswers = [newAnswerText.trim()];
      }

      const response = await fetch(`/api/courses/${courseId}/quiz`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update question');
      }

      // Refresh data
      await fetchQuestions();
      setShowEditModal(false);
      resetForm();
    } catch (err) {
      console.error('Error editing question:', err);
    } finally {
      setEditingQuestion(false);
    }
  };

  // Delete question
  const handleDeleteQuestion = async () => {
    if (!selectedQuestion) return;

    setDeletingQuestion(true);
    try {
      const response = await fetch(
        `/api/courses/${courseId}/quiz?questionId=${selectedQuestion.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete question');
      }

      // Refresh data
      await fetchQuestions();
      await refetch();
      setShowDeleteModal(false);
      setSelectedQuestion(null);
    } catch (err) {
      console.error('Error deleting question:', err);
    } finally {
      setDeletingQuestion(false);
    }
  };

  // Render question form based on type
  const renderQuestionForm = () => (
    <div className="space-y-4">
      {/* Question Type Selector */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
          Type de question
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['mcq', 'true_false', 'fill_blank'] as const).map((type) => {
            const Icon = QUESTION_TYPE_ICONS[type] || ListChecks;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setNewQuestionType(type)}
                disabled={!!selectedQuestion} // Can't change type when editing
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  newQuestionType === type
                    ? 'border-orange-500 bg-orange-500/10'
                    : isDark
                    ? 'border-neutral-700 hover:border-neutral-600'
                    : 'border-gray-200 hover:border-gray-300'
                } ${selectedQuestion ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Icon className={`w-4 h-4 ${newQuestionType === type ? 'text-orange-500' : isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
                <span className={`text-xs font-medium ${newQuestionType === type ? 'text-orange-500' : isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
                  {translate(QUESTION_TYPE_KEYS[type])}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Question Text */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
          {translate('quiz_question_text_label')}
        </label>
        <textarea
          value={newQuestionText}
          onChange={(e) => setNewQuestionText(e.target.value)}
          placeholder={
            newQuestionType === 'fill_blank'
              ? translate('quiz_question_text_placeholder_fill')
              : newQuestionType === 'true_false'
              ? translate('quiz_question_text_placeholder_tf')
              : translate('quiz_question_text_placeholder_mcq')
          }
          rows={2}
          className={`w-full p-3 rounded-xl border-2 focus:border-orange-500 focus:outline-none transition-colors resize-none ${
            isDark
              ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500'
              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
          }`}
        />
      </div>

      {/* MCQ Options */}
      {newQuestionType === 'mcq' && (
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
            {translate('quiz_options_label')}
          </label>
          <div className="space-y-2">
            {newOptions.map((option, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNewCorrectIndex(idx)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    newCorrectIndex === idx
                      ? 'border-green-500 bg-green-500'
                      : isDark
                      ? 'border-neutral-600 hover:border-neutral-500'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {newCorrectIndex === idx && <Check className="w-3 h-3 text-white" />}
                </button>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const updated = [...newOptions];
                    updated[idx] = e.target.value;
                    setNewOptions(updated);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  className={`flex-1 p-2 rounded-lg border focus:border-orange-500 focus:outline-none transition-colors ${
                    isDark
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* True/False Options */}
      {newQuestionType === 'true_false' && (
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
            {translate('quiz_statement_label')}
          </label>
          <div className="flex gap-3">
            {[translate('quiz_true'), translate('quiz_false')].map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => setNewCorrectIndex(idx)}
                className={`flex-1 p-3 rounded-xl border-2 font-medium transition-all ${
                  newCorrectIndex === idx
                    ? idx === 0
                      ? 'border-green-500 bg-green-500/10 text-green-600'
                      : 'border-red-500 bg-red-500/10 text-red-600'
                    : isDark
                    ? 'border-neutral-700 text-neutral-300 hover:border-neutral-600'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fill Blank Answer */}
      {newQuestionType === 'fill_blank' && (
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
            {translate('quiz_correct_answer_label')}
          </label>
          <input
            type="text"
            value={newAnswerText}
            onChange={(e) => setNewAnswerText(e.target.value)}
            placeholder="Ex: WACC"
            className={`w-full p-3 rounded-xl border-2 focus:border-orange-500 focus:outline-none transition-colors ${
              isDark
                ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
            }`}
          />
        </div>
      )}

      {/* Explanation */}
      <div>
        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
          {translate('quiz_explanation_label')}
        </label>
        <textarea
          value={newExplanation}
          onChange={(e) => setNewExplanation(e.target.value)}
          placeholder={translate('quiz_explanation_placeholder')}
          rows={2}
          className={`w-full p-3 rounded-xl border-2 focus:border-orange-500 focus:outline-none transition-colors resize-none ${
            isDark
              ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500'
              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
          }`}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <span className={isDark ? 'text-neutral-400' : 'text-gray-600'}>
          {translate('quiz_chapters_count', { count: chapters.length.toString(), questions: chapters.reduce((sum, c) => sum + c.question_count, 0).toString() })}
        </span>
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Launch Challenge button */}
          {!isDemoId && user && (
            <button
              onClick={() => router.push(`/defi/creer?courseId=${courseId}`)}
              className={`inline-flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              <Gamepad2 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{translate('quiz_launch_challenge')}</span>
              <span className="sm:hidden">{translate('challenge_title')}</span>
            </button>
          )}
          <button
            onClick={() => user ? setShowRegenerateModal(true) : setShowSignupModal(true)}
            disabled={isGenerating}
            className={`inline-flex items-center gap-1 text-xs sm:text-sm ${
              isDark ? 'text-orange-400 hover:text-orange-300' : 'text-orange-600 hover:text-orange-700'
            }`}
          >
            <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>{translate('quiz_regenerate')}</span>
          </button>
        </div>
      </div>

      {/* Chapters list */}
      {chapters.length === 0 ? (
        <div className={`rounded-2xl border shadow-sm p-8 text-center transition-colors ${
          isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
        }`}>
          <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`} />
          <p className={isDark ? 'text-neutral-400' : 'text-gray-600'}>{translate('quiz_no_chapters')}</p>
        </div>
      ) : (
        <div className={`rounded-2xl border shadow-sm divide-y transition-colors ${
          isDark ? 'bg-neutral-900 border-neutral-800 divide-neutral-800' : 'bg-white border-gray-200 divide-gray-100'
        }`}>
          {chapters.map((chapter, index) => {
            const isLocked = index > 0 && (!user || !hasFullAccess) && !isDemoId;
            const isChapterReady = chapter.status === 'ready' || chapter.question_count > 0;
            const isExpanded = expandedChapter === chapter.id;
            const chapterQuestions = getChapterQuestions(chapter.id);

            return (
              <div key={chapter.id}>
                {/* Chapter header */}
                <div
                  className={`p-3 sm:p-5 transition-colors ${
                    isDark ? 'hover:bg-neutral-800/50' : 'hover:bg-orange-50/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-4">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center font-semibold text-sm sm:text-base flex-shrink-0 ${
                      isDark ? 'bg-orange-400/15 text-orange-300' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                        <h3 className={`text-sm sm:text-lg font-semibold truncate ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                          {chapter.title}
                        </h3>
                        {isLocked && (
                          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold inline-flex items-center gap-0.5 sm:gap-1 ${
                            isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </span>
                        )}
                      </div>
                      <div className={`flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs ${isDark ? 'text-neutral-500' : 'text-gray-600'}`}>
                        <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${
                          isDark ? 'bg-neutral-800' : 'bg-gray-100'
                        }`}>
                          {chapter.question_count} questions
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Expand/collapse button */}
                      {isChapterReady && !isDemoId && (
                        <button
                          onClick={() => setExpandedChapter(isExpanded ? null : chapter.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            isDark ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
                          }`}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      {/* Score badge */}
                      {chapter.score !== null && chapter.question_count > 0 && (
                        <ChapterScoreBadge
                          scorePts={chapter.score}
                          maxPts={chapter.question_count * 10}
                          compact
                        />
                      )}

                      {/* Play button */}
                      <button
                        onClick={() => onChapterClick(chapter, index)}
                        disabled={!isChapterReady}
                        className={`inline-flex items-center justify-center gap-1.5 w-[120px] sm:w-[140px] px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                          !isChapterReady
                            ? isDark ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : isLocked
                            ? isDark ? 'bg-neutral-800 text-neutral-400 hover:bg-orange-500/20 hover:text-orange-400' : 'bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-600'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                      >
                        {!isChapterReady ? (
                          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                        ) : chapter.completed ? (
                          <>
                            <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
                            Recommencer
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                            Commencer
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded questions list */}
                {isExpanded && (
                  <div className={`px-3 sm:px-5 pb-4 ${isDark ? 'bg-neutral-800/30' : 'bg-gray-50/50'}`}>
                    <div className="flex items-center justify-between mb-3 pt-2">
                      <span className={`text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                        {translate('quiz_chapter_questions')}
                      </span>
                      <button
                        onClick={() => openAddModal(chapter.id)}
                        className={`inline-flex items-center gap-1 text-xs ${
                          isDark ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-700'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        {translate('quiz_add_question')}
                      </button>
                    </div>

                    {loadingQuestions ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                      </div>
                    ) : chapterQuestions.length === 0 ? (
                      <p className={`text-xs text-center py-4 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                        {translate('quiz_no_questions')}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {chapterQuestions.map((question, qIdx) => {
                          const Icon = QUESTION_TYPE_ICONS[question.type] || ListChecks;
                          return (
                            <div
                              key={question.id}
                              className={`p-3 rounded-xl border ${
                                isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span className={`text-xs font-mono flex-shrink-0 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                                  {qIdx + 1}.
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Icon className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
                                    <span className={`text-[10px] uppercase ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                                      {translate(QUESTION_TYPE_KEYS[question.type]) || question.type}
                                    </span>
                                  </div>
                                  <p className={`text-sm line-clamp-2 ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>
                                    {question.questionText}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => openEditModal(question)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      isDark ? 'hover:bg-neutral-700 text-blue-400' : 'hover:bg-gray-100 text-blue-600'
                                    }`}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => openDeleteModal(question)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      isDark ? 'hover:bg-neutral-700 text-red-400' : 'hover:bg-gray-100 text-red-500'
                                    }`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Question Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-bold ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                {translate('quiz_add_question_title')}
              </h3>
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className={`p-2 rounded-full transition-colors ${
                  isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderQuestionForm()}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {translate('cancel')}
              </button>
              <button
                onClick={handleAddQuestion}
                disabled={addingQuestion || !newQuestionText.trim() || (newQuestionType === 'fill_blank' && !newAnswerText.trim())}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {addingQuestion ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {translate('quiz_adding')}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {translate('quiz_add_question')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Question Modal */}
      {showEditModal && selectedQuestion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-bold ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                {translate('quiz_edit_question_title')}
              </h3>
              <button
                onClick={() => { setShowEditModal(false); resetForm(); }}
                className={`p-2 rounded-full transition-colors ${
                  isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderQuestionForm()}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowEditModal(false); resetForm(); }}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {translate('cancel')}
              </button>
              <button
                onClick={handleEditQuestion}
                disabled={editingQuestion || !newQuestionText.trim()}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {editingQuestion ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {translate('quiz_saving')}
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4" />
                    {translate('save')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedQuestion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isDark ? 'bg-red-500/20' : 'bg-red-100'
            }`}>
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
              {translate('quiz_delete_question_title')}
            </h3>
            <p className={`text-sm mb-2 text-center ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              {translate('quiz_delete_question_irreversible')}
            </p>
            <p className={`text-sm mb-6 text-center line-clamp-2 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              &ldquo;{selectedQuestion.questionText}&rdquo;
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setSelectedQuestion(null); }}
                disabled={deletingQuestion}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {translate('cancel')}
              </button>
              <button
                onClick={handleDeleteQuestion}
                disabled={deletingQuestion}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {deletingQuestion ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {translate('quiz_deleting')}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {translate('delete')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Modal */}
      {showRegenerateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl max-w-md w-full shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <QuizPersonnalisationScreen
              onGenerate={(config) => {
                console.log('[QuizChapterManagement] onGenerate called with config:', config);
                setLastQuizConfig(config); // Sauvegarder la config pour la prochaine fois
                setShowRegenerateModal(false);
                onRegenerateQuiz(config);
              }}
              onCancel={() => setShowRegenerateModal(false)}
              isGenerating={isGenerating}
              initialConfig={lastQuizConfig}
            />
          </div>
        </div>
      )}

      {/* Signup Modal */}
      {showSignupModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isDark ? 'bg-orange-500/20' : 'bg-orange-100'
            }`}>
              <UserPlus className="w-7 h-7 text-orange-500" />
            </div>
            <h3 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
              {translate('signup_to_continue_title')}
            </h3>
            <p className={`text-sm mb-6 text-center ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              {translate('signup_to_continue_description')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignupModal(false)}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {translate('cancel')}
              </button>
              <button
                onClick={() => router.push('/auth/signup')}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                {translate('auth_signup_button')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating toast notification for regeneration progress */}
      {isGenerating && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`rounded-2xl shadow-2xl border p-4 w-80 ${
            isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isDark ? 'bg-orange-500/20' : 'bg-orange-100'
              }`}>
                <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                  {translate('quiz_regenerating', 'Génération du quiz...')}
                </p>
                <p className={`text-xs truncate mb-2 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  {generationMessage || translate('quiz_please_wait', 'Veuillez patienter...')}
                </p>
                <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-100'}`}>
                  <div
                    className="bg-orange-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
                <p className={`text-xs mt-1 text-right ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>{generationProgress}%</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
