import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from './supabase-server';

export interface AuthenticatedRequest {
  user: {
    id: string;
    email?: string;
  };
}

/**
 * Authenticates an API request and returns the user
 * Returns null if authentication fails
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthenticatedRequest | null> {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Auth error:', error.message);
      return null;
    }
    
    if (!user) {
      console.warn('⚠️ Auth error: Auth session missing!');
      return null;
    }
    
    console.log('✅ User authenticated:', user.id);
    
    return {
      user: {
        id: user.id,
        email: user.email ?? undefined,
      },
    };
  } catch (error) {
    console.error('❌ Auth error:', error);
    return null;
  }
}

/**
 * Middleware to require authentication for API routes
 * Returns an error response if authentication fails
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthenticatedRequest | NextResponse> {
  const auth = await authenticateRequest(request);
  
  if (!auth) {
    return NextResponse.json(
      { error: 'Authentication required. Please sign in.' },
      { status: 401 }
    );
  }
  
  return auth;
}

/**
 * Helper to check if a response is an error response
 */
export function isErrorResponse(
  result: AuthenticatedRequest | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
