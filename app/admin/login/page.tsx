'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import Image from 'next/image';
import { Lock, Mail, Eye, EyeOff, KeyRound } from 'lucide-react';

export default function AdminLoginPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if already authenticated as admin
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    // If already logged in AND has valid admin session, redirect to admin
    if (user) {
      const adminSession = sessionStorage.getItem('adminAuthenticated');
      const adminExpiry = sessionStorage.getItem('adminExpiry');

      if (adminSession === 'true' && adminExpiry) {
        // Check if session is still valid
        if (new Date(adminExpiry) > new Date()) {
          router.push('/admin');
        } else {
          // Session expired, clear it
          sessionStorage.removeItem('adminAuthenticated');
          sessionStorage.removeItem('adminExpiry');
        }
      }
    }
    // If not logged in, stay on this page - user needs to enter credentials
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user?.email,
          code: adminCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid admin code');
      }

      // Store admin session
      sessionStorage.setItem('adminAuthenticated', 'true');
      sessionStorage.setItem('adminExpiry', data.expiry);

      router.push('/admin');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Access</h1>
          <p className="text-gray-400">Enter your admin code to continue</p>
        </div>

        {/* Form */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8">
          {/* Current User */}
          <div className="mb-6 p-3 bg-gray-700/50 rounded-lg flex items-center gap-3">
            <Mail className="w-5 h-5 text-gray-400" />
            <span className="text-gray-300 text-sm">{user.email}</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Admin Code */}
            <div>
              <label
                htmlFor="adminCode"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Admin Code
              </label>
              <div className="relative">
                <input
                  id="adminCode"
                  type={showCode ? 'text' : 'password'}
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                  placeholder="Enter admin code"
                  disabled={loading}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="px-4 py-3 rounded-lg text-sm border"
                style={{
                  backgroundColor: 'rgba(217, 26, 28, 0.2)',
                  borderColor: 'rgba(217, 26, 28, 0.5)',
                  color: '#f87171'
                }}
              >
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !adminCode}
              className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Access Admin Panel'}
            </button>
          </form>

          {/* Back Link */}
          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-gray-400 hover:text-gray-300"
            >
              ← Back to Home
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-center text-gray-500 text-xs mt-6">
          This area is restricted. Unauthorized access attempts are logged.
        </p>
      </div>
    </div>
  );
}
