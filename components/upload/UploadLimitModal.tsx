'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Calendar, CheckCircle2, Loader2, Lock, ShieldCheck, Sparkles, TrendingUp, X, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { trackEvent } from '@/lib/posthog';

// Calculate the first day of next month (when free uploads renew)
function getNextRenewalDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

interface UploadLimitModalProps {
  onClose: () => void;
}

export default function UploadLimitModal({ onClose }: UploadLimitModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { translate, currentLanguage } = useLanguage();

  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');

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

  // Format renewal date
  const renewalDate = getNextRenewalDate();
  const formattedRenewalDate = renewalDate.toLocaleDateString(
    currentLanguage === 'fr' ? 'fr-FR' : currentLanguage === 'de' ? 'de-DE' : 'en-US',
    { day: 'numeric', month: 'long' }
  );

  const handleCheckout = async () => {
    if (!user) {
      router.push('/auth/signup');
      return;
    }

    setProcessingPayment(true);
    trackEvent('payment_started_upload_limit', { userId: user.id, plan: selectedPlan });
    try {
      const response = await fetch('/api/payment/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: 'upload-limit',
          plan: selectedPlan,
          successUrl: `${window.location.origin}/dashboard?payment=success`,
          cancelUrl: `${window.location.origin}/dashboard?payment=cancelled`,
        }),
      });
      const data = await response.json();

      if (data.alreadySubscribed) {
        alert(translate('paywall_already_subscribed'));
        setProcessingPayment(false);
        onClose();
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'No checkout URL returned');
      }
    } catch (error) {
      console.error('Error creating checkout', error);
      setProcessingPayment(false);
      alert(translate('paywall_error'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="relative max-w-3xl w-full bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden my-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 transition-colors shadow-md"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header avec mascotte */}
        <div className="px-6 sm:px-8 py-6 flex items-center gap-4" style={{ background: 'linear-gradient(to right, #ff751f, #e5681b)' }}>
          <Image
            src="/chat/Happy.png"
            alt="Nareo"
            width={128}
            height={128}
            className="rounded-full bg-white/20 p-1 flex-shrink-0"
          />
          <div className="text-white pr-8">
            <h1 className="text-2xl sm:text-3xl font-bold">
              {translate('upload_limit_title')}
            </h1>
            <p className="text-orange-100 text-sm sm:text-base mt-1">
              {translate('upload_limit_subtitle')}
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Message explicatif */}
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
            <p className="text-gray-700">
              {translate('upload_limit_description')}
            </p>
          </div>

          {/* Date de renouvellement */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {translate('upload_limit_or_wait')}
                </p>
                <p className="text-blue-700 font-semibold">
                  {translate('upload_limit_renewal').replace('{date}', formattedRenewalDate)}
                </p>
              </div>
            </div>
          </div>

          {/* Grille: Blocs 1 et 2 côte à côte */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">

            {/* Bloc 1: Comment Nareo t'aide vraiment (bénéfices) */}
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

            {/* Bloc 2: Ton accès complet inclut (features) */}
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                {translate('paywall_section_access')}
              </h2>
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-3 space-y-2 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#379f5a' }} />
                    <span className="text-sm text-gray-700">{translate('paywall_access_1')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#379f5a' }} />
                    <span className="text-sm text-gray-700">{translate('paywall_access_5')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#379f5a' }} />
                    <span className="text-sm text-gray-700">{translate('paywall_access_2')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#379f5a' }} />
                    <span className="text-sm text-gray-700">{translate('paywall_access_3')}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#379f5a' }} />
                    <span className="text-sm text-gray-700">{translate('paywall_access_4')}</span>
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
                  ? 'bg-orange-50 shadow-lg'
                  : 'border-gray-200 bg-white hover:border-orange-300'
              }`}
              style={selectedPlan === 'annual' ? { borderColor: '#ff751f', boxShadow: '0 10px 15px -3px rgba(255, 117, 31, 0.1)' } : {}}
            >
              {/* Badge Économie */}
              <div className="absolute -top-3 left-4 px-3 py-1 text-white text-xs font-bold rounded-full" style={{ backgroundColor: '#379f5a' }}>
                {translate('paywall_save')} {savingsPercent}
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedPlan === 'annual' ? '' : 'border-gray-300'
                  }`}
                  style={selectedPlan === 'annual' ? { borderColor: '#ff751f', backgroundColor: '#ff751f' } : {}}
                >
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
                  ? 'bg-orange-50 shadow-lg'
                  : 'border-gray-200 bg-white hover:border-orange-300'
              }`}
              style={selectedPlan === 'monthly' ? { borderColor: '#ff751f', boxShadow: '0 10px 15px -3px rgba(255, 117, 31, 0.1)' } : {}}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedPlan === 'monthly' ? '' : 'border-gray-300'
                  }`}
                  style={selectedPlan === 'monthly' ? { borderColor: '#ff751f', backgroundColor: '#ff751f' } : {}}
                >
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

          {/* CTA Principal */}
          <div className="text-center">
            <button
              onClick={handleCheckout}
              disabled={processingPayment}
              className="w-full max-w-md mx-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-white font-bold text-lg disabled:opacity-60 shadow-lg transition-all duration-200"
              style={{ backgroundColor: '#ff751f', boxShadow: '0 10px 15px -3px rgba(255, 117, 31, 0.25)' }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#e5681b';
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(255, 117, 31, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#ff751f';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(255, 117, 31, 0.25)';
                }
              }}
            >
              {processingPayment ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
              {translate('upload_limit_cta')}
            </button>
          </div>

          {/* Pastilles de réassurance */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
              <CheckCircle2 className="w-4 h-4" style={{ color: '#379f5a' }} />
              {translate('paywall_sub_monthly')}
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
              <ShieldCheck className="w-4 h-4" style={{ color: '#379f5a' }} />
              {translate('paywall_sub_cancel')}
            </span>
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
