'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  ChevronDown,
  ChevronUp,
  Eye,
  BookOpen,
} from 'lucide-react';
import type { CourseAudit, ChapterAudit, QuestionAudit } from '@/lib/llm/quality-audit';

export default function CourseAuditDetailPage() {
  const { user, loading: authLoading, session } = useAuth();
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;

  const [audit, setAudit] = useState<CourseAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [showSourceText, setShowSourceText] = useState(false);
  const [showFullSource, setShowFullSource] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

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
    if (session?.access_token && courseId) {
      loadAuditData();
    }
  }, [user, authLoading, router, session, courseId]);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/admin/quality-audit?courseId=${courseId}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load audit data');
      }
      setAudit(data.audit);

      // Auto-expand chapters with issues
      const chaptersWithIssues = new Set<string>(
        data.audit.chapterAudits
          .filter((ch: ChapterAudit) => ch.issues.length > 0 || ch.relevanceScore < 60)
          .map((ch: ChapterAudit) => ch.chapterId)
      );
      setExpandedChapters(chaptersWithIssues);
    } catch (err: any) {
      console.error('Error loading audit data:', err);
      setError(err.message || 'Failed to load audit data');
    } finally {
      setLoading(false);
    }
  };

  const toggleChapter = (chapterId: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId);
    } else {
      newExpanded.add(chapterId);
    }
    setExpandedChapters(newExpanded);
  };

  const toggleQuestion = (questionId: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedQuestions(newExpanded);
  };

  const getScoreColor = (score: number) => {
    if (score < 0) return 'text-gray-500 bg-gray-100 border-gray-200'; // N/A
    if (score >= 80) return 'text-green-600 bg-green-100 border-green-200';
    if (score >= 60) return 'text-blue-600 bg-blue-100 border-blue-200';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const getScoreBadge = (score: number) => {
    if (score < 0) return { icon: <HelpCircle className="w-4 h-4" />, label: 'N/A' };
    if (score >= 80) return { icon: <CheckCircle className="w-4 h-4" />, label: 'Excellent' };
    if (score >= 60) return { icon: <CheckCircle className="w-4 h-4" />, label: 'Good' };
    if (score >= 40) return { icon: <AlertTriangle className="w-4 h-4" />, label: 'Fair' };
    return { icon: <XCircle className="w-4 h-4" />, label: 'Poor' };
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
          <p className="text-gray-600">Analyzing course quality...</p>
        </div>
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-8">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/admin/quality"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-orange-600 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Quality Audit
          </Link>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!audit) {
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
          <p className="text-gray-600">Loading audit data...</p>
        </div>
      </div>
    );
  }

  const scoreBadge = getScoreBadge(audit.overallRelevanceScore);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/quality"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-orange-600 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Quality Audit
          </Link>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{audit.title}</h1>
                <p className="text-sm text-gray-500">Course ID: {audit.courseId}</p>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${getScoreColor(audit.overallRelevanceScore)}`}>
                {scoreBadge.icon}
                <span className="font-bold">{getScoreDisplay(audit.overallRelevanceScore)}</span>
                <span className="text-sm">{scoreBadge.label}</span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-900">{audit.chapterCount}</p>
                <p className="text-sm text-gray-500">Chapters</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-900">{audit.totalQuestionCount}</p>
                <p className="text-sm text-gray-500">Questions</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-900">{Math.round(audit.sourceTextLength / 1000)}k</p>
                <p className="text-sm text-gray-500">Source chars</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-600">{audit.summary.questionsWithSourceMatch}</p>
                <p className="text-sm text-gray-500">Source matches</p>
              </div>
            </div>

            {/* Question Quality Breakdown */}
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 mb-3">Question Quality Breakdown</h3>
              <div className="flex gap-2 flex-wrap">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  {audit.summary.excellentQuestions} Excellent
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  {audit.summary.goodQuestions} Good
                </span>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                  {audit.summary.fairQuestions} Fair
                </span>
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                  {audit.summary.poorQuestions} Poor
                </span>
                {audit.summary.ambiguousQuestions > 0 && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                    {audit.summary.ambiguousQuestions} Ambiguous
                  </span>
                )}
              </div>
            </div>

            {/* Recommendations */}
            {audit.recommendations.length > 0 && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Recommendations
                </h3>
                <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                  {audit.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Source Text */}
            <div className="mt-6">
              <button
                onClick={() => setShowSourceText(!showSourceText)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <Eye className="w-4 h-4" />
                {showSourceText ? 'Masquer' : 'Afficher'} le texte source
                {showSourceText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showSourceText && (
                <div className="mt-2">
                  <div className="flex items-center gap-4 mb-2">
                    <button
                      onClick={() => setShowFullSource(false)}
                      className={`px-3 py-1 rounded-lg text-sm transition ${
                        !showFullSource
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Aperçu (500 car.)
                    </button>
                    <button
                      onClick={() => setShowFullSource(true)}
                      className={`px-3 py-1 rounded-lg text-sm transition ${
                        showFullSource
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Texte complet ({Math.round(audit.sourceTextLength / 1000)}k car.)
                    </button>
                  </div>
                  <div className={`p-4 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap overflow-y-auto ${
                    showFullSource ? 'max-h-[600px]' : 'max-h-64'
                  }`}>
                    {showFullSource ? audit.sourceTextFull : audit.sourceTextPreview}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Chapters */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Chapter Analysis</h2>

          {audit.chapterAudits.map((chapter) => (
            <div key={chapter.chapterId} className="bg-white rounded-xl shadow-md overflow-hidden">
              {/* Chapter Header */}
              <button
                onClick={() => toggleChapter(chapter.chapterId)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${getScoreColor(chapter.relevanceScore)}`}>
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">{chapter.title}</h3>
                    <p className="text-sm text-gray-500">
                      {chapter.questionCount} questions | Avg relevance: {getScoreDisplay(chapter.averageQuestionRelevance)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(chapter.relevanceScore)}`}>
                    {getScoreDisplay(chapter.relevanceScore)}
                  </span>
                  {chapter.issues.length > 0 && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                      {chapter.issues.length} issues
                    </span>
                  )}
                  {expandedChapters.has(chapter.chapterId) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Chapter Details */}
              {expandedChapters.has(chapter.chapterId) && (
                <div className="px-6 pb-6 border-t border-gray-100">
                  {/* Chapter Issues */}
                  {chapter.issues.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="font-medium text-red-800 mb-2">Issues</h4>
                      <ul className="list-disc list-inside text-sm text-red-700">
                        {chapter.issues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Chapter Info */}
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Title in source:</span>{' '}
                      {chapter.titleFoundInSource ? (
                        <span className="text-green-600">Yes</span>
                      ) : (
                        <span className="text-red-600">No</span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500">Concepts:</span>{' '}
                      <span className="text-gray-700">{chapter.conceptsCovered.slice(0, 5).join(', ')}</span>
                    </div>
                  </div>

                  {/* Questions */}
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-3">Questions</h4>
                    <div className="space-y-2">
                      {chapter.questionAudits.map((question, qIdx) => (
                        <div
                          key={question.questionId}
                          className={`border rounded-lg overflow-hidden ${
                            question.ambiguityWarnings.length > 0 ? 'border-orange-300' : 'border-gray-200'
                          }`}
                        >
                          <button
                            onClick={() => toggleQuestion(question.questionId)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition text-left"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-sm text-gray-500">Q{qIdx + 1}</span>
                              <p className="text-sm text-gray-700 truncate">{question.prompt}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              {question.ambiguityWarnings.length > 0 && (
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                              )}
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(question.relevanceScore)}`}>
                                {getScoreDisplay(question.relevanceScore)}
                              </span>
                              {expandedQuestions.has(question.questionId) ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                          </button>

                          {expandedQuestions.has(question.questionId) && (
                            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-200">
                              <div className="mt-3">
                                <p className="text-sm font-medium text-gray-700 mb-2">{question.prompt}</p>

                                {/* Options */}
                                <div className="space-y-1">
                                  {question.optionsAnalysis.map((opt, optIdx) => (
                                    <div
                                      key={optIdx}
                                      className={`px-3 py-2 rounded text-sm flex items-center justify-between ${
                                        opt.isCorrect
                                          ? 'bg-green-100 border border-green-300'
                                          : opt.potentiallyValid
                                            ? 'bg-orange-50 border border-orange-300'
                                            : 'bg-white border border-gray-200'
                                      }`}
                                    >
                                      <span>
                                        {String.fromCharCode(65 + optIdx)}. {opt.option}
                                      </span>
                                      <div className="flex items-center gap-2 text-xs">
                                        {opt.isCorrect && (
                                          <span className="text-green-700 font-medium">Correct</span>
                                        )}
                                        {opt.foundInSource ? (
                                          <span className="text-blue-600">In source</span>
                                        ) : (
                                          <span className="text-gray-400">Not in source</span>
                                        )}
                                        {opt.potentiallyValid && !opt.isCorrect && (
                                          <span className="text-orange-600 font-medium">Potentially valid!</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Source Match */}
                                <div className="mt-3 text-sm">
                                  <span className="text-gray-500">Answer in source:</span>{' '}
                                  {question.sourceMatch.found ? (
                                    <span className="text-green-600">
                                      Yes ({question.sourceMatch.confidence}% confidence)
                                    </span>
                                  ) : (
                                    <span className="text-red-600">Not found</span>
                                  )}
                                </div>

                                {question.sourceMatch.matchedText && (
                                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
                                    <span className="font-medium">Context:</span> ...{question.sourceMatch.matchedText}...
                                  </div>
                                )}

                                {/* Ambiguity Warnings */}
                                {question.ambiguityWarnings.length > 0 && (
                                  <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded">
                                    <p className="text-sm font-medium text-orange-800 mb-1">Ambiguity Warnings:</p>
                                    <ul className="list-disc list-inside text-xs text-orange-700">
                                      {question.ambiguityWarnings.map((warning, wIdx) => (
                                        <li key={wIdx}>{warning}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
