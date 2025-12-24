'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import FriendsList from '@/components/defi/FriendsList';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function AmisPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const { translate } = useLanguage();

  const [userProfile, setUserProfile] = useState<{ friend_code: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin?redirect=/amis');
      return;
    }

    if (user) {
      fetchUserProfile();
    }
  }, [user, authLoading, router]);

  const fetchUserProfile = async () => {
    try {
      const supabase = createSupabaseBrowserClient();

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('friend_code')
        .eq('id', user?.id)
        .maybeSingle();

      if (profile) {
        setUserProfile(profile);
      } else {
        // Create profile if it doesn't exist
        const displayName = user?.email?.split('@')[0] || translate('friends_user');
        const { data: newProfile } = await supabase
          .from('user_profiles')
          .insert({
            id: user?.id,
            display_name: displayName,
          })
          .select('friend_code')
          .single();

        if (newProfile) {
          setUserProfile(newProfile);
        }
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChallengeFriend = (friendId: string) => {
    // TODO: Implement direct challenge invite
    router.push('/defi/creer');
  };

  if (authLoading || loading) {
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
              <Users className="w-6 h-6" />
              {translate('friends_title')}
            </h1>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {translate('friends_subtitle')}
            </p>
          </div>
        </div>

        {/* Friends list */}
        <FriendsList
          userId={user.id}
          userFriendCode={userProfile?.friend_code || '...'}
          onChallengeFriend={handleChallengeFriend}
        />
      </div>
    </div>
  );
}
