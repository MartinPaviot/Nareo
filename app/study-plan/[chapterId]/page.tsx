'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedChapterTitle } from '@/lib/content-translator';
import AuthGuard from '@/components/auth/AuthGuard';
import NareoAvatar from '@/components/chat/NareoAvatar';
import Image from 'next/image';
import LanguageToggle from '@/components/layout/LanguageToggle';
import SignOutButton from '@/components/layout/SignOutButton';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Target, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp,
  Loader2,
  Download,
  Lightbulb
} from 'lucide-react';

interface Chapter {
  id: string;
  title: string;
  summary: string;
  englishTitle: string;
  englishDescription: string;
  frenchTitle: string;
  frenchDescription: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questions: any[];
  sourceText: string;
}

interface StudyPlan {
  summary: string;
  diagnostic: {
    strongAreas: string[];
    weakAreas: string[];
    criticalGaps: string[];
  };
  dailySchedule: Array<{
    day: number;
    date: string;
    focus: string;
    activities: Array<{
      time: string;
      activity: string;
      description: string;
      documentReference: string;
    }>;
    goals: string[];
  }>;
  documentReferences: Array<{
    topic: string;
    location: string;
    importance: string;
    reviewPriority: 'high' | 'medium' | 'low';
  }>;
  studyTips: string[];
}

