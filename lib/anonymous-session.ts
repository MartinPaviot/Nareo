/**
 * Anonymous Session Management
 *
 * Persists user context (course progress, quiz state) for anonymous users
 * so they can resume after signing up.
 *
 * Uses both cookie AND localStorage for maximum persistence
 * (localStorage survives email verification redirects where cookies may be blocked)
 */

const ANONYMOUS_CONTEXT_KEY = 'nareo_anonymous_context';
const COOKIE_EXPIRY_DAYS = 1; // 24 hours

// Cookie utilities
function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export interface AnonymousContext {
  // Where to redirect after signup
  returnPath: string;
  // Course being viewed
  courseId?: string;
  // Chapter being quizzed (if any)
  chapterId?: string;
  // Quiz results (if just completed)
  quizResults?: {
    score: number;
    total: number;
    correct: number;
    totalQuestions: number;
    percentage: number;
  };
  // Timestamp for expiration
  savedAt: number;
}

// Context expires after 24 hours
const CONTEXT_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Save anonymous user context before signup
 * Stores in both cookie AND localStorage for maximum persistence
 */
export function saveAnonymousContext(context: Omit<AnonymousContext, 'savedAt'>): void {
  if (typeof window === 'undefined') return;

  const fullContext: AnonymousContext = {
    ...context,
    savedAt: Date.now(),
  };

  const contextStr = JSON.stringify(fullContext);

  // Store in both places for redundancy
  localStorage.setItem(ANONYMOUS_CONTEXT_KEY, contextStr);
  setCookie(ANONYMOUS_CONTEXT_KEY, contextStr, COOKIE_EXPIRY_DAYS);

  console.log('📝 Saved anonymous context:', fullContext);
}

/**
 * Get saved anonymous context (if not expired)
 * Checks both cookie AND localStorage (localStorage survives email redirects)
 */
export function getAnonymousContext(): AnonymousContext | null {
  if (typeof window === 'undefined') return null;

  try {
    // Try cookie first, then localStorage (localStorage survives email verification redirect)
    const stored = getCookie(ANONYMOUS_CONTEXT_KEY) || localStorage.getItem(ANONYMOUS_CONTEXT_KEY);
    if (!stored) return null;

    const context = JSON.parse(stored) as AnonymousContext;

    // Check expiration
    if (Date.now() - context.savedAt > CONTEXT_EXPIRY_MS) {
      clearAnonymousContext();
      return null;
    }

    return context;
  } catch (e) {
    console.error('Failed to load anonymous context:', e);
    return null;
  }
}

/**
 * Clear anonymous context (after successful signup and redirect)
 * Clears from both cookie and localStorage
 */
export function clearAnonymousContext(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ANONYMOUS_CONTEXT_KEY);
  deleteCookie(ANONYMOUS_CONTEXT_KEY);
  console.log('🗑️ Cleared anonymous context');
}

/**
 * Get the return path for post-signup redirect
 * Falls back to dashboard if no context or expired
 */
export function getPostSignupReturnPath(): string {
  const context = getAnonymousContext();
  if (context?.returnPath) {
    return context.returnPath;
  }
  return '/dashboard';
}
