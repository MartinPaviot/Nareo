'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Mail,
  Trash2,
  Upload,
  User,
  Calendar,
  RefreshCw,
  Globe,
  Shield,
  Sparkles,
  BookOpen,
  Zap,
  Camera,
  X,
  ChevronDown,
} from 'lucide-react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

// Dynamic import for crop modal to avoid SSR issues
const AvatarCropModal = dynamic(() => import('@/components/account/AvatarCropModal'), {
  ssr: false,
});

interface Profile {
  user_id: string;
  email: string;
  full_name: string | null;
  locale: string;
  avatar_url: string | null;
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

// Get user initials from name or email
function getUserInitials(fullName: string | null, email: string | null): string {
  if (fullName) {
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return '?';
}

export default function ComptePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { translate, currentLanguage, setLanguage } = useLanguage();
  const { isDark } = useTheme();

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

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
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

      setLanguage(selectedLocale as 'en' | 'fr' | 'de' | 'es');
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

  // Open crop modal when file is selected
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError('Type de fichier non supporté. Utilisez JPG, PNG, WebP ou GIF.');
      e.target.value = '';
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Le fichier est trop volumineux. Taille maximum: 5MB.');
      e.target.value = '';
      return;
    }

    setAvatarError(null);
    setSelectedFile(file);

    // Create URL for preview
    const imageUrl = URL.createObjectURL(file);
    setCropImageUrl(imageUrl);

