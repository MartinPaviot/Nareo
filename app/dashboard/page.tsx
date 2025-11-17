'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, BookOpen, Clock, TrendingUp, Play, Loader2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AuthGuard from '@/components/auth/AuthGuard';
import AristoAvatar from '@/components/chat/AristoAvatar';
import TopBarActions from '@/components/layout/TopBarActions';
import CourseOverviewCard from '@/components/concepts/CourseOverviewCard';
import { useLanguage } from '@/contexts/LanguageContext';

interface ActiveSession {
  id: string;
  chapter_id: string;
  current_question: number;
  last_activity: string;
  chapter: {
    id: string;
    title: string;
    summary: string;
    english_title: string;
    french_title: string;
  };
  progress: {
    score: number;
    currentQuestion: number;
    questionsAnswered: number;
    completed: boolean;
  } | null;
}

interface Chapter {
  id: string;
  title: string;
  summary: string;
  englishTitle: string;
  englishDescription: string;
  frenchTitle: string;
  frenchDescription: string;
  difficulty: 'easy' | 'medium' | 'hard';
  orderIndex: number;
  questions: any[];
  sourceText: string;
}

interface ChapterProgress {
  chapterId: string;
  score: number;
  currentQuestion: number;
  questionsAnswered: number;
  completed: boolean;
}

