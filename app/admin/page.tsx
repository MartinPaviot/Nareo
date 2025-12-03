'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { LogOut } from 'lucide-react';

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
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Check admin session
  useEffect(() => {
    // Wait for auth to finish loading before doing anything
    if (authLoading) return;

    // If not logged in, redirect to login page
    if (!user) {
      router.push('/admin/login');
      return;
    }

    // Check if admin session exists and is valid
    const adminAuth = sessionStorage.getItem('adminAuthenticated');
    const adminExpiry = sessionStorage.getItem('adminExpiry');

    if (adminAuth !== 'true' || !adminExpiry) {
      router.push('/admin/login');
      return;
    }

    // Check if session expired
    if (new Date(adminExpiry) < new Date()) {
      sessionStorage.removeItem('adminAuthenticated');
      sessionStorage.removeItem('adminExpiry');
      router.push('/admin/login');
      return;
    }

    setIsAdminAuthenticated(true);
    loadDashboardData();
  }, [user, authLoading, router]);

  const handleLogoutAdmin = () => {
    sessionStorage.removeItem('adminAuthenticated');
    sessionStorage.removeItem('adminExpiry');
    router.push('/');
  };

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

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Admin Dashboard
            </h1>
            <p className="text-gray-600">
              Monitor user activity and platform statistics
            </p>
          </div>
          <button
            onClick={handleLogoutAdmin}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
            Logout Admin
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => router.push('/admin/quality')}
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition text-left"
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">📊</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Quality Audit</h3>
                <p className="text-sm text-gray-500">
                  Analyze course quality and question relevance
                </p>
              </div>
            </div>
          </button>
          <div className="bg-white rounded-2xl shadow-lg p-6 opacity-50">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🔧</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">More Tools</h3>
                <p className="text-sm text-gray-500">Coming soon...</p>
              </div>
            </div>
          </div>
        </div>

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
