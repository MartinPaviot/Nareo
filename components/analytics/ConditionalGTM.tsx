'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { hasAnalyticsConsent } from '@/lib/cookies';

const GA_ID = 'G-MR18G3E4FH';

export default function ConditionalGTM() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Check initial consent
    setShouldLoad(hasAnalyticsConsent());

    // Listen for consent changes
    const handleConsentChange = (event: CustomEvent) => {
      setShouldLoad(event.detail?.analytics ?? false);
    };

    window.addEventListener('cookieConsentChanged', handleConsentChange as EventListener);

    return () => {
      window.removeEventListener('cookieConsentChanged', handleConsentChange as EventListener);
    };
  }, []);

  if (!shouldLoad) {
    return null;
  }

  return (
    <>
      {/* Google tag (gtag.js) */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
