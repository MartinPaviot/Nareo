import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const supabase = getServiceSupabase();
    const userId = auth.user.id;

    // Delete user's courses (cascade will delete chapters, concepts, questions)
    await supabase
      .from('courses')
      .delete()
      .eq('user_id', userId);

    // Delete user's profile
    await supabase
      .from('profiles')
      .delete()
      .eq('user_id', userId);

    // Delete user's payments
    await supabase
      .from('payments')
      .delete()
      .eq('user_id', userId);

    // Delete the auth user (this requires admin/service role)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      // Continue anyway - data is already deleted
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
