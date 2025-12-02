'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initPosthog, posthog } from '@/lib/posthog';
import { hasAnalyticsConsent } from '@/lib/cookies';

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    // Check initial consent
    const consent = hasAnalyticsConsent();
    setHasConsent(consent);

    if (consent) {
      initPosthog();
    }

    // Listen for consent changes
    const handleConsentChange = (event: CustomEvent) => {
      const analyticsConsent = event.detail?.analytics ?? false;
      setHasConsent(analyticsConsent);

      if (analyticsConsent) {
        initPosthog();
      } else {
        // Opt out if consent is revoked
        if (posthog.__loaded) {
          posthog.opt_out_capturing();
        }
      }
    };

    window.addEventListener('cookieConsentChanged', handleConsentChange as EventListener);

    return () => {
      window.removeEventListener('cookieConsentChanged', handleConsentChange as EventListener);
    };
  }, []);

  useEffect(() => {
    // Track page views only if consent is given
    if (hasConsent && pathname && posthog.__loaded) {
      let url = window.origin + pathname;
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture('$pageview', {
        $current_url: url,
      });
    }
  }, [pathname, searchParams, hasConsent]);

  return <>{children}</>;
}
