'use client';

import { useEffect } from 'react';
import AuthGuard from '@/components/auth/AuthGuard';
import PageHeaderWithMascot from '@/components/layout/PageHeaderWithMascot';
import StatsModule from '@/components/stats/StatsModule';
import { CoursesModule } from '@/components/courses-unified';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { trackEvent } from '@/lib/posthog';
import UploadZone from '@/components/upload/UploadZone';

function MyCoursesScreen() {
  const { user } = useAuth();
  const { translate } = useLanguage();
  const { isDark } = useTheme();

  useEffect(() => {
    if (user) {
      trackEvent('dashboard_viewed', { userId: user.id });
    }
  }, [user]);

  return (
    <div className={`min-h-screen transition-colors ${
      isDark
        ? 'bg-neutral-950'
        : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'
    }`}>
      <PageHeaderWithMascot
        title={translate('my_courses_title')}
        subtitle={translate('dashboard_mascot_subtitle')}
        hideMyCoursesButton={true}
        showDarkModeToggle={true}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Stats Module - Unified gamified progress area with border */}
        <div className={`rounded-xl border-2 p-3 ${
          isDark ? 'border-neutral-700' : 'border-gray-200'
        }`}>
          <StatsModule />
        </div>

        {/* Courses Module - Unified courses and folders view */}
        <div id="courses-section">
          <CoursesModule />
        </div>

        {/* Upload Zone - Bottom - Full width */}
        <div data-upload-zone className="-mx-4 sm:-mx-6 px-4 sm:px-6">
          <UploadZone />
        </div>
      </main>
    </div>
  );
}

export default function ProtectedMyCourses() {
  return (
    <AuthGuard>
      <MyCoursesScreen />
    </AuthGuard>
  );
}
