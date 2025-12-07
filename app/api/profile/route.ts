import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Admin emails with unlimited uploads (same as in upload route)
const UNLIMITED_UPLOAD_EMAILS = [
  'contact@usenareo.com',
];

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', auth.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Get course count
    const { count: courseCount } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.user.id);

    // Check if user has unlimited uploads (admin)
    const userEmail = auth.user.email?.toLowerCase();
    const hasUnlimitedUploads = userEmail && UNLIMITED_UPLOAD_EMAILS.includes(userEmail);

    // Check if premium is active (admins are always premium)
    const isPremium = hasUnlimitedUploads || (profile?.subscription_tier === 'premium' &&
      (!profile?.subscription_expires_at || new Date(profile.subscription_expires_at) > new Date()));

    return NextResponse.json({
      profile: {
        ...profile,
        email: auth.user.email,
        isPremium,
        hasUnlimitedUploads,
        courseCount: courseCount || 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { full_name, locale } = body;

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name,
        locale,
      })
      .eq('user_id', auth.user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
