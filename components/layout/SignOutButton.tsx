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
      className={className || "inline-flex items-center justify-center gap-1.5 h-8 px-3 bg-white border border-gray-200 rounded-full hover:bg-gray-50 text-sm font-medium leading-none transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"}
      style={style}
      title={translate('signout_button')}
    >
      {isSigningOut ? (
        <>
          <Loader2 className="w-3.5 h-3.5 text-gray-600 animate-spin" />
          <span className="text-sm font-medium text-gray-700">{translate('signout_loading')}</span>
        </>
      ) : (
        <>
          <LogOut className="w-3.5 h-3.5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            {translate('signout_button')}
          </span>
        </>
      )}
    </button>
  );
}
