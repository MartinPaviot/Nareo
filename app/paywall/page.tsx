'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2, Loader2, Lock, ShieldCheck, Sparkles, TrendingUp, Zap, AlertCircle } from 'lucide-react';
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
  const [acceptedWaiver, setAcceptedWaiver] = useState(false);

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

  const savingsPercent = '30%';

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
          waiverAccepted: acceptedWaiver,
          waiverDate: new Date().toISOString(),
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-3xl w-full bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">

        {/* Header avec mascotte */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 sm:px-8 py-6 flex items-center gap-4">
          <Image
            src="/chat/Happy.png"
            alt="Nareo"
            width={128}
            height={128}
            className="rounded-full bg-white/20 p-1 flex-shrink-0"
          />
          <div className="text-white">
            <h1 className="text-2xl sm:text-3xl font-bold">
              {translate('paywall_title_benefit')}
            </h1>
            <p className="text-orange-100 text-sm sm:text-base mt-1">
              {course ? (
                <>{translate('paywall_subtitle_course')} <span className="font-semibold text-white">{course.title}</span></>
              ) : (
                translate('paywall_subtitle_generic')
              )}
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">

          {/* Grille: Blocs 1 et 2 côte à côte */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">

            {/* Bloc 1: Ce que tu obtiens */}
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                {translate('paywall_section_access')}
              </h2>
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-3 space-y-2 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('paywall_access_1')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('paywall_access_5')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('paywall_access_2')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('paywall_access_3')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('paywall_access_4')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bloc 2: Ce que ça t'apporte */}
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                {translate('paywall_section_benefits')}
              </h2>
              <div className="bg-orange-50 rounded-2xl border border-orange-200 p-3 space-y-2 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('paywall_benefit_1')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('paywall_benefit_2')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('paywall_benefit_3')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{translate('paywall_benefit_4')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sélecteur de plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
            {/* Plan Annuel - Recommandé */}
            <button
              onClick={() => setSelectedPlan('annual')}
              className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 ${
                selectedPlan === 'annual'
                  ? 'border-orange-500 bg-orange-50 shadow-lg shadow-orange-500/10'
                  : 'border-gray-200 bg-white hover:border-orange-300'
              }`}
            >
              {/* Badge Économie */}
              <div className="absolute -top-3 left-4 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                {translate('paywall_save')} {savingsPercent}
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedPlan === 'annual' ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                }`}>
                  {selectedPlan === 'annual' && (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                </div>
                <span className="font-bold text-gray-900">{translate('paywall_plan_annual')}</span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-orange-600">{annualPrice()}</span>
                <span className="text-gray-600">{translate('paywall_price_per_month')}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {translate('paywall_billed_annually')} {annualTotal()}
              </p>
            </button>

            {/* Plan Mensuel */}
            <button
              onClick={() => setSelectedPlan('monthly')}
              className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 ${
                selectedPlan === 'monthly'
                  ? 'border-orange-500 bg-orange-50 shadow-lg shadow-orange-500/10'
                  : 'border-gray-200 bg-white hover:border-orange-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedPlan === 'monthly' ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                }`}>
                  {selectedPlan === 'monthly' && (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                </div>
                <span className="font-bold text-gray-900">{translate('paywall_plan_monthly')}</span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-700">{monthlyPrice()}</span>
                <span className="text-gray-600">{translate('paywall_price_per_month')}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {translate('paywall_billed_monthly')}
              </p>
            </button>
          </div>

          {/* Récapitulatif prix et renouvellement */}
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{translate('paywall_price_summary')}</span>
              <span className="text-lg font-bold text-gray-900">
                {selectedPlan === 'annual' ? annualTotal() : monthlyPrice()}
                <span className="text-sm font-normal text-gray-500">
                  {selectedPlan === 'annual' ? ` ${translate('paywall_per_year')}` : ` ${translate('paywall_per_month')}`}
                </span>
              </span>
            </div>
            <div className="flex items-start gap-2 text-xs text-gray-500">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{translate('paywall_auto_renewal')}</span>
            </div>
          </div>

          {/* Checkboxes légales obligatoires */}
          <div className="space-y-4">
            {/* CGV Checkbox */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="acceptCGV"
                checked={acceptedCGV}
                onChange={(e) => setAcceptedCGV(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <label htmlFor="acceptCGV" className="text-sm text-gray-600">
                {translate('paywall_cgv_label')}{' '}
                <Link href="/cgv" className="text-orange-500 hover:text-orange-600 underline" target="_blank">
                  {translate('paywall_cgv_link')}
                </Link>
                <span className="text-red-500">*</span>
              </label>
            </div>

            {/* Renonciation au droit de rétractation */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="acceptWaiver"
                checked={acceptedWaiver}
                onChange={(e) => setAcceptedWaiver(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <label htmlFor="acceptWaiver" className="text-sm text-gray-600">
                {translate('paywall_waiver_label')}
                <span className="text-red-500">*</span>
              </label>
            </div>
          </div>

          {/* CTA Principal */}
          <div className="text-center">
            <button
              onClick={handleCheckout}
              disabled={processingPayment || !acceptedCGV || !acceptedWaiver}
              className="w-full max-w-md mx-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-orange-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-orange-500/30"
            >
              {processingPayment ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
              {user ? translate('paywall_cta_subscribe') : translate('result_cta_unlock_chapter_two')}
            </button>
            {(!acceptedCGV || !acceptedWaiver) && (
              <p className="text-xs text-gray-500 mt-2">
                {translate('paywall_checkbox_required')}
              </p>
            )}
          </div>

          {/* Pastilles de réassurance animées */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-700 animate-pulse">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              {translate('paywall_sub_monthly')}
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-700 animate-pulse" style={{ animationDelay: '0.5s' }}>
              <ShieldCheck className="w-4 h-4 text-green-500" />
              {translate('paywall_sub_cancel')}
            </span>
          </div>

          {/* Lien secondaire */}
          <div className="text-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-500 hover:text-orange-600 transition-colors"
            >
              {translate('paywall_back_dashboard')}
            </button>
          </div>

          {/* Mention légale */}
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            {translate('paywall_legal')}
          </p>
        </div>
      </div>
    </div>
  );
}
