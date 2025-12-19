import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({
        error: 'Type de fichier non supporté. Utilisez JPG, PNG, WebP ou GIF.'
      }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: 'Le fichier est trop volumineux. Taille maximum: 5MB.'
      }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const userId = auth.user.id;

    // Generate unique filename
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;

    // Delete old avatar if exists
    const { data: oldProfile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', userId)
      .single();

    if (oldProfile?.avatar_url) {
      // Extract old file path from URL
      const oldPath = oldProfile.avatar_url.split('/avatars/')[1];
      if (oldPath) {
        await supabase.storage.from('avatars').remove([oldPath]);
      }
    }

    // Upload new avatar
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({
        error: 'Erreur lors de l\'upload de l\'image'
      }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Update profile with new avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return NextResponse.json({
        error: 'Erreur lors de la mise à jour du profil'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      avatar_url: publicUrl
    });

  } catch (error: any) {
    console.error('Error uploading avatar:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const userId = auth.user.id;

    // Get current avatar URL
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', userId)
      .single();

    if (profile?.avatar_url) {
      // Extract file path from URL
      const filePath = profile.avatar_url.split('/avatars/')[1];
      if (filePath) {
        await supabase.storage.from('avatars').remove([filePath]);
      }
    }

    // Update profile to remove avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error deleting avatar:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
