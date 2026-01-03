'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Check, Loader2, ArrowRight, Shield, ArrowLeft } from 'lucide-react';
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
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [acceptedCGV, setAcceptedCGV] = useState(false);

  useEffect(() => {
    if (user) {
      trackEvent('paywall_viewed', { userId: user.id, courseId: courseId || 'account' });
    }
    if (courseId) {
      loadCourseData();
    }
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

  const monthlyPrice = () => {
    switch (currentLanguage) {
      case 'fr':
      case 'de':
        return '9,99 €';
      default:
        return '$9.99';
    }
  };

  const annualPrice = () => {
    switch (currentLanguage) {
      case 'fr':
      case 'de':
        return '6,99 €';
      default:
        return '$6.99';
    }
  };

  const annualTotal = () => {
    switch (currentLanguage) {
      case 'fr':
      case 'de':
        return '83,88 €';
      default:
        return '$83.88';
    }
  };

  const originalAnnualTotal = () => {
    switch (currentLanguage) {
      case 'fr':
      case 'de':
        return '119,88 €';
      default:
        return '$119.88';
    }
  };

  const savingsPercent = '30%';

  const savingsAmount = () => {
    switch (currentLanguage) {
      case 'fr':
      case 'de':
        return '36 €';
      default:
        return '$36';
    }
  };

  const handleCheckout = async () => {
    if (!user) {
      router.push('/auth/signup');
      return;
    }

    setProcessingPayment(true);
    trackEvent('payment_started', { userId: user.id, courseId: courseId || 'account', plan: selectedPlan });
    try {
      const response = await fetch('/api/payment/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: courseId || 'account',
          plan: selectedPlan,
          successUrl: courseId
            ? `${window.location.origin}/courses/${courseId}/learn?payment=success`
            : `${window.location.origin}/compte?payment=success`,
          cancelUrl: courseId
            ? `${window.location.origin}/paywall?courseId=${courseId}&payment=cancelled`
            : `${window.location.origin}/paywall?payment=cancelled`,
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

  if (loading && courseId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo"
            width={400}
            height={400}
            className="mx-auto mb-4 animate-bounce"
          />
          <p className="text-gray-600">{translate('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-lg w-full">
        {/* Card principale */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Bouton retour */}
          <div className="px-4 pt-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              {translate('back')}
            </button>
          </div>

          {/* Header minimaliste */}
          <div className="px-6 sm:px-8 pt-4 pb-6 text-center border-b border-gray-100">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
              {translate('paywall_title_benefit')}
            </h1>
            <p className="text-gray-500 mt-2">
              {translate('paywall_subtitle_generic')}
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">

            {/* Liste des fonctionnalités */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center mt-0.5">
                  <Check className="w-3 h-3 text-orange-600" />
                </div>
                <span className="text-sm text-gray-600">{translate('paywall_access_1')}</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center mt-0.5">
                  <Check className="w-3 h-3 text-orange-600" />
                </div>
                <span className="text-sm text-gray-600">{translate('paywall_access_2')}</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center mt-0.5">
                  <Check className="w-3 h-3 text-orange-600" />
                </div>
                <span className="text-sm text-gray-600">{translate('paywall_access_3')}</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center mt-0.5">
                  <Check className="w-3 h-3 text-orange-600" />
                </div>
                <span className="text-sm text-gray-600">{translate('paywall_access_4')}</span>
              </div>
            </div>

            {/* Sélecteur de plans */}
            <div className="space-y-3 pt-2">
              {/* Plan Annuel */}
              <button
                onClick={() => setSelectedPlan('annual')}
                className={`relative w-full p-4 rounded-xl border-2 text-left transition-all ${
                  selectedPlan === 'annual'
                    ? 'bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={selectedPlan === 'annual' ? { borderColor: '#ff751f' } : {}}
              >
                <span className="absolute -top-2.5 left-4 px-2 py-0.5 text-white text-xs font-medium rounded" style={{ backgroundColor: '#ff751f' }}>
                  {translate('paywall_recommended')}
                </span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedPlan === 'annual' ? '' : 'border-gray-300'
                      }`}
                      style={selectedPlan === 'annual' ? { borderColor: '#ff751f', backgroundColor: '#ff751f' } : {}}
                    >
                      {selectedPlan === 'annual' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{translate('paywall_plan_annual')}</span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded" style={{ backgroundColor: 'rgba(55, 159, 90, 0.15)', color: '#379f5a' }}>-{savingsPercent}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400 line-through">{originalAnnualTotal()}</span>
                        <span className="text-gray-700 font-medium">{annualTotal()}</span>
                        <span style={{ color: '#379f5a' }}>— {translate('paywall_you_save')} {savingsAmount()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold text-gray-900">{annualPrice()}</span>
                    <span className="text-sm text-gray-500">{translate('paywall_price_per_month')}</span>
                  </div>
                </div>
              </button>

              {/* Plan Mensuel */}
              <button
                onClick={() => setSelectedPlan('monthly')}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  selectedPlan === 'monthly'
                    ? 'bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300 opacity-75'
                }`}
                style={selectedPlan === 'monthly' ? { borderColor: '#ff751f' } : {}}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedPlan === 'monthly' ? '' : 'border-gray-300'
                      }`}
                      style={selectedPlan === 'monthly' ? { borderColor: '#ff751f', backgroundColor: '#ff751f' } : {}}
                    >
                      {selectedPlan === 'monthly' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">{translate('paywall_plan_monthly')}</span>
                      <p className="text-xs text-gray-500">{translate('paywall_billed_monthly')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold text-gray-900">{monthlyPrice()}</span>
                    <span className="text-sm text-gray-500">{translate('paywall_price_per_month')}</span>
                  </div>
                </div>
              </button>
            </div>

            {/* CGV Checkbox */}
            <div className="flex items-start gap-3 pt-2">
              <input
                type="checkbox"
                id="acceptCGV"
                checked={acceptedCGV}
                onChange={(e) => setAcceptedCGV(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <label htmlFor="acceptCGV" className="text-sm text-gray-500">
                {translate('paywall_cgv_label')}{' '}
                <Link href="/cgv" className="text-orange-600 hover:underline" target="_blank">
                  {translate('paywall_cgv_link')}
                </Link>
              </label>
            </div>

            {/* CTA */}
            <button
              onClick={handleCheckout}
              disabled={processingPayment || !acceptedCGV}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: '#ff751f' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#e5681b')}
              onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#ff751f')}
            >
              {processingPayment ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {translate('paywall_cta_subscribe')}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Réassurance */}
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-xs text-gray-500 font-medium">{translate('paywall_social_proof')}</p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  {translate('paywall_sub_cancel')}
                </span>
                <span>•</span>
                <span>{translate('paywall_sub_monthly')}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