    // Reset input
    e.target.value = '';
  };

  // Upload cropped image
  const handleCroppedAvatarUpload = async (croppedBlob: Blob) => {
    setUploadingAvatar(true);
    setAvatarError(null);

    try {
      const formData = new FormData();
      formData.append('avatar', croppedBlob, 'avatar.jpg');

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'upload');
      }

      setProfile(prev => prev ? { ...prev, avatar_url: data.avatar_url } : null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

      // Close modal
      closeCropModal();
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      setAvatarError(err.message || translate('account_error_saving'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Close crop modal and cleanup
  const closeCropModal = () => {
    if (cropImageUrl) {
      URL.revokeObjectURL(cropImageUrl);
    }
    setCropImageUrl(null);
    setSelectedFile(null);
  };

  const handleAvatarDelete = async () => {
    setUploadingAvatar(true);
    setAvatarError(null);

    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la suppression');
      }

      setProfile(prev => prev ? { ...prev, avatar_url: null } : null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error('Error deleting avatar:', err);
      setAvatarError(err.message || translate('account_error_saving'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const userInitials = getUserInitials(profile?.full_name || null, profile?.email || user?.email || null);

  if (authLoading || loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors ${
        isDark ? 'bg-neutral-950' : 'bg-gray-50'
      }`}>
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`min-h-screen transition-colors ${
      isDark ? 'bg-neutral-950' : 'bg-gray-50'
    }`}>
      {/* Top Bar */}
      <div className={`border-b sticky top-0 z-10 backdrop-blur-xl ${
        isDark ? 'bg-neutral-950/80 border-neutral-800' : 'bg-white/80 border-gray-200'
      }`}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${
              isDark ? 'text-neutral-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            {translate('account_back')}
          </button>
          <Link
            href="/dashboard"
            className={`text-sm font-medium transition-colors ${
              isDark ? 'text-neutral-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {translate('my_courses_button')}
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Alerts */}
        {(error || avatarError) && (
          <div
            className="rounded-xl p-4 text-sm flex items-center gap-3 border"
            style={{
              backgroundColor: isDark ? 'rgba(217, 26, 28, 0.1)' : '#fff6f3',
              borderColor: isDark ? 'rgba(217, 26, 28, 0.2)' : 'rgba(217, 26, 28, 0.2)',
              color: isDark ? '#f87171' : '#b91c1c'
            }}
          >
            <Shield className="w-5 h-5 flex-shrink-0" />
            {error || avatarError}
          </div>
        )}

        {saved && (
          <div className={`rounded-xl p-4 text-sm flex items-center gap-3 ${
            isDark ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            {translate('account_saved')}
          </div>
        )}

        {/* Profile Section */}
        <section className={`rounded-2xl border overflow-hidden ${
          isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
        }`}>
          {/* Profile Header with Avatar */}
          <div className={`p-6 border-b ${isDark ? 'border-neutral-800' : 'border-gray-100'}`}>
            <div className="flex items-center gap-4">
              {/* Avatar with edit button overlay */}
              <div className="relative group flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg overflow-hidden relative">
                  {profile?.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt="Avatar"
                      fill
                      className="object-cover rounded-full"
                      unoptimized
                    />
                  ) : (
                    <span className="text-xl font-bold text-white">{userInitials}</span>
                  )}
                </div>
                {/* Edit button - positioned at bottom right of avatar (for new upload) */}
                <label className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-md border-2 ${
                  isDark
                    ? 'bg-neutral-800 border-neutral-900 hover:bg-neutral-700'
                    : 'bg-white border-white hover:bg-gray-50'
                } ${uploadingAvatar ? 'pointer-events-none' : ''}`}>
                  {uploadingAvatar ? (
                    <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />
                  ) : (
                    <Camera className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-300' : 'text-gray-600'}`} />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAvatarSelect}
                    disabled={uploadingAvatar}
                    className="sr-only"
                  />
                </label>
                {/* Delete button - shows on hover if avatar exists */}
                {profile?.avatar_url && !uploadingAvatar && (
                  <button
                    onClick={handleAvatarDelete}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    style={{ backgroundColor: '#d91a1c' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b81618'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#d91a1c'}
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {profile?.full_name || profile?.email || user.email}
                </p>
              </div>

              {/* Plan Badge */}
              <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                profile?.isPremium
                  ? 'bg-gradient-to-r from-orange-500/20 to-yellow-500/20 text-orange-500 border border-orange-500/20'
                  : isDark
                    ? 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}>
                {profile?.isPremium ? (
                  <>
                    <GraduationCap className="w-3.5 h-3.5" />
                    Premium
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Free
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Profile Form */}
          <div className="p-6 space-y-5">
            {/* Email (read-only) */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-neutral-300' : 'text-gray-700'
              }`}>
                {translate('account_email')}
              </label>
              <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${
                isDark
                  ? 'bg-neutral-800/50 border-neutral-700 text-neutral-400'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}>
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm truncate">{profile?.email || user.email}</span>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-neutral-300' : 'text-gray-700'
              }`}>
                {translate('account_name')}
              </label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={translate('account_name_placeholder')}
                className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-all outline-none ${
                  isDark
                    ? 'bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500'
                }`}
              />
            </div>

            {/* Language */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-neutral-300' : 'text-gray-700'
              }`}>
                <Globe className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                {translate('account_language')}
              </label>
              <div className="flex gap-2">
                {[
                  { code: 'fr', label: 'Français', flag: '🇫🇷' },
                  { code: 'en', label: 'English', flag: '🇬🇧' },
                  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setSelectedLocale(lang.code as 'fr' | 'en' | 'de')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                      selectedLocale === lang.code
                        ? 'bg-orange-500 text-white border-orange-500'
                        : isDark
                          ? 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-neutral-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span className="hidden sm:inline">{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              style={{ backgroundColor: '#ff751f' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#e5681b')}
              onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#ff751f')}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {translate('account_save')}
            </button>
          </div>
        </section>

        {/* Subscription Section */}
        <section className={`rounded-2xl border overflow-hidden ${
          isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
        }`}>
          <div className={`px-6 py-4 border-b flex items-center justify-between ${
            isDark ? 'border-neutral-800' : 'border-gray-100'
          }`}>
            <h2 className={`font-semibold flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              <Sparkles className="w-4 h-4 text-orange-500" />
              {translate('account_subscription')}
            </h2>
            {!profile?.isPremium && (
              <Link
                href="/paywall"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-all"
                style={{ backgroundColor: '#ff751f' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                {translate('account_upgrade')}
              </Link>
            )}
          </div>

          <div className="p-6">
            {/* Plan Info */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  {translate('account_plan')}
                </p>
                <p className={`font-semibold ${
                  profile?.isPremium ? 'text-orange-500' : isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {profile?.isPremium
                    ? `Premium ${currentPlan === 'annual' ? translate('account_plan_annual') : translate('account_plan_monthly')}`
                    : translate('account_plan_free')
                  }
                </p>
              </div>
              {profile?.isPremium && profile?.subscription_expires_at && (
                <div className="text-right">
                  <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                    {translate('account_expires')}
                  </p>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {formatDate(profile.subscription_expires_at)}
                  </p>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className={`grid grid-cols-2 gap-3 p-4 rounded-xl mb-5 ${
              isDark ? 'bg-neutral-800/50' : 'bg-gray-50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  isDark ? 'bg-neutral-700' : 'bg-white'
                }`}>
                  <Upload className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {profile?.hasUnlimitedUploads ? '∞' : `${profile?.monthly_upload_count || 0}`}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                    Uploads
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  isDark ? 'bg-neutral-700' : 'bg-white'
                }`}>
                  <BookOpen className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {profile?.courseCount || 0}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                    {translate('account_total_courses')}
                  </p>
                </div>
              </div>
            </div>

            {/* Change Plan - Premium Users Only */}
            {profile?.isPremium && !profile?.subscription_cancel_at_period_end && (
              <>
                {!showChangePlan ? (
                  <button
                    onClick={() => setShowChangePlan(true)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      isDark
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <RefreshCw className="w-4 h-4" />
                      {translate('account_change_plan')}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                ) : (
                  <div className={`p-4 rounded-lg space-y-4 ${
                    isDark ? 'bg-neutral-800' : 'bg-gray-50'
                  }`}>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleChangePlan('monthly')}
                        disabled={changingPlan || currentPlan === 'monthly'}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          currentPlan === 'monthly'
                            ? 'border-orange-500 bg-orange-500/10'
                            : isDark
                              ? 'border-neutral-700 hover:border-neutral-600'
                              : 'border-gray-200 hover:border-gray-300'
                        } disabled:opacity-60`}
                      >
                        <div className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {translate('account_plan_monthly')}
                        </div>
                        <div className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                          9,99€/{translate('account_per_month')}
                        </div>
                        {currentPlan === 'monthly' && (
                          <div className="text-xs text-orange-500 mt-1 font-medium">
                            {translate('account_current_plan')}
                          </div>
                        )}
                      </button>
                      <button
                        onClick={() => handleChangePlan('annual')}
                        disabled={changingPlan || currentPlan === 'annual'}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          currentPlan === 'annual'
                            ? 'border-orange-500 bg-orange-500/10'
                            : isDark
                              ? 'border-neutral-700 hover:border-neutral-600'
                              : 'border-gray-200 hover:border-gray-300'
                        } disabled:opacity-60`}
                      >
                        <div className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {translate('account_plan_annual')}
                        </div>
                        <div className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                          59,99€/{translate('account_per_year')}
                        </div>
                        {currentPlan === 'annual' && (
                          <div className="text-xs text-orange-500 mt-1 font-medium">
                            {translate('account_current_plan')}
                          </div>
                        )}
                      </button>
                    </div>
                    {changingPlan && (
                      <div className={`flex items-center justify-center gap-2 text-sm ${
                        isDark ? 'text-neutral-400' : 'text-gray-500'
                      }`}>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {translate('account_changing_plan')}
                      </div>
                    )}
                    <button
                      onClick={() => setShowChangePlan(false)}
                      className={`text-sm ${isDark ? 'text-neutral-500 hover:text-neutral-400' : 'text-gray-500 hover:text-gray-600'}`}
                    >
                      {translate('account_delete_cancel')}
                    </button>
                  </div>
                )}

                {/* Cancel Subscription */}
                <div className={`mt-4 pt-4 border-t ${isDark ? 'border-neutral-800' : 'border-gray-100'}`}>
                  {!showCancelConfirm ? (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="text-sm transition-colors"
                      style={{ color: isDark ? '#737373' : '#6b7280' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#d91a1c'}
                      onMouseLeave={(e) => e.currentTarget.style.color = isDark ? '#737373' : '#6b7280'}
                    >
                      {translate('account_cancel_subscription')}
                    </button>
                  ) : (
                    <div
                      className="rounded-lg p-4 space-y-3 border"
                      style={{
                        backgroundColor: isDark ? 'rgba(217, 26, 28, 0.1)' : '#fff6f3',
                        borderColor: isDark ? 'rgba(217, 26, 28, 0.2)' : '#ffeae5'
                      }}
                    >
                      <p className="text-sm" style={{ color: isDark ? '#f87171' : '#b91c1c' }}>
                        {translate('account_cancel_confirm')}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancelSubscription}
                          disabled={canceling}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-60 transition-all"
                          style={{ backgroundColor: '#d91a1c' }}
                          onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#b81618')}
                          onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#d91a1c')}
                        >
                          {canceling && <Loader2 className="w-3 h-3 animate-spin" />}
                          {translate('account_cancel_yes')}
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(false)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            isDark
                              ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {translate('account_cancel_no')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Subscription Already Canceled */}
            {profile?.isPremium && profile?.subscription_cancel_at_period_end && (
              <div className={`rounded-lg p-4 ${
                isDark ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-50 border border-orange-100'
              }`}>
                <p className={`text-sm ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>
                  {translate('account_subscription_canceled')}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Danger Zone Section */}
        <section
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: isDark ? '#171717' : 'white',
            borderColor: isDark ? 'rgba(217, 26, 28, 0.2)' : '#ffeae5'
          }}
        >
          <div
            className="px-6 py-4 border-b"
            style={{ borderColor: isDark ? 'rgba(217, 26, 28, 0.2)' : '#ffeae5' }}
          >
            <h2
              className="font-semibold flex items-center gap-2"
              style={{ color: isDark ? '#f87171' : '#b91c1c' }}
            >
              <Shield className="w-4 h-4" />
              {translate('account_danger_zone')}
            </h2>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {translate('account_delete')}
                </h3>
                <p className={`text-sm mt-0.5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  {translate('account_delete_description')}
                </p>
              </div>
              {!showDeleteConfirm && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: isDark ? 'rgba(217, 26, 28, 0.1)' : '#fff6f3',
                    color: isDark ? '#f87171' : '#d91a1c'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(217, 26, 28, 0.2)' : '#fff6f3'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(217, 26, 28, 0.1)' : '#fff6f3'}
                >
                  {translate('account_delete')}
                </button>
              )}
            </div>

            {showDeleteConfirm && (
              <div className={`mt-4 pt-4 border-t space-y-3 ${
                isDark ? 'border-neutral-800' : 'border-gray-100'
              }`}>
                <p className="text-sm" style={{ color: isDark ? '#f87171' : '#b91c1c' }}>
                  {translate('account_delete_confirm')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-60 transition-all"
                    style={{ backgroundColor: '#d91a1c' }}
                    onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#b81618')}
                    onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#d91a1c')}
                  >
                    {deleting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    {translate('account_delete_yes')}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isDark
                        ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {translate('account_delete_cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Avatar Crop Modal */}
      {cropImageUrl && (
        <AvatarCropModal
          imageUrl={cropImageUrl}
          onClose={closeCropModal}
          onSave={handleCroppedAvatarUpload}
          isDark={isDark}
          translations={{
            title: translate('account_crop_title'),
            cancel: translate('cancel'),
            save: translate('save'),
            zoom: translate('account_crop_zoom'),
            reset: translate('account_crop_reset'),
          }}
        />
      )}
    </div>
  );
}
