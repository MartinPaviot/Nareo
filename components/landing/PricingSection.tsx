'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, GraduationCap, Sparkles, Zap } from 'lucide-react';
import { type Language } from '@/contexts/LanguageContext';

interface PricingSectionProps {
  translate: (key: string) => string;
  currentLanguage: Language;
  onCtaClick: (ctaName: string, destination?: string) => void;
  user: { id: string } | null;
}

export function PricingSection({ translate, currentLanguage, onCtaClick, user }: PricingSectionProps) {
  const router = useRouter();
  const [pricingBilling, setPricingBilling] = useState<'monthly' | 'annual'>('monthly');

  const handlePremiumClick = async () => {
    const plan = pricingBilling;
    if (user) {
      onCtaClick('pricing_premium_direct_checkout', plan);
      try {
        const response = await fetch('/api/payment/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        });
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        } else if (data.alreadySubscribed) {
          router.push('/dashboard');
        } else {
          console.error('Failed to create checkout session:', data.error);
          router.push(`/paywall?plan=${plan}`);
        }
      } catch (error) {
        console.error('Error creating checkout:', error);
        router.push(`/paywall?plan=${plan}`);
      }
    } else {
      const paywallUrl = `/paywall?plan=${plan}`;
      onCtaClick('pricing_premium', `/auth/signup?returnTo=${encodeURIComponent(paywallUrl)}`);
      router.push(`/auth/signup?returnTo=${encodeURIComponent(paywallUrl)}`);
    }
  };

  return (
    <section id="pricing" className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-gray-900">{translate('signup_plan_title')}</h2>
        <p className="text-sm text-gray-600">{translate('signup_plan_subtitle')}</p>
      </div>

      {/* Billing Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl bg-gray-100 p-1">
          <button
            onClick={() => setPricingBilling('monthly')}
            className={`py-1.5 px-3 rounded-lg text-sm font-medium transition-all ${
              pricingBilling === 'monthly'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {translate('paywall_plan_monthly')}
          </button>
          <button
            onClick={() => setPricingBilling('annual')}
            className={`py-1.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              pricingBilling === 'annual'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {translate('paywall_plan_annual')}
            <span className="text-xs text-white px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#22c55e' }}>
              -30%
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {/* Free Plan */}
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-lg hover:border-gray-300 transition-all flex flex-col">
          {/* Spacer to align with Premium badge */}
          <div className="h-4 -mt-4 md:block hidden" />

          <div className="flex items-center gap-2.5 mb-3 mt-1">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{translate('signup_plan_free_title')}</h3>
              <p className="text-xs text-gray-500">{translate('signup_plan_free_desc')}</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-baseline flex-wrap gap-x-1">
              <span className="text-3xl font-bold text-gray-900">0€</span>
              <span className="text-sm text-gray-500">{translate('paywall_price_per_month')}</span>
            </div>
            {/* Spacer to align with Premium price subtitle */}
            <p className="text-xs mt-0.5 invisible">placeholder</p>
          </div>

          <ul className="space-y-2 mb-4 flex-grow">
            {['feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5'].map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">{translate(`signup_plan_free_${feature}`)}</span>
              </li>
            ))}
          </ul>

          {user ? (
            <div className="w-full py-2.5 px-4 rounded-xl bg-gray-100 text-gray-500 font-semibold text-center mt-auto">
              {translate('pricing_current_plan')}
            </div>
          ) : (
            <button
              onClick={() => {
                onCtaClick('pricing_free', '/auth/signup');
                router.push('/auth/signup');
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-all mt-auto"
            >
              {translate('signup_plan_free_cta')}
            </button>
          )}
        </div>

        {/* Premium Plan */}
        <div className="relative rounded-2xl border-2 bg-white p-5 shadow-xl flex flex-col transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl" style={{ borderColor: '#ff751f' }}>
          {/* Recommended Badge */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 text-white text-sm font-bold rounded-full shadow-lg" style={{ backgroundColor: '#ff751f', boxShadow: '0 4px 12px rgba(255, 117, 31, 0.4)' }}>
            {translate('signup_plan_premium_badge')}
          </div>

          <div className="flex items-center gap-2.5 mb-3 mt-1">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" style={{ color: '#ff751f' }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{translate('signup_plan_premium_title')}</h3>
              <p className="text-xs text-gray-500">{translate('signup_plan_premium_desc')}</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-baseline flex-wrap gap-x-1">
              <span className="text-3xl font-bold text-orange-600">
                {pricingBilling === 'annual'
                  ? (currentLanguage === 'en' ? '€6.99' : '6,99 €')
                  : (currentLanguage === 'en' ? '€9.99' : '9,99 €')
                }
              </span>
              <span className="text-sm text-gray-500">{translate('paywall_price_per_month')}</span>
            </div>
            {pricingBilling === 'annual' ? (
              <p className="text-xs text-gray-500 mt-0.5">
                {translate('paywall_billed_annually')} {currentLanguage === 'en' ? '€83.88' : '83,88 €'}
              </p>
            ) : (
              <p className="text-xs text-success mt-0.5">
                {translate('pricing_cancel_anytime')}
              </p>
            )}
          </div>

          <ul className="space-y-2 mb-4 flex-grow">
            {['feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5'].map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ff751f' }} />
                <span className="text-sm text-gray-700">{translate(`signup_plan_premium_${feature}`)}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={handlePremiumClick}
            className="w-full py-2.5 px-4 rounded-xl text-white font-semibold transition-all shadow-lg flex items-center justify-center gap-2 mt-auto"
            style={{ backgroundColor: '#ff751f', boxShadow: '0 10px 15px -3px rgba(255, 117, 31, 0.25)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
          >
            <GraduationCap className="w-4 h-4" />
            {translate('signup_plan_premium_cta')}
          </button>
        </div>
      </div>
    </section>
  );
}
