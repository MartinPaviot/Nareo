'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Trophy, Unlock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { loadDemoCourse } from '@/lib/demoCourse';

interface ChapterMeta {
  id: string;
  order_index: number;
}

export default function ChapterResultPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { translate } = useLanguage();

  const courseId = params?.courseId as string;
  const chapterId = params?.chapterId as string;
  const isDemoId = courseId?.startsWith('demo-');

  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterIndex, setChapterIndex] = useState<number | null>(null);
  const [accessTier, setAccessTier] = useState<string | null>(null);

  useEffect(() => {
    hydrateFromStorage();
    fetchMeta();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, courseId]);

  const hydrateFromStorage = () => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem(`levelup_result_${chapterId}`);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      setScore(parsed.score || 0);
      setTotalQuestions(parsed.totalQuestions || 0);
      setCorrect(parsed.correct || 0);
      setChapterTitle(parsed.chapterTitle || '');
    } catch (error) {
      console.error('Failed to parse stored result', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      if (isDemoId) {
        const demo = loadDemoCourse(courseId);
        const ch = demo?.chapters.find((c) => c.id === chapterId);
        if (demo && ch) {
          setChapterIndex(demo.chapters.findIndex((c) => c.id === chapterId));
          setChapterTitle((prev) => prev || ch.title);
        }
        setAccessTier(null);
        return;
      }

      const response = await fetch(`/api/courses/${courseId}/chapters`);
      if (!response.ok) {
        throw new Error('Failed to load course');
      }
      const data = await response.json();
      const target = (data.chapters as ChapterMeta[]).find((c) => c.id === chapterId);
      if (target) {
        setChapterIndex(target.order_index);
      }
      setChapterTitle((prev) => prev || data.chapters.find((c: any) => c.id === chapterId)?.title || '');
      setAccessTier(data.access_tier);
    } catch (error) {
      console.error('Error loading course meta', error);
    } finally {
      setLoading(false);
    }
  };

  const strengths = useMemo(() => {
    if (!totalQuestions) return translate('result_strengths');
    const ratio = totalQuestions ? correct / totalQuestions : 0;
    if (ratio >= 0.8) return translate('recap_excellent');
    if (ratio >= 0.5) return translate('recap_good');
    return translate('recap_needs_work');
  }, [correct, totalQuestions, translate]);

  const handleRepeat = () => {
    router.push(`/courses/${courseId}/chapters/${chapterId}`);
  };

  const handleUnlock = () => {
    router.push('/auth/signup');
  };

  const handlePaywall = () => {
    router.push(`/paywall?courseId=${courseId}`);
  };

  const renderCTA = () => {
    if (chapterIndex === 0 && !user) {
      return (
        <button
          onClick={handleUnlock}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600"
        >
          <Unlock className="w-5 h-5" />
          {translate('result_cta_unlock_chapter_two')}
        </button>
      );
    }

    if (chapterIndex !== null && chapterIndex < 2 && user) {
      return (
        <button
          onClick={handleRepeat}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-black"
        >
          {translate('result_cta_repeat')}
        </button>
      );
    }

    if (chapterIndex !== null && chapterIndex >= 2 && accessTier !== 'paid') {
      return (
        <button
          onClick={handlePaywall}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600"
        >
          {translate('result_cta_paywall')}
        </button>
      );
    }

    return (
      <button
        onClick={handleRepeat}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-black"
      >
        {translate('result_cta_repeat')}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{translate('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white rounded-3xl border border-gray-200 shadow-lg p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-orange-600" />
          <div>
            <p className="text-xs uppercase tracking-wide text-orange-600 font-semibold">
              {translate('result_title')}
            </p>
            <h1 className="text-2xl font-bold text-gray-900">{chapterTitle}</h1>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-center">
            <p className="text-xs text-gray-600">{translate('result_score_label')}</p>
            <p className="text-3xl font-bold text-orange-600">{score}</p>
            <p className="text-xs text-gray-500">{translate('learn_pts')}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center">
            <p className="text-xs text-gray-600">{translate('learn_question')}</p>
            <p className="text-3xl font-bold text-gray-900">
              {correct}/{totalQuestions}
            </p>
            <p className="text-xs text-gray-500">{translate('result_strengths')}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center">
            <p className="text-xs text-gray-600">{translate('result_weaknesses')}</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{strengths}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
          {translate('result_note')}
        </div>

        {renderCTA()}

        <div className="text-center">
          <button
            onClick={() => router.push(`/courses/${courseId}/learn`)}
            className="text-sm text-gray-600 hover:text-orange-600 inline-flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            {translate('chapter_completed')}
          </button>
        </div>
      </div>
    </div>
  );
}
