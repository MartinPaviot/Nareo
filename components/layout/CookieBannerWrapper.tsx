'use client';

import { useState, useEffect } from 'react';
import CookieBanner from './CookieBanner';

export default function CookieBannerWrapper() {
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const handleOpenSettings = () => {
      setShowSettings(true);
    };

    window.addEventListener('openCookieSettings', handleOpenSettings);
    return () => {
      window.removeEventListener('openCookieSettings', handleOpenSettings);
    };
  }, []);

  return (
    <>
      <CookieBanner />
      {showSettings && (
        <CookieBanner
          forceOpen={true}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
