'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import WeeklyLeaderboard from '@/components/defi/WeeklyLeaderboard';

export default function ClassementPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin?redirect=/classement');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/defi"
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'
            }`}
          >
            <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
          </Link>
          <div>
            <h1 className={`text-2xl font-bold flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              <Trophy className="w-6 h-6 text-yellow-500" />
              Classement
            </h1>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Comparez vos performances avec vos amis
            </p>
          </div>
        </div>

        {/* Weekly leaderboard */}
        <WeeklyLeaderboard userId={user.id} />
      </div>
    </div>
  );
}