function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { translate, currentLanguage } = useLanguage();
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterProgress, setChapterProgress] = useState<ChapterProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalChapters: 0,
    completedChapters: 0,
    inProgressChapters: 0,
    totalScore: 0,
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    chapterId: string | null;
    chapterTitle: string;
  }>({
    isOpen: false,
    chapterId: null,
    chapterTitle: '',
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    show: false,
    message: '',
    type: 'success',
  });

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load active sessions
      const sessionsResponse = await fetch(`/api/sessions/active?userId=${user?.id}`);
      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json();
        setActiveSessions(sessionsData.sessions || []);
      }

      // Load all chapters
      const chaptersResponse = await fetch('/api/chapters');
      if (chaptersResponse.ok) {
        const chaptersData = await chaptersResponse.json();
        console.log('DEBUG /api/chapters response:', chaptersData);

        const loadedChapters =
          chaptersData.chapters ??
          chaptersData.data ??
          (Array.isArray(chaptersData) ? chaptersData : []);

        const progress =
          chaptersData.progress ??
          chaptersData.progressData ??
          [];

        setChapters(loadedChapters);
        setChapterProgress(progress);

        const completed = progress.filter((p: ChapterProgress) => p.completed).length;
        const inProgress = progress.filter((p: ChapterProgress) => !p.completed && p.questionsAnswered > 0).length;
        const totalScore = progress.reduce((sum: number, p: ChapterProgress) => sum + p.score, 0);

        setStats({
          totalChapters: loadedChapters.length,
          completedChapters: completed,
          inProgressChapters: inProgress,
          totalScore,
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadNew = () => {
    router.push('/');
  };

  const handleResumeSession = (sessionId: string, chapterId: string) => {
    // Navigate to the learn page for this chapter
    router.push(`/learn/${chapterId}`);
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return translate('dashboard_time_just_now');
    if (diffMins < 60) return `${diffMins} ${translate('dashboard_time_min_ago')}`;
    if (diffHours < 24) return `${diffHours} ${translate(diffHours === 1 ? 'dashboard_time_hour_ago' : 'dashboard_time_hours_ago')}`;
    return `${diffDays} ${translate(diffDays === 1 ? 'dashboard_time_day_ago' : 'dashboard_time_days_ago')}`;
  };

  const handleDeleteCourse = (chapterId: string) => {
    const chapter = chapters.find(c => c.id === chapterId);
    if (chapter) {
      setDeleteConfirmation({
        isOpen: true,
        chapterId,
        chapterTitle: chapter.title,
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation.chapterId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/chapters/${deleteConfirmation.chapterId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Show success notification
        setNotification({
          show: true,
          message: translate('dashboard_delete_success'),
          type: 'success',
        });

        // Reload dashboard data
        await loadDashboardData();

        // Hide notification after 3 seconds
        setTimeout(() => {
          setNotification({ show: false, message: '', type: 'success' });
        }, 3000);
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting course:', error);
      setNotification({
        show: true,
        message: translate('dashboard_delete_error'),
        type: 'error',
      });

      // Hide notification after 3 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: 'success' });
      }, 3000);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmation({ isOpen: false, chapterId: null, chapterTitle: '' });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmation({ isOpen: false, chapterId: null, chapterTitle: '' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{translate('dashboard_loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AristoAvatar state="happy" size="md" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {translate('dashboard_title')}
                </h1>
                <p className="text-sm text-gray-600">
                  {translate('dashboard_subtitle')}
                </p>
              </div>
            </div>
            <TopBarActions />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{translate('dashboard_stat_total')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalChapters}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{translate('dashboard_stat_completed')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedChapters}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">{translate('dashboard_stat_progress')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inProgressChapters}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">⭐</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">{translate('dashboard_stat_score')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalScore}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Continue Learning Section */}
        {activeSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {translate('dashboard_continue_title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-orange-300 transition-all cursor-pointer"
                  onClick={() => handleResumeSession(session.id, session.chapter_id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-2">
                      {currentLanguage === 'fr' && session.chapter.french_title
                        ? session.chapter.french_title
                        : currentLanguage === 'en' && session.chapter.english_title
                        ? session.chapter.english_title
                        : session.chapter.title}
                    </h3>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                      {formatTimeAgo(session.last_activity)}
                    </span>
                  </div>

                  {session.progress && (
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {translate('dashboard_question_label')} {session.progress.currentQuestion}
                        </span>
                        <span className="text-gray-600">
                          {translate('dashboard_score_label')}: {session.progress.score}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {session.progress.questionsAnswered} {translate('dashboard_answered_label')}
                        </span>
                      </div>
                    </div>
                  )}

                  <button className="mt-4 w-full px-4 py-2 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2">
                    <Play className="w-4 h-4" />
                    {translate('dashboard_resume_button')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Your Courses Section */}
        {chapters.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {translate('dashboard_courses_title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {chapters.map((chapter) => {
                  const progress = chapterProgress.find(p => p.chapterId === chapter.id);
                  return (
                    <CourseOverviewCard
                      key={chapter.id}
                      chapter={chapter}
                      progress={progress}
                      onClick={() => {
                        // Navigate to learn page with first concept/chapter
                        router.push(`/learn/${chapter.id}`);
                      }}
                      onDelete={handleDeleteCourse}
                    />
                  );
                })}
            </div>
          </div>
        )}

        {/* Upload New Content */}
        <div className="bg-white rounded-2xl p-8 border-2 border-dashed border-gray-300 hover:border-orange-400 transition-all">
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {translate('dashboard_new_title')}
            </h3>
            <p className="text-gray-600 mb-6">
              {translate('dashboard_new_desc')}
            </p>
            <button
              onClick={handleUploadNew}
              className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors inline-flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              {translate('dashboard_new_button')}
            </button>
          </div>
        </div>

        {/* Empty State */}
        {activeSessions.length === 0 && chapters.length === 0 && (
          <div className="mt-8 bg-orange-50 border border-orange-200 rounded-2xl p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">🎓🐱</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {translate('dashboard_empty_title')}
              </h3>
              <p className="text-gray-600 mb-4">
                {translate('dashboard_empty_desc')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {translate('dashboard_delete_confirm_title')}
              </h3>
              <button
                onClick={cancelDelete}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isDeleting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-600 mb-6">
              {translate('dashboard_delete_confirm_message')}
            </p>

            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {translate('dashboard_delete_cancel')}
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {translate('dashboard_deleting')}
                  </>
                ) : (
                  translate('dashboard_delete_confirm_button')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification.show && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
          <div
            className={`px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 ${
              notification.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            <span className="font-semibold">{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProtectedDashboard() {
  return (
    <AuthGuard>
      <DashboardScreen />
    </AuthGuard>
  );
}
