'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
import ProgressiveQuizView, { StreamingQuestion } from './ProgressiveQuizView';
import CreateChallengeModal from '@/components/defi/CreateChallengeModal';
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
  /** Questions received from streaming during generation */
  streamingQuestions?: StreamingQuestion[];
  /** Whether to show the interactive quiz view during generation */
  enableProgressiveQuiz?: boolean;
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
  streamingQuestions = [],
  enableProgressiveQuiz = false,
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
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [showAddChapterModal, setShowAddChapterModal] = useState(false);

  // Progressive quiz state - allows playing during generation
  const [isPlayingProgressiveQuiz, setIsPlayingProgressiveQuiz] = useState(false);

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
  const [addingChapter, setAddingChapter] = useState(false);

  // New chapter form
  const [newChapterTitle, setNewChapterTitle] = useState('');

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

  // Add new chapter
  const handleAddChapter = async () => {
    if (!newChapterTitle.trim()) return;

    setAddingChapter(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newChapterTitle.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create chapter');
      }

      // Refresh data
      await refetch();
      setShowAddChapterModal(false);
      setNewChapterTitle('');
    } catch (err) {
      console.error('Error creating chapter:', err);
    } finally {
      setAddingChapter(false);
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
                      ? ''
                      : isDark
                      ? 'border-neutral-600 hover:border-neutral-500'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  style={newCorrectIndex === idx ? { borderColor: '#379f5a', backgroundColor: '#379f5a' } : {}}
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
                  newCorrectIndex !== idx
                    ? isDark
                      ? 'border-neutral-700 text-neutral-300 hover:border-neutral-600'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    : ''
                }`}
                style={newCorrectIndex === idx ? (idx === 0 ? { borderColor: '#379f5a', backgroundColor: 'rgba(55, 159, 90, 0.1)', color: '#379f5a' } : { borderColor: '#d91a1c', backgroundColor: '#fff6f3', color: '#d91a1c' }) : {}}
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

  // Group streaming questions by chapter for display during generation
  const streamingQuestionsByChapter = streamingQuestions.reduce((acc, q) => {
    if (!acc[q.chapterId]) {
      acc[q.chapterId] = { title: q.chapterTitle, questions: [] };
    }
    acc[q.chapterId].questions.push(q);
    return acc;
  }, {} as Record<string, { title: string; questions: StreamingQuestion[] }>);

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <span className={isDark ? 'text-neutral-400' : 'text-gray-600'}>
          {translate('quiz_chapters_count', { count: chapters.length.toString(), questions: chapters.reduce((sum, c) => sum + c.question_count, 0).toString() })}
        </span>
        <div className="flex items-center gap-1">
          {/* Launch Challenge button */}
          {!isDemoId && user && (
            <button
              onClick={() => setShowChallengeModal(true)}
              className="inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-white text-xs sm:text-sm font-medium transition-colors"
              style={{ backgroundColor: '#ff751f' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
            >
              <Gamepad2 className="w-4 h-4" />
              <span className="hidden sm:inline">{translate('challenge_create', 'Créer un défi')}</span>
              <span className="sm:hidden">{translate('challenge_title', 'Défi')}</span>
            </button>
          )}
          {/* Add chapter button */}
          {!isDemoId && (
            <button
              onClick={() => user ? setShowAddChapterModal(true) : setShowSignupModal(true)}
              disabled={isGenerating}
              className={`p-2 rounded-lg transition-colors ${
                isDark ? 'text-neutral-400 hover:text-neutral-300 hover:bg-neutral-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title={translate('quiz_add_chapter', 'Ajouter un chapitre')}
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => user ? setShowRegenerateModal(true) : setShowSignupModal(true)}
            disabled={isGenerating}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/20' : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
            }`}
            title={translate('quiz_regenerate')}
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Generation progress banner OR Progressive Quiz during generation */}
      {isGenerating && !isPlayingProgressiveQuiz && (
        <div className={`rounded-2xl border shadow-sm p-4 ${
          isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isDark ? 'bg-orange-500/20' : 'bg-orange-100'
            }`}>
              <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                {translate('quiz_generating_title', 'Génération du quiz en cours...')}
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
            </div>
            <div className={`text-right flex-shrink-0 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              <p className="text-lg font-bold text-orange-500">{streamingQuestions.length}</p>
              <p className="text-xs">{translate('quiz_questions_generated', 'questions')}</p>
            </div>
          </div>
          {/* Start now button - appears when at least 1 question is available */}
          {streamingQuestions.length > 0 && enableProgressiveQuiz && (
            <div className={`mt-4 pt-4 border-t border-dashed ${isDark ? 'border-neutral-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setIsPlayingProgressiveQuiz(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors"
              >
                <Play className="w-4 h-4" />
                {translate('quiz_start_now', 'Commencer maintenant')}
                <span className={`text-xs px-2 py-0.5 rounded-full bg-white/20`}>
                  {streamingQuestions.length} {translate('quiz_questions_ready', 'prêtes')}
                </span>
              </button>
              <p className={`text-xs text-center mt-2 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                {translate('quiz_start_now_hint', 'Les autres questions arriveront pendant que vous jouez')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Progressive Quiz View - shown when user chooses to play during generation */}
      {isGenerating && isPlayingProgressiveQuiz && streamingQuestions.length > 0 && (
        <div className="space-y-4">
          {/* Back button to return to generation view */}
          <button
            onClick={() => setIsPlayingProgressiveQuiz(false)}
            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${
              isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ← {translate('back', 'Retour')}
          </button>
          <ProgressiveQuizView
            questions={streamingQuestions}
            isGenerating={isGenerating}
            progress={generationProgress}
            questionsGenerated={streamingQuestions.length}
            totalQuestions={undefined}
            progressMessage={generationMessage}
            onComplete={(score, answers) => {
              console.log('Progressive quiz completed:', { score, answers });
              setIsPlayingProgressiveQuiz(false);
              // Refetch to update chapter data
              refetch();
            }}
            courseId={courseId}
          />
        </div>
      )}

      {/* Chapters list */}
      {chapters.length === 0 && !isGenerating ? (
        <div className={`rounded-2xl border shadow-sm p-8 text-center transition-colors ${
          isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
        }`}>
          <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`} />
          <p className={isDark ? 'text-neutral-400' : 'text-gray-600'}>{translate('quiz_no_chapters')}</p>
        </div>
      ) : chapters.length > 0 ? (
        <div className={`rounded-2xl border shadow-sm divide-y transition-colors ${
          isDark ? 'bg-neutral-900 border-neutral-800 divide-neutral-800' : 'bg-white border-gray-200 divide-gray-100'
        }`}>
          {chapters.map((chapter, index) => {
            const isLocked = index > 0 && (!user || !hasFullAccess) && !isDemoId;
            // During generation, consider chapter ready if it has streaming questions
            const streamingChapterData = streamingQuestionsByChapter[chapter.id];
            const streamingCount = streamingChapterData?.questions.length || 0;
            const totalQuestionCount = chapter.question_count + streamingCount;
            // Chapter is "ready" (not loading) if:
            // - status is 'ready' OR
            // - it has questions (either from DB or streaming) OR
            // - generation is NOT in progress (even with 0 questions, show as ready with disabled button)
            const isChapterReady = chapter.status === 'ready' || chapter.question_count > 0 || streamingCount > 0 || !isGenerating;
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
                          streamingCount > 0
                            ? isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                            : isDark ? 'bg-neutral-800' : 'bg-gray-100'
                        }`}>
                          {streamingCount > 0 && (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          )}
                          {totalQuestionCount} questions
                          {streamingCount > 0 && (
                            <span className="text-orange-500">+</span>
                          )}
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
                        disabled={!isChapterReady || totalQuestionCount === 0}
                        className={`inline-flex items-center justify-center gap-1.5 w-[120px] sm:w-[140px] px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                          !isChapterReady || totalQuestionCount === 0
                            ? isDark ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : isLocked
                            ? isDark ? 'bg-neutral-800 text-neutral-400 hover:bg-orange-500/20 hover:text-orange-400' : 'bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-600'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                        title={totalQuestionCount === 0 ? translate('quiz_no_questions') : undefined}
                      >
                        {!isChapterReady ? (
                          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                        ) : totalQuestionCount === 0 ? (
                          <>
                            <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">0 questions</span>
                            <span className="sm:hidden">0</span>
                          </>
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
                        className="inline-flex items-center gap-1 text-xs transition-colors"
                        style={{ color: isDark ? '#5cb978' : '#379f5a' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = isDark ? '#7dd69b' : '#2d8049'}
                        onMouseLeave={(e) => e.currentTarget.style.color = isDark ? '#5cb978' : '#379f5a'}
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
                                      isDark ? 'hover:bg-neutral-700' : 'hover:bg-gray-100'
                                    }`}
                                    style={{ color: isDark ? '#e94446' : '#d91a1c' }}
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
      ) : null}

      {/* Add Question Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
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
        </div>,
        document.body
      )}

      {/* Edit Question Modal */}
      {showEditModal && selectedQuestion && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
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
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedQuestion && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: isDark ? 'rgba(217, 26, 28, 0.2)' : '#fff6f3' }}
            >
              <Trash2 className="w-7 h-7" style={{ color: '#d91a1c' }} />
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
                className="flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: '#d91a1c' }}
                onMouseEnter={(e) => !deletingQuestion && (e.currentTarget.style.backgroundColor = '#b81618')}
                onMouseLeave={(e) => !deletingQuestion && (e.currentTarget.style.backgroundColor = '#d91a1c')}
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
        </div>,
        document.body
      )}

      {/* Regenerate Modal */}
      {showRegenerateModal && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
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
        </div>,
        document.body
      )}

      {/* Signup Modal */}
      {showSignupModal && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
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
        </div>,
        document.body
      )}

      {/* Challenge Modal */}
      {showChallengeModal && (
        <CreateChallengeModal
          onClose={() => setShowChallengeModal(false)}
          preselectedCourseId={courseId}
        />
      )}

      {/* Add Chapter Modal */}
      {showAddChapterModal && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-bold ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                {translate('quiz_add_chapter_title', 'Nouveau chapitre')}
              </h3>
              <button
                onClick={() => { setShowAddChapterModal(false); setNewChapterTitle(''); }}
                className={`p-2 rounded-full transition-colors ${
                  isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
                  {translate('quiz_chapter_title_label', 'Titre du chapitre')}
                </label>
                <input
                  type="text"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder={translate('quiz_chapter_title_placeholder', 'Ex: Les fondamentaux')}
                  className={`w-full p-3 rounded-xl border-2 focus:border-orange-500 focus:outline-none transition-colors ${
                    isDark
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newChapterTitle.trim()) {
                      handleAddChapter();
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddChapterModal(false); setNewChapterTitle(''); }}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {translate('cancel')}
              </button>
              <button
                onClick={handleAddChapter}
                disabled={addingChapter || !newChapterTitle.trim()}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {addingChapter ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {translate('quiz_creating', 'Création...')}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {translate('quiz_add_chapter', 'Ajouter un chapitre')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
