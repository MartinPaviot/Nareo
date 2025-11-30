import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { queueCourseProcessing } from '@/lib/backend/course-pipeline';
import { logEvent } from '@/lib/backend/analytics';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Upload limits
const FREE_UPLOAD_LIMIT = 3; // Free users can upload 3 courses total
const PREMIUM_MONTHLY_LIMIT = 12; // Premium users can upload 12 courses per month

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
    const guestSessionId = formData.get('guestSessionId') as string | null;
    const supabase = await createSupabaseServerClient();

    // Check upload limits for authenticated users
    if (userId) {
      // Get user profile and subscription info
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_expires_at, monthly_upload_count, monthly_upload_reset_at')
        .eq('user_id', userId)
        .single();

      const isPremium = profile?.subscription_tier === 'premium' &&
        (!profile?.subscription_expires_at || new Date(profile.subscription_expires_at) > new Date());

      if (isPremium) {
        // Premium user: check monthly limit
        const now = new Date();
        const resetAt = profile?.monthly_upload_reset_at ? new Date(profile.monthly_upload_reset_at) : null;
        const needsReset = !resetAt || resetAt < new Date(now.getFullYear(), now.getMonth(), 1);

        let currentCount = needsReset ? 0 : (profile?.monthly_upload_count || 0);

        if (currentCount >= PREMIUM_MONTHLY_LIMIT) {
          return NextResponse.json(
            { error: `Limite mensuelle atteinte (${PREMIUM_MONTHLY_LIMIT} cours/mois). Réessaie le mois prochain.` },
            { status: 429 }
          );
        }

        // Update monthly count
        await supabase
          .from('profiles')
          .update({
            monthly_upload_count: currentCount + 1,
            monthly_upload_reset_at: needsReset ? now.toISOString() : profile?.monthly_upload_reset_at,
          })
          .eq('user_id', userId);
      } else {
        // Free user: check total course count
        const { count: courseCount } = await supabase
          .from('courses')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        if ((courseCount || 0) >= FREE_UPLOAD_LIMIT) {
          return NextResponse.json(
            { error: `Limite gratuite atteinte (${FREE_UPLOAD_LIMIT} cours). Passe à Premium pour uploader jusqu'à 12 cours/mois.` },
            { status: 429 }
          );
        }
      }
    }

    const { courseId, jobId } = await queueCourseProcessing({
      userId,
      file,
      isPublic: !userId,
      guestSessionId: !userId ? guestSessionId : null,
    });
    await logEvent('upload_success', { userId: userId ?? undefined, courseId, payload: { jobId, guestSessionId: !userId ? guestSessionId : undefined } });

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
