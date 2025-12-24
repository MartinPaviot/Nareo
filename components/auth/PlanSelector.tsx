'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle2, Crown, Sparkles, Zap, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface PlanSelectorProps {
  onSelectFree: () => void;
  returnTo?: string;
}

export default function PlanSelector({ onSelectFree, returnTo = '/' }: PlanSelectorProps) {
  const router = useRouter();
  const { translate, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);

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

  const handleSelectPremium = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch('/api/payment/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: 'account',
          plan: selectedBilling,
          waiverAccepted: true,
          waiverDate: new Date().toISOString(),
          successUrl: `${window.location.origin}${returnTo}?payment=success`,
          cancelUrl: `${window.location.origin}/auth/signup?step=plan&payment=cancelled`,
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
      setLoading(false);
      alert(translate('paywall_error'));
    }
  };

  const freeFeatures = [
    translate('signup_plan_free_feature_1'),
    translate('signup_plan_free_feature_2'),
    translate('signup_plan_free_feature_3'),
  ];

  const premiumFeatures = [
    translate('signup_plan_premium_feature_1'),
    translate('signup_plan_premium_feature_2'),
    translate('signup_plan_premium_feature_3'),
    translate('signup_plan_premium_feature_4'),
  ];

  return (
    <div className={cn(
      'min-h-screen flex items-center justify-center p-4',
      isDark
        ? 'bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900'
        : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'
    )}>
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Image
            src="/chat/Happy.png"
            alt="Nareo"
            width={120}
            height={120}
            className="mx-auto mb-4"
          />
          <h1 className={cn('text-3xl font-bold mb-2', isDark ? 'text-gray-100' : 'text-gray-900')}>
            {translate('signup_plan_title')}
          </h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>{translate('signup_plan_subtitle')}</p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free Plan */}
          <div className={cn(
            'rounded-2xl border-2 p-6 shadow-lg transition-all',
            isDark
              ? 'bg-neutral-800 border-gray-700 hover:border-gray-600'
              : 'bg-white border-gray-200 hover:border-gray-300'
          )}>
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              )}>
                <Zap className={cn('w-6 h-6', isDark ? 'text-gray-400' : 'text-gray-600')} />
              </div>
              <div>
                <h2 className={cn('text-xl font-bold', isDark ? 'text-gray-100' : 'text-gray-900')}>{translate('signup_plan_free_title')}</h2>
                <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>{translate('signup_plan_free_desc')}</p>
              </div>
            </div>

            <div className="mb-6">
              <span className={cn('text-4xl font-bold', isDark ? 'text-gray-100' : 'text-gray-900')}>0€</span>
              <span className={cn('ml-1', isDark ? 'text-gray-400' : 'text-gray-500')}>{translate('paywall_price_per_month')}</span>
            </div>

            <ul className="space-y-3 mb-6">
              {freeFeatures.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle2 className={cn('w-5 h-5 flex-shrink-0 mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')} />
                  <span className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={onSelectFree}
              className={cn(
                'w-full py-3 px-4 rounded-xl border-2 font-semibold transition-all',
                isDark
                  ? 'border-gray-600 text-gray-300 hover:bg-neutral-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              {translate('signup_plan_free_cta')}
            </button>
          </div>

          {/* Premium Plan */}
          <div className={cn(
            'relative rounded-2xl border-2 border-orange-500 p-6 shadow-xl',
            isDark ? 'bg-neutral-800' : 'bg-white'
          )}>
            {/* Popular Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-orange-500 text-white text-sm font-bold rounded-full">
              {translate('signup_plan_premium_badge')}
            </div>

            <div className="flex items-center gap-3 mb-4 mt-2">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                isDark ? 'bg-orange-900/30' : 'bg-orange-100'
              )}>
                <Crown className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h2 className={cn('text-xl font-bold', isDark ? 'text-gray-100' : 'text-gray-900')}>{translate('signup_plan_premium_title')}</h2>
                <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>{translate('signup_plan_premium_desc')}</p>
              </div>
            </div>

            {/* Billing Toggle */}
            <div className={cn('rounded-xl p-1 flex mb-4', isDark ? 'bg-neutral-700' : 'bg-gray-100')}>
              <button
                onClick={() => setSelectedBilling('monthly')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                  selectedBilling === 'monthly'
                    ? isDark
                      ? 'bg-neutral-600 text-gray-100 shadow'
                      : 'bg-white text-gray-900 shadow'
                    : isDark
                      ? 'text-gray-400 hover:text-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {translate('paywall_plan_monthly')}
              </button>
              <button
                onClick={() => setSelectedBilling('annual')}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1',
                  selectedBilling === 'annual'
                    ? isDark
                      ? 'bg-neutral-600 text-gray-100 shadow'
                      : 'bg-white text-gray-900 shadow'
                    : isDark
                      ? 'text-gray-400 hover:text-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {translate('paywall_plan_annual')}
                <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">
                  -30%
                </span>
              </button>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-orange-600">
                {selectedBilling === 'annual' ? annualPrice() : monthlyPrice()}
              </span>
              <span className={cn('ml-1', isDark ? 'text-gray-400' : 'text-gray-500')}>{translate('paywall_price_per_month')}</span>
              {selectedBilling === 'annual' && (
                <p className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {translate('paywall_billed_annually')} {annualTotal()}
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-6">
              {premiumFeatures.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <span className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleSelectPremium}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Crown className="w-5 h-5" />
              )}
              {translate('signup_plan_premium_cta')}
            </button>
          </div>
        </div>

        {/* Legal note */}
        <p className={cn('text-xs text-center mt-6', isDark ? 'text-gray-500' : 'text-gray-400')}>
          {translate('paywall_legal')}
        </p>
      </div>
    </div>
  );
}
