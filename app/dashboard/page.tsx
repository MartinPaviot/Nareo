'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, BookOpen, Loader2, Lock, Upload } from 'lucide-react';
import AuthGuard from '@/components/auth/AuthGuard';
import TopBarActions from '@/components/layout/TopBarActions';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { trackEvent } from '@/lib/posthog';

interface Course {
  id: string;
  title: string;
  status: string;
  chapter_count: number;
  completed_chapters: number;
  in_progress_chapters: number;
  user_score: number;
  created_at: string;
}

function MyCoursesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { translate } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadCourses();
      trackEvent('dashboard_viewed', { userId: user.id });
    }
  }, [user]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/courses');
      if (!response.ok) {
        throw new Error('Failed to load courses');
      }
      const data = await response.json();
      setCourses(data.courses || []);
    } catch (error) {
      console.error('Error loading courses', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (course: Course) => {
    if (course.status === 'pending' || course.status === 'processing') {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold bg-yellow-100 text-yellow-800">
          <Loader2 className="w-3 h-3 animate-spin" />
          {translate('course_status_preparing')}
        </span>
      );
    }
    if (course.status === 'failed') {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3" />
          {translate('course_status_failed')}
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-1 rounded-full font-semibold bg-green-100 text-green-800">
        {translate('course_status_ready')}
      </span>
    );
  };

  const handleUpload = () => router.push('/');

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
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-orange-600 font-semibold">
              {translate('my_courses_subtitle')}
            </p>
            <h1 className="text-2xl font-bold text-gray-900">{translate('my_courses_title')}</h1>
          </div>
          <TopBarActions />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{translate('home_promise')}</p>
              <p className="text-xs text-gray-500">{translate('home_subpromise')}</p>
            </div>
          </div>
          <button
            onClick={handleUpload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600"
          >
            <Upload className="w-4 h-4" />
            {translate('my_courses_empty_cta')}
          </button>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-lg font-semibold text-gray-900 mb-1">
              {translate('my_courses_empty_title')}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              {translate('dashboard_empty_desc')}
            </p>
            <button
              onClick={handleUpload}
              className="px-5 py-3 rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-600 inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {translate('my_courses_empty_cta')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {courses.map((course) => (
              <button
                key={course.id}
                onClick={() => router.push(`/courses/${course.id}/learn`)}
                className="text-left bg-white rounded-2xl border border-gray-200 hover:border-orange-300 hover:shadow-lg transition-all p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                      {course.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {translate('course_card_last_updated')}: {new Date(course.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {getStatusBadge(course)}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100">
                    <BookOpen className="w-3 h-3" />
                    {course.chapter_count} {translate('course_card_chapters')}
                  </div>
                  {course.status !== 'ready' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">
                      <Lock className="w-3 h-3" />
                      {translate('course_status_preparing')}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function ProtectedMyCourses() {
  return (
    <AuthGuard>
      <MyCoursesScreen />
    </AuthGuard>
  );
}
