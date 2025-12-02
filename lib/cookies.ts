// Cookie consent management

export interface CookieConsent {
  essential: boolean;
  analytics: boolean;
  consentDate: string;
}

const COOKIE_CONSENT_KEY = 'nareo_cookie_consent';

export const getStoredConsent = (): CookieConsent | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading cookie consent:', e);
  }
  return null;
};

export const setStoredConsent = (consent: Omit<CookieConsent, 'consentDate'>): void => {
  if (typeof window === 'undefined') return;

  const fullConsent: CookieConsent = {
    ...consent,
    consentDate: new Date().toISOString(),
  };

  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(fullConsent));

    // Dispatch custom event for analytics providers to listen to
    window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: fullConsent }));
  } catch (e) {
    console.error('Error saving cookie consent:', e);
  }
};

export const hasConsentBeenGiven = (): boolean => {
  return getStoredConsent() !== null;
};

export const hasAnalyticsConsent = (): boolean => {
  const consent = getStoredConsent();
  return consent?.analytics ?? false;
};

// Function to clear consent (useful for testing or GDPR data deletion requests)
export const clearConsent = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(COOKIE_CONSENT_KEY);
};