function StudyPlanPage() {
  const router = useRouter();
  const params = useParams();
  const { translate, currentLanguage } = useLanguage();
  const chapterId = params.chapterId as string;

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);

  // Form state
  const [examDate, setExamDate] = useState('');
  const [dailyTime, setDailyTime] = useState(60);
  const [objective, setObjective] = useState('');

  useEffect(() => {
    loadChapter();
  }, [chapterId]);

  const loadChapter = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/chapters');
      if (response.ok) {
        const data = await response.json();
        const foundChapter = data.chapters.find((c: Chapter) => c.id === chapterId);
        if (foundChapter) {
          setChapter(foundChapter);
        } else {
          setError('Chapter not found');
        }
      }
    } catch (err) {
      console.error('Error loading chapter:', err);
      setError('Failed to load chapter');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!examDate) {
      setError(translate('study_plan_validation_date'));
      return false;
    }

    const exam = new Date(examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (exam <= today) {
      setError(translate('study_plan_validation_future'));
      return false;
    }

    if (!dailyTime || dailyTime < 15 || dailyTime > 480) {
      setError(translate('study_plan_validation_time'));
      return false;
    }

    if (!objective) {
      setError(translate('study_plan_validation_objective'));
      return false;
    }

    return true;
  };

  const handleGeneratePlan = async () => {
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setGenerating(true);

      const response = await fetch('/api/study-plan/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chapterId,
          examDate,
          dailyTime,
          objective,
          language: currentLanguage.toUpperCase(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate study plan');
      }

      const data = await response.json();
      setStudyPlan(data.studyPlan);
    } catch (err) {
      console.error('Error generating study plan:', err);
      setError(err instanceof Error ? err.message : translate('study_plan_error'));
    } finally {
      setGenerating(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-[#d91a1c]/10 text-[#b91c1c] border-[#d91a1c]/20';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo"
            width={400}
            height={400}
            className="mx-auto mb-4 animate-bounce"
          />
          <p className="text-gray-600">{translate('study_plan_loading')}</p>
        </div>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#d91a1c' }} />
          <p className="text-gray-600">{error || 'Chapter not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            {translate('study_plan_back')}
          </button>
        </div>
      </div>
    );
  }

  const localizedTitle = getLocalizedChapterTitle(chapter, currentLanguage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <NareoAvatar state="happy" size="md" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {translate('study_plan_title')}
                </h1>
                <p className="text-sm text-gray-600">
                  {localizedTitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {!studyPlan ? (
          /* Form Section */
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {translate('study_plan_form_title')}
              </h2>
              <p className="text-gray-600">
                {translate('study_plan_subtitle')}
              </p>
            </div>

            {error && (
              <div
                className="mb-6 p-4 rounded-lg flex items-start gap-3 border"
                style={{
                  backgroundColor: '#fff6f3',
                  borderColor: 'rgba(217, 26, 28, 0.2)'
                }}
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#d91a1c' }} />
                <p className="text-sm" style={{ color: '#b91c1c' }}>{error}</p>
              </div>
            )}

            <div className="space-y-6">
              {/* Exam Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  {translate('study_plan_exam_date')}
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={translate('study_plan_exam_date_placeholder')}
                />
              </div>

              {/* Daily Time */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-2" />
                  {translate('study_plan_daily_time')}
                </label>
                <input
                  type="number"
                  value={dailyTime}
                  onChange={(e) => setDailyTime(parseInt(e.target.value))}
                  min={15}
                  max={480}
                  step={15}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={translate('study_plan_daily_time_placeholder')}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {translate('study_plan_daily_time_helper')}
                </p>
              </div>

              {/* Objective */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Target className="w-4 h-4 inline mr-2" />
                  {translate('study_plan_objective')}
                </label>
                <select
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{translate('study_plan_objective_placeholder')}</option>
                  <option value="Review Everything">{translate('study_plan_objective_all')}</option>
                  <option value="Fill My Gaps">{translate('study_plan_objective_gaps')}</option>
                  <option value="Maximize My Score">{translate('study_plan_objective_maximize')}</option>
                </select>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGeneratePlan}
                disabled={generating}
                className="w-full px-6 py-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {translate('study_plan_generating')}
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    {translate('study_plan_generate')}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Study Plan Display */
          <div className="space-y-6">
            {/* Summary Section */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {translate('study_plan_summary_title')}
                </h2>
              </div>
              <p className="text-gray-700 leading-relaxed">{studyPlan.summary}</p>
            </div>

            {/* Diagnostic Section */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {translate('study_plan_diagnostic_title')}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Strong Areas */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-green-900">
                      {translate('study_plan_strong_areas')}
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {studyPlan.diagnostic.strongAreas.map((area, idx) => (
                      <li key={idx} className="text-sm text-green-800 flex items-start gap-2">
                        <span className="text-green-600 mt-1">•</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Weak Areas */}
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <h3 className="font-semibold text-yellow-900">
                      {translate('study_plan_weak_areas')}
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {studyPlan.diagnostic.weakAreas.map((area, idx) => (
                      <li key={idx} className="text-sm text-yellow-800 flex items-start gap-2">
                        <span className="text-yellow-600 mt-1">•</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Critical Gaps */}
                <div
                  className="p-4 rounded-lg border"
                  style={{
                    backgroundColor: '#fff6f3',
                    borderColor: 'rgba(217, 26, 28, 0.2)'
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5" style={{ color: '#d91a1c' }} />
                    <h3 className="font-semibold" style={{ color: '#991b1b' }}>
                      {translate('study_plan_critical_gaps')}
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {studyPlan.diagnostic.criticalGaps.map((gap, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2" style={{ color: '#991b1b' }}>
                        <span className="mt-1" style={{ color: '#d91a1c' }}>•</span>
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Daily Schedule */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-orange-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {translate('study_plan_daily_schedule_title')}
                  </h2>
                </div>
                <span className="text-sm text-gray-600">
                  {studyPlan.dailySchedule.length} {translate('study_plan_days_until_exam')}
                </span>
              </div>

              <div className="space-y-4">
                {studyPlan.dailySchedule.map((day, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {translate('study_plan_day')} {day.day}
                        </h3>
                        <p className="text-sm text-gray-600">{day.date}</p>
                      </div>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {day.focus}
                      </span>
                    </div>

                    <div className="space-y-3 mb-3">
                      {day.activities.map((activity, actIdx) => (
                        <div key={actIdx} className="pl-4 border-l-2 border-blue-200">
                          <div className="flex items-start gap-3">
                            <Clock className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900">{activity.activity}</span>
                                <span className="text-xs text-gray-500">({activity.time})</span>
                              </div>
                              <p className="text-sm text-gray-600 mb-1">{activity.description}</p>
                              <p className="text-xs text-blue-600">
                                📖 {activity.documentReference}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {day.goals && day.goals.length > 0 && (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Goals:</p>
                        <ul className="space-y-1">
                          {day.goals.map((goal, goalIdx) => (
                            <li key={goalIdx} className="text-xs text-gray-600 flex items-start gap-2">
                              <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{goal}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Document References */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {translate('study_plan_references_title')}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studyPlan.documentReferences.map((ref, idx) => (
                  <div key={idx} className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{ref.topic}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(ref.reviewPriority)}`}>
                        {ref.reviewPriority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{ref.location}</p>
                    <p className="text-xs text-gray-500">{ref.importance}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Study Tips */}
            {studyPlan.studyTips && studyPlan.studyTips.length > 0 && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Lightbulb className="w-6 h-6 text-yellow-600" />
                  <h2 className="text-xl font-bold text-gray-900">Study Tips</h2>
                </div>
                <ul className="space-y-2">
                  {studyPlan.studyTips.map((tip, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-yellow-600 mt-1">💡</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                {translate('study_plan_back')}
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                {translate('study_plan_export_pdf')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProtectedStudyPlanPage() {
  return (
    <AuthGuard>
      <StudyPlanPage />
    </AuthGuard>
  );
}
