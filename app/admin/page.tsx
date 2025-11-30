'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

// Hardcoded list of admin emails
const ADMIN_EMAILS = [
  'admin@levelup.com',
  'admin@example.com',
  // Add more admin emails here
];

interface VisitorData {
  user_id: string;
  email: string;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  averageTimeSpent: number;
}

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    averageTimeSpent: 0,
  });
  const [visitors, setVisitors] = useState<VisitorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Check if user is admin
  const isAdmin = user && ADMIN_EMAILS.includes(user.email || '');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin');
      return;
    }

    if (!authLoading && user && !isAdmin) {
      router.push('/');
      return;
    }

    if (isAdmin) {
      loadDashboardData();
    }
  }, [user, authLoading, isAdmin, router]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // Get total users count from auth.users (via a function or RPC)
      // Note: Direct access to auth.users is restricted, so we'll count from user_stats
      const { data: userStatsData, error: statsError } = await supabase
        .from('user_stats')
        .select('*');

      if (statsError) throw statsError;

      // Get active sessions (sessions with null ended_at)
      const { data: activeSessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('user_id')
        .is('ended_at', null);

      if (sessionsError) throw sessionsError;

      // Calculate stats
      const totalUsers = userStatsData?.length || 0;
      const activeUsers = new Set(activeSessions?.map((s) => s.user_id)).size;
      const totalSeconds = userStatsData?.reduce(
        (sum, stat) => sum + (stat.total_duration_seconds || 0),
        0
      ) || 0;
      const averageTimeSpent = totalUsers > 0 ? totalSeconds / totalUsers / 60 : 0;

      setStats({
        totalUsers,
        activeUsers,
        averageTimeSpent: Math.round(averageTimeSpent * 10) / 10,
      });

      // Get visitors list
      const { data: visitorsData, error: visitorsError } = await supabase
        .from('visitors')
        .select('*')
        .order('created_at', { ascending: false });

      if (visitorsError) throw visitorsError;

      setVisitors(visitorsData || []);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
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
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600">
            Monitor user activity and platform statistics
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">
                Total Users
              </h3>
              <div className="text-3xl">👥</div>
            </div>
            <p className="text-4xl font-bold text-orange-500">
              {stats.totalUsers}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">
                Active Users
              </h3>
              <div className="text-3xl">🟢</div>
            </div>
            <p className="text-4xl font-bold text-green-500">
              {stats.activeUsers}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">
                Avg. Time (min)
              </h3>
              <div className="text-3xl">⏱️</div>
            </div>
            <p className="text-4xl font-bold text-blue-500">
              {stats.averageTimeSpent}
            </p>
          </div>
        </div>

        {/* Visitors Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">All Visitors</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visitors.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-4 text-center text-gray-500">
                      No visitors found
                    </td>
                  </tr>
                ) : (
                  visitors.map((visitor) => (
                    <tr key={visitor.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {visitor.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(visitor.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
