import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-side admin allowlist.
 *
 * This is the ENFORCEMENT boundary for admin-only routes. The `sessionStorage`
 * flag set at /admin/login is a UX convenience only and must never be trusted
 * on its own — any signed-in user can forge it. Every admin route has to prove,
 * server-side, that the authenticated user's email is in this list.
 *
 * Configurable via the ADMIN_EMAILS env var (comma-separated). Defaults to the
 * product-owner account so existing deployments keep working without config.
 * If the admin signs in to Supabase with a different email, set ADMIN_EMAILS.
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'contact@usenareo.com')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export interface AdminUser {
  id: string;
  email: string;
}

/**
 * Verifies that the request carries a Bearer token for an authenticated user
 * whose email is in the admin allowlist. Returns the admin user on success, or
 * a NextResponse (401/403) that the caller should return as-is.
 */
export async function requireAdmin(
  request: Request
): Promise<AdminUser | NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized - No token provided' },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid token' },
      { status: 401 }
    );
  }

  if (!isAdminEmail(user.email)) {
    console.warn(`Admin route: non-admin access attempt by ${user.email}`);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { id: user.id, email: user.email! };
}

export function isAdminErrorResponse(
  result: AdminUser | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
