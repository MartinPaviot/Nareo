'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  Loader2,
  Mail,
  Save,
  Settings,
  Trash2,
  Upload,
  User,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface Profile {
  user_id: string;
  email: string;
  full_name: string | null;
  locale: string;
  subscription_tier: 'free' | 'premium';
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  subscription_cancel_at_period_end: boolean;
  monthly_upload_count: number;
  monthly_upload_reset_at: string | null;
  isPremium: boolean;
  hasUnlimitedUploads: boolean;
  courseCount: number;
}

export default function ComptePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { translate, currentLanguage, setLanguage } = useLanguage();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [selectedLocale, setSelectedLocale] = useState(currentLanguage);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const [currentPlan, setCurrentPlan] = useState<'monthly' | 'annual' | null>(null);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      // Pass the current referrer as returnTo so user can go back to where they came from
      const returnTo = typeof window !== 'undefined' ? document.referrer : '';
      const returnPath = returnTo && new URL(returnTo).origin === window.location.origin
        ? new URL(returnTo).pathname
        : '/';
      router.push(`/auth/signin?returnTo=${encodeURIComponent(returnPath)}`);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchCurrentPlan();
    }
  }, [user]);

  const fetchCurrentPlan = async () => {
    try {
      const response = await fetch('/api/subscription/change-plan', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.currentPlan) {
        setCurrentPlan(data.currentPlan);
      }
    } catch (err) {
      console.error('Error fetching current plan:', err);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile', {
        credentials: 'include',
      });
      const data = await response.json();

      if (data.profile) {
        setProfile(data.profile);
        setFullName(data.profile.full_name || '');
        setSelectedLocale(data.profile.locale || currentLanguage);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(translate('account_error_loading'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          full_name: fullName,
          locale: selectedLocale,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      // Update language context
      setLanguage(selectedLocale as 'en' | 'fr' | 'de');

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(translate('account_error_saving'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/profile/delete', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await signOut();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (err) {
      console.error('Error deleting account:', err);
      setError(translate('account_error_deleting'));
      setDeleting(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCanceling(true);
    setError(null);
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel');
      }

      // Refresh profile to show updated status
      await fetchProfile();
      setShowCancelConfirm(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error('Error canceling subscription:', err);
      setError(err.message || translate('account_error_canceling'));
    } finally {
      setCanceling(false);
    }
  };

  const handleChangePlan = async (newPlan: 'monthly' | 'annual') => {
    setChangingPlan(true);
    setError(null);
    try {
      const response = await fetch('/api/subscription/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPlan }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change plan');
      }

      // Redirect to Stripe checkout for the new plan
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      console.error('Error changing plan:', err);
      setError(err.message || translate('account_error_changing_plan'));
      setChangingPlan(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(currentLanguage, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">{translate('account_back')}</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 sm:px-8 py-6 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <div className="text-white">
              <h1 className="text-xl sm:text-2xl font-bold">
                {translate('account_title')}
              </h1>
              <p className="text-orange-100 text-sm mt-1">
                {translate('account_subtitle')}
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            {saved && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                {translate('account_saved')}
              </div>
            )}

            {/* Subscription Status */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Crown className="w-5 h-5 text-orange-500" />
                {translate('account_subscription')}
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{translate('account_plan')}</span>
                  <span className={`font-semibold ${profile?.isPremium ? 'text-orange-600' : 'text-gray-900'}`}>
                    {profile?.isPremium
                      ? `Premium ${currentPlan === 'annual' ? translate('account_plan_annual') : translate('account_plan_monthly')}`
                      : translate('account_plan_free')
                    }
                  </span>
                </div>

                {profile?.isPremium && profile?.subscription_expires_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {translate('account_expires')}
                    </span>
                    <span className="font-medium text-gray-900">
                      {formatDate(profile.subscription_expires_at)}
                    </span>
                  </div>
                )}

                {/* Change plan button - only for premium users without pending cancellation */}
                {profile?.isPremium && !profile?.subscription_cancel_at_period_end && (
                  <div className="pt-2">
                    {!showChangePlan ? (
                      <button
                        onClick={() => setShowChangePlan(true)}
                        className="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {translate('account_change_plan')}
                      </button>
                    ) : (
                      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                        <p className="text-sm font-medium text-gray-900">
                          {translate('account_change_plan_title')}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => handleChangePlan('monthly')}
                            disabled={changingPlan || currentPlan === 'monthly'}
                            className={`px-4 py-3 rounded-xl border-2 text-center transition-all ${
                              currentPlan === 'monthly'
                                ? 'border-orange-500 bg-orange-50 text-orange-700'
                                : 'border-gray-200 hover:border-orange-300 text-gray-700'
                            } disabled:opacity-60`}
                          >
                            <div className="font-semibold">{translate('account_plan_monthly')}</div>
                            <div className="text-xs text-gray-500 mt-1">9,99€/{translate('account_per_month')}</div>
                            {currentPlan === 'monthly' && (
                              <div className="text-xs text-orange-600 mt-1">{translate('account_current_plan')}</div>
                            )}
                          </button>
                          <button
                            onClick={() => handleChangePlan('annual')}
                            disabled={changingPlan || currentPlan === 'annual'}
                            className={`px-4 py-3 rounded-xl border-2 text-center transition-all ${
                              currentPlan === 'annual'
                                ? 'border-orange-500 bg-orange-50 text-orange-700'
                                : 'border-gray-200 hover:border-orange-300 text-gray-700'
                            } disabled:opacity-60`}
                          >
                            <div className="font-semibold">{translate('account_plan_annual')}</div>
                            <div className="text-xs text-gray-500 mt-1">59,99€/{translate('account_per_year')}</div>
                            {currentPlan === 'annual' && (
                              <div className="text-xs text-orange-600 mt-1">{translate('account_current_plan')}</div>
                            )}
                          </button>
                        </div>
                        {changingPlan && (
                          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {translate('account_changing_plan')}
                          </div>
                        )}
                        <p className="text-xs text-gray-500">
                          {translate('account_change_plan_info')}
                        </p>
                        <button
                          onClick={() => setShowChangePlan(false)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          {translate('account_delete_cancel')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {translate('account_uploads_this_month')}
                  </span>
                  <span className="font-medium text-gray-900">
                    {profile?.hasUnlimitedUploads
                      ? `${profile?.monthly_upload_count || 0} / ∞`
                      : `${profile?.monthly_upload_count || 0} / ${profile?.isPremium ? 12 : 3}`
                    }
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{translate('account_total_courses')}</span>
                  <span className="font-medium text-gray-900">{profile?.courseCount || 0}</span>
                </div>

                {!profile?.isPremium && (
                  <Link
                    href="/paywall"
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:from-orange-600 hover:to-orange-700 transition-all"
                  >
                    <Crown className="w-5 h-5" />
                    {translate('account_upgrade')}
                  </Link>
                )}

                {/* Cancel subscription */}
                {profile?.isPremium && !profile?.subscription_cancel_at_period_end && (
                  <div className="pt-4 border-t border-gray-200">
                    {!showCancelConfirm ? (
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                      >
                        {translate('account_cancel_subscription')}
                      </button>
                    ) : (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                        <p className="text-sm text-gray-700">
                          {translate('account_cancel_confirm')}
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={handleCancelSubscription}
                            disabled={canceling}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-all"
                          >
                            {canceling && <Loader2 className="w-4 h-4 animate-spin" />}
                            {translate('account_cancel_yes')}
                          </button>
                          <button
                            onClick={() => setShowCancelConfirm(false)}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all"
                          >
                            {translate('account_cancel_no')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Subscription already canceled */}
                {profile?.isPremium && profile?.subscription_cancel_at_period_end && (
                  <div className="pt-4 border-t border-gray-200">
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <p className="text-sm text-orange-700">
                        {translate('account_subscription_canceled')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Info */}
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-orange-500" />
                {translate('account_profile')}
              </h2>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  {translate('account_email')}
                </label>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-600">
                  <Mail className="w-5 h-5" />
                  {profile?.email || user.email}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {translate('account_email_readonly')}
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-semibold text-gray-900 mb-2">
                  {translate('account_name')}
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={translate('account_name_placeholder')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all text-gray-900 placeholder-gray-400"
                />
              </div>

              {/* Language */}
              <div>
                <label htmlFor="locale" className="block text-sm font-semibold text-gray-900 mb-2">
                  {translate('account_language')}
                </label>
                <select
                  id="locale"
                  value={selectedLocale}
                  onChange={(e) => setSelectedLocale(e.target.value as 'en' | 'de' | 'fr')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all text-gray-900 bg-white"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {translate('account_save')}
              </button>
            </div>

            {/* Delete Account */}
            <div className="border-t border-gray-200 pt-8">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-gray-500 hover:text-red-600 transition-colors"
                >
                  {translate('account_delete')}
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-4">
                  <p className="text-red-700 text-sm">
                    {translate('account_delete_confirm')}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60 transition-all"
                    >
                      {deleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {translate('account_delete_yes')}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                    >
                      {translate('account_delete_cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
