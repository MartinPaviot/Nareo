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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { folderId } = await params;

    // Verify the folder belongs to the user
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id, user_id')
      .eq('id', folderId)
      .single();

    if (folderError || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    if (folder.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the folder (cascade delete will remove folder_courses entries)
    const { error: deleteError } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);

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
