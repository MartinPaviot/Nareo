'use client';

import { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface SignOutButtonProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function SignOutButton({ className, style }: SignOutButtonProps) {
  const { user, signOut } = useAuth();
  const { translate } = useLanguage();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    if (isSigningOut) return;
    
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={isSigningOut}
      className={className || "flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-full shadow-lg hover:shadow-xl hover:border-orange-400 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"}
      style={style}
      title={translate('signout_button')}
    >
      {isSigningOut ? (
        <>
          <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
          <span className="text-sm font-medium text-gray-700">{translate('signout_loading')}</span>
        </>
      ) : (
        <>
          <LogOut className="w-4 h-4 text-gray-600 group-hover:text-orange-500 transition-colors" />
          <span className="text-sm font-medium text-gray-700 group-hover:text-orange-600 transition-colors">
            {translate('signout_button')}
          </span>
        </>
      )}
    </button>
  );
}
