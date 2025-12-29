import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

/**
 * GET /api/courses/guest-count
 * Returns the count of courses for a guest session
 */
export async function GET(request: NextRequest) {
  try {
    const guestSessionId = getGuestSessionIdFromRequest(request);

    if (!guestSessionId) {
      return NextResponse.json({ count: 0 });
    }

    const supabase = getServiceSupabase();

    const { count, error } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('guest_session_id', guestSessionId)
      .is('user_id', null);

    if (error) {
      console.error('Error counting guest courses:', error);
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('Error in guest-count:', error);
    return NextResponse.json({ count: 0 });
  }
}
