import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { courseId } = await params;
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

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

    // Verify user owns this course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('user_id', userId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Cours non trouvé' }, { status: 404 });
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${userId}/${courseId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('note-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({
        error: 'Erreur lors de l\'upload de l\'image'
      }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('note-images')
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: publicUrl
    });

  } catch (error: unknown) {
    console.error('Error uploading note image:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
