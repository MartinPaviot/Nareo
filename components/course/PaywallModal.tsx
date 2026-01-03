'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, ArrowRight, Shield, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { trackEvent } from '@/lib/posthog';

interface PaywallModalProps {
  courseId: string;
  courseTitle?: string;
  onClose: () => void;
}

export default function PaywallModal({ courseId, courseTitle, onClose }: PaywallModalProps) {
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
    if (!courseId) return;
    if (!user) {
      router.push('/auth/signup');
      return;
    }

    setProcessingPayment(true);
    trackEvent('payment_started', { userId: user.id, courseId, plan: selectedPlan });
    try {
      const response = await fetch('/api/payment/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          plan: selectedPlan,
          successUrl: `${window.location.origin}/courses/${courseId}/learn?payment=success`,
          cancelUrl: `${window.location.origin}/courses/${courseId}/learn?payment=cancelled`,
        }),
      });
      const data = await response.json();

      // Check if user already has a subscription
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
      <div className="relative max-w-lg w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden my-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header minimaliste */}
        <div className="px-6 sm:px-8 pt-8 pb-6 text-center border-b border-gray-100">
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

          {/* CTA */}
          <button
            onClick={handleCheckout}
            disabled={processingPayment}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: '#ff751f' }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#e5681b')}
            onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#ff751f')}
          >
            {processingPayment ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {user ? translate('paywall_cta_subscribe') : translate('result_cta_unlock_chapter_two')}
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
  );
}
