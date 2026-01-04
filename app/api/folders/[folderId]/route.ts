import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * PATCH /api/folders/[folderId]
 * Update a folder
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const { folderId } = await params;
    const supabase = await createSupabaseServerClient();
    const updates = await request.json();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('folders')
      .update({
        ...(updates.name && { name: updates.name }),
        ...(updates.color && { color: updates.color }),
        ...(updates.icon && { icon: updates.icon }),
      })
      .eq('id', folderId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating folder:', error);
      return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in folder update API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/folders/[folderId]
 * Delete a folder (courses remain, only the folder association is removed)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { folderId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First delete folder_courses entries to avoid FK constraint issues
    await supabase
      .from('folder_courses')
      .delete()
      .eq('folder_id', folderId);

    // Delete the folder (with user_id check for security)
    const { error: deleteError } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting folder:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete folder' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete folder API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
