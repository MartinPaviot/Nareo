'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { trackEvent } from '@/lib/posthog';

interface Course {
  id: string;
  title: string;
  chapter_count: number;
}

export default function PaywallPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { translate, currentLanguage } = useLanguage();
  const courseId = searchParams?.get('courseId');

  const [loading, setLoading] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    if (user && courseId) {
      trackEvent('paywall_viewed', { userId: user.id, courseId });
    }
    loadCourseData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, user]);

  const loadCourseData = async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      const response = await fetch('/api/courses');
      const data = await response.json();
      const found = data.courses?.find((c: any) => c.id === courseId);
      if (found) {
        setCourse({
          id: found.id,
          title: found.title,
          chapter_count: found.chapter_count,
        });
      }
    } catch (error) {
      console.error('Error loading course', error);
    } finally {
      setLoading(false);
    }
  };

  const priceLabel = () => {
    switch (currentLanguage) {
      case 'fr':
        return '9,99 €';
      case 'de':
        return '9,99 €';
      default:
        return '$9.99';
    }
  };

  const handleCheckout = async () => {
    if (!courseId) return;
    if (!user) {
      router.push('/auth/signup');
      return;
    }

    setProcessingPayment(true);
    trackEvent('payment_started', { userId: user.id, courseId });
    try {
      const response = await fetch('/api/payment/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          successUrl: `${window.location.origin}/courses/${courseId}/learn?payment=success`,
          cancelUrl: `${window.location.origin}/paywall?courseId=${courseId}&payment=cancelled`,
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Error creating checkout', error);
      setProcessingPayment(false);
      alert('Payment failed. Please try again.');
    }
  };

  if (!courseId) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-3xl border border-gray-200 shadow-lg p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Lock className="w-6 h-6 text-orange-600" />
          <div>
            <p className="text-xs uppercase tracking-wide text-orange-600 font-semibold">
              {translate('paywall_reminder')}
            </p>
            <h1 className="text-2xl font-bold text-gray-900">
              {translate('paywall_title')}
            </h1>
            <p className="text-sm text-gray-600">{course?.title}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-800">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            {translate('paywall_includes')}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-800">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            {translate('course_detail_lock_three')}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-800">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            {translate('paywall_supporting')}
          </div>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-center">
          <p className="text-sm text-orange-700">{translate('paywall_price')}</p>
          <p className="text-4xl font-bold text-orange-600">{priceLabel()}</p>
          <p className="text-xs text-orange-700 mt-1">{translate('paywall_subtitle')}</p>
        </div>

        <button
          onClick={handleCheckout}
          disabled={processingPayment}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-60"
        >
          {processingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
          {user ? translate('paywall_cta') : translate('result_cta_unlock_chapter_two')}
        </button>

        <div className="text-center">
          <button
            onClick={() => router.push(`/courses/${courseId}/learn`)}
            className="text-sm text-gray-600 hover:text-orange-600"
          >
            {translate('sidebar_dashboard')}
          </button>
        </div>
      </div>
    </div>
  );
}
