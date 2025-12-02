'use client';

import { useState, useEffect } from 'react';
import { X, Cookie, Settings, Shield } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { getStoredConsent, setStoredConsent, hasConsentBeenGiven } from '@/lib/cookies';

interface CookieBannerProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function CookieBanner({ forceOpen = false, onClose }: CookieBannerProps) {
  const { translate } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    // Show banner if no consent has been given yet
    if (!hasConsentBeenGiven()) {
      setIsVisible(true);
    }
  }, []);

  useEffect(() => {
    if (forceOpen) {
      const storedConsent = getStoredConsent();
      setAnalyticsEnabled(storedConsent?.analytics ?? false);
      setIsVisible(true);
      setShowCustomize(true);
    }
  }, [forceOpen]);

  const handleAcceptAll = () => {
    setStoredConsent({
      essential: true,
      analytics: true,
    });
    setIsVisible(false);
    onClose?.();
  };

  const handleRejectAll = () => {
    setStoredConsent({
      essential: true,
      analytics: false,
    });
    setIsVisible(false);
    onClose?.();
  };

  const handleSavePreferences = () => {
    setStoredConsent({
      essential: true,
      analytics: analyticsEnabled,
    });
    setIsVisible(false);
    setShowCustomize(false);
    onClose?.();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cookie className="w-6 h-6 text-white" />
            <h2 className="text-lg font-bold text-white">
              {translate('cookie_banner_title')}
            </h2>
          </div>
          {forceOpen && (
            <button
              onClick={() => {
                setIsVisible(false);
                onClose?.();
              }}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6">
          {!showCustomize ? (
            <>
              {/* Main message */}
              <p className="text-gray-600 text-sm mb-4">
                {translate('cookie_banner_message')}
              </p>
              <p className="text-gray-500 text-xs mb-6">
                {translate('cookie_banner_learn_more')}{' '}
                <Link href="/cookies" className="text-orange-500 hover:text-orange-600 underline">
                  {translate('cookie_banner_policy_link')}
                </Link>
              </p>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleAcceptAll}
                  className="flex-1 bg-orange-500 text-white py-3 px-4 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
                >
                  {translate('cookie_banner_accept_all')}
                </button>
                <button
                  onClick={handleRejectAll}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  {translate('cookie_banner_reject_all')}
                </button>
                <button
                  onClick={() => setShowCustomize(true)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  {translate('cookie_banner_customize')}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Customize view */}
              <div className="space-y-4 mb-6">
                {/* Essential cookies */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-green-600" />
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {translate('cookie_essential_title')}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {translate('cookie_essential_desc')}
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled
                        className="sr-only"
                      />
                      <div className="w-11 h-6 bg-green-500 rounded-full cursor-not-allowed opacity-60">
                        <div className="w-5 h-5 bg-white rounded-full shadow-md transform translate-x-5 translate-y-0.5"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analytics cookies */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {translate('cookie_analytics_title')}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {translate('cookie_analytics_desc')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAnalyticsEnabled(!analyticsEnabled)}
                      className="relative"
                      role="switch"
                      aria-checked={analyticsEnabled}
                    >
                      <div className={`w-11 h-6 rounded-full transition-colors ${analyticsEnabled ? 'bg-orange-500' : 'bg-gray-300'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform translate-y-0.5 ${analyticsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCustomize(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  {translate('back')}
                </button>
                <button
                  onClick={handleSavePreferences}
                  className="flex-1 bg-orange-500 text-white py-3 px-4 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
                >
                  {translate('cookie_banner_save')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Export a function to open cookie settings from anywhere
export const openCookieSettings = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('openCookieSettings'));
  }
};
