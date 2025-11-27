import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { queueCourseProcessing } from '@/lib/backend/course-pipeline';
import { logEvent } from '@/lib/backend/analytics';

const VALID_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

export async function POST(request: NextRequest) {
  // Auth optional: guests can upload; authenticated users keep userId
  const auth = await authenticateRequest(request);

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Le fichier est vide' }, { status: 400 });
    }

    if (!VALID_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format non pris en charge. Autorisés : JPG, PNG, PDF, DOCX' },
        { status: 400 }
      );
    }

    const userId = auth?.user.id || null;
    const { courseId, jobId } = await queueCourseProcessing({ userId, file, isPublic: !userId });
    await logEvent('upload_success', { userId: userId ?? undefined, courseId, payload: { jobId } });

    return NextResponse.json({
      success: true,
      courseId,
      content_language: null,
      message: 'Upload reçu. Le traitement démarre en arrière-plan.',
    });
  } catch (error: any) {
    await logEvent('upload_failed', {
      userId: auth?.user.id,
      payload: { error: error?.message },
    });

    const message = error?.message || 'Echec du traitement du fichier';
    const status = message.toLowerCase().includes('long') ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
