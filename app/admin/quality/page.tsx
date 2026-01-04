'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  HelpCircle,
  RefreshCw,
  ChevronRight,
  BarChart3,
  Trash2,
  X,
} from 'lucide-react';

// Admin verification via session (set after code verification)

interface CourseSummary {
  id: string;
  title: string;
  createdAt: string;
  userId: string;
  sourceTextLength: number;
  chapterCount: number;
  totalQuestions: number;
  relevanceScore: number;
  hasSourceText: boolean;
}

interface Stats {
  totalCourses: number;
  coursesWithSource: number;
  totalChapters: number;
  totalQuestions: number;
  averageRelevance: number;
}

export default function QualityAuditPage() {
  const { user, loading: authLoading, session } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; course: CourseSummary | null }>({
    open: false,
    course: null,
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/admin/login');
      return;
    }

    // Check admin session
    const adminAuth = sessionStorage.getItem('adminAuthenticated');
    const adminExpiry = sessionStorage.getItem('adminExpiry');

    if (adminAuth !== 'true' || !adminExpiry || new Date(adminExpiry) < new Date()) {
      router.push('/admin/login');
      return;
    }

    setIsAdminAuthenticated(true);
    if (session?.access_token) {
      loadAuditData();
    }
  }, [user, authLoading, router, session]);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/admin/quality-audit', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load audit data');
      }

      setStats(data.stats);
      setCourses(data.courses);
    } catch (err: any) {
      console.error('Error loading audit data:', err);
      setError(err.message || 'Failed to load audit data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!deleteModal.course) return;

    try {
      setDeleting(true);
      setError('');

      const response = await fetch(`/api/admin/quality-audit?courseId=${deleteModal.course.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete course');
      }

      // Remove course from local state
      setCourses(courses.filter(c => c.id !== deleteModal.course!.id));

      // Update stats
      if (stats) {
        setStats({
          ...stats,
          totalCourses: stats.totalCourses - 1,
          coursesWithSource: deleteModal.course.hasSourceText
            ? stats.coursesWithSource - 1
            : stats.coursesWithSource,
          totalChapters: stats.totalChapters - deleteModal.course.chapterCount,
          totalQuestions: stats.totalQuestions - deleteModal.course.totalQuestions,
        });
      }

      setDeleteModal({ open: false, course: null });
    } catch (err: any) {
      console.error('Error deleting course:', err);
      setError(err.message || 'Failed to delete course');
    } finally {
      setDeleting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 0) return 'text-gray-500 bg-gray-100'; // N/A - no source text
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-blue-600 bg-blue-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-[#d91a1c] bg-[#d91a1c]/10';
  };

  const getScoreIcon = (score: number) => {
    if (score < 0) return <HelpCircle className="w-4 h-4 text-gray-400" />; // N/A
    if (score >= 80) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (score >= 60) return <CheckCircle className="w-4 h-4 text-blue-600" />;
    if (score >= 40) return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    return <XCircle className="w-4 h-4" style={{ color: '#d91a1c' }} />;
  };

  const getScoreDisplay = (score: number) => {
    if (score < 0) return 'N/A';
    return `${score}%`;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo"
            width={200}
            height={200}
            className="mx-auto mb-4 animate-bounce"
          />
          <p className="text-gray-600">Loading quality audit...</p>
        </div>
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-orange-600 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Quality Audit
              </h1>
              <p className="text-gray-600">
                Analyze course content quality and question relevance
              </p>
            </div>
            <button
              onClick={loadAuditData}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="px-4 py-3 rounded-lg mb-6 border"
            style={{
              backgroundColor: '#fff6f3',
              borderColor: 'rgba(217, 26, 28, 0.2)',
              color: '#b91c1c'
            }}
          >
            {error}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <FileText className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalCourses}</p>
                  <p className="text-sm text-gray-500">Total Courses</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.coursesWithSource}</p>
                  <p className="text-sm text-gray-500">With Source</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalChapters}</p>
                  <p className="text-sm text-gray-500">Chapters</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <HelpCircle className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalQuestions}</p>
                  <p className="text-sm text-gray-500">Questions</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getScoreColor(stats.averageRelevance)}`}>
                  {getScoreIcon(stats.averageRelevance)}
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.averageRelevance}%</p>
                  <p className="text-sm text-gray-500">Avg Relevance</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Courses Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">All Courses</h2>
            <p className="text-sm text-gray-500">Click on a course to see detailed audit</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chapters
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Questions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Relevance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No courses found
                    </td>
                  </tr>
                ) : (
                  courses.map((course) => (
                    <tr key={course.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          <p className="font-medium text-gray-900 truncate">{course.title}</p>
                          <p className="text-xs text-gray-500 truncate">{course.id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {course.hasSourceText ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                            <CheckCircle className="w-3 h-3" />
                            {Math.round(course.sourceTextLength / 1000)}k chars
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                            style={{ backgroundColor: '#fff6f3', color: '#b91c1c' }}
                          >
                            <XCircle className="w-3 h-3" />
                            No source
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {course.chapterCount}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {course.totalQuestions}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(course.relevanceScore)}`}>
                          {getScoreIcon(course.relevanceScore)}
                          {getScoreDisplay(course.relevanceScore)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(course.createdAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/quality/${course.id}`}
                            className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium text-sm"
                          >
                            View
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setDeleteModal({ open: true, course });
                            }}
                            className="inline-flex items-center gap-1 font-medium text-sm p-1 rounded transition"
                            style={{ color: '#d91a1c' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#b81618';
                              e.currentTarget.style.backgroundColor = '#fff6f3';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#d91a1c';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            title="Supprimer ce cours"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 bg-white rounded-xl shadow-md p-4">
          <h3 className="font-medium text-gray-900 mb-3">Relevance Score Legend</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">80-100%</span>
              <span className="text-sm text-gray-600">Excellent - Questions match source well</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">60-79%</span>
              <span className="text-sm text-gray-600">Good - Minor improvements possible</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">40-59%</span>
              <span className="text-sm text-gray-600">Fair - Review recommended</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: '#fff6f3', color: '#b91c1c' }}>0-39%</span>
              <span className="text-sm text-gray-600">Poor - Regeneration needed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.course && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Confirmer la suppression</h3>
              <button
                onClick={() => setDeleteModal({ open: false, course: null })}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <div
                className="flex items-center gap-3 p-4 rounded-xl mb-4"
                style={{ backgroundColor: '#fff6f3' }}
              >
                <div className="p-2 rounded-lg" style={{ backgroundColor: '#fff6f3' }}>
                  <AlertTriangle className="w-6 h-6" style={{ color: '#d91a1c' }} />
                </div>
                <div>
                  <p className="font-medium" style={{ color: '#991b1b' }}>Action irréversible</p>
                  <p className="text-sm" style={{ color: '#d91a1c' }}>Cette action ne peut pas être annulée.</p>
                </div>
              </div>

              <p className="text-gray-600 mb-2">
                Vous êtes sur le point de supprimer le cours :
              </p>
              <p className="font-medium text-gray-900 mb-4 p-3 bg-gray-50 rounded-lg">
                {deleteModal.course.title}
              </p>

              <div className="text-sm text-gray-500 space-y-1">
                <p>• {deleteModal.course.chapterCount} chapitre(s) seront supprimés</p>
                <p>• {deleteModal.course.totalQuestions} question(s) seront supprimées</p>
                <p>• Toutes les données associées seront perdues</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ open: false, course: null })}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteCourse}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#d91a1c' }}
                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#b81618')}
                onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#d91a1c')}
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
