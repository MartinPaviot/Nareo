import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const { folderId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try RPC function first
    const { data: newState, error: rpcError } = await supabase
      .rpc('toggle_folder_collapse', {
        p_folder_id: folderId,
        p_user_id: user.id,
      });

    if (!rpcError) {
      return NextResponse.json({ success: true, is_collapsed: newState });
    }

    // Fallback: manual toggle
    const { data: folder } = await supabase
      .from('folders')
      .select('is_collapsed')
      .eq('id', folderId)
      .eq('user_id', user.id)
      .single();

    const newCollapsed = !(folder?.is_collapsed || false);

    const { error } = await supabase
      .from('folders')
      .update({ is_collapsed: newCollapsed })
      .eq('id', folderId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error toggling folder collapse:', error);
      return NextResponse.json({ error: 'Failed to toggle' }, { status: 500 });
    }

    return NextResponse.json({ success: true, is_collapsed: newCollapsed });
  } catch (error) {
    console.error('Error in toggle collapse API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
