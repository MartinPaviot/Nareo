import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { queueCourseProcessing, processCourseJob } from '@/lib/backend/course-pipeline';
import { logEvent } from '@/lib/backend/analytics';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Upload limits
const FREE_MONTHLY_LIMIT = 3; // Free users can upload 3 courses per month (with full access)
// Premium users have unlimited uploads

// Admin emails with unlimited uploads
const UNLIMITED_UPLOAD_EMAILS = [
  'contact@usenareo.com',
];

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
    const folderId = formData.get('folderId') as string | null;
    const supabase = await createSupabaseServerClient();

    // Check upload limits for authenticated users
    if (userId) {
      // Get user profile and subscription info
      let { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_expires_at, monthly_upload_count, monthly_upload_reset_at')
        .eq('user_id', userId)
        .single();

      // If no profile exists, create one and re-fetch
      if (!profile) {
        console.log(`[upload] No profile found for user ${userId}, creating one...`);
        const now = new Date();
        await supabase
          .from('profiles')
          .upsert({
            user_id: userId,
            subscription_tier: 'free',
            monthly_upload_count: 0,
            monthly_upload_reset_at: now.toISOString(),
          }, { onConflict: 'user_id' });

        // Re-fetch the profile after creation
        const { data: newProfile } = await supabase
          .from('profiles')
          .select('subscription_tier, subscription_expires_at, monthly_upload_count, monthly_upload_reset_at')
          .eq('user_id', userId)
          .single();
        profile = newProfile;
      }

      // Check if user has unlimited uploads (admin) - use email from auth
      const userEmail = auth?.user.email?.toLowerCase();
      const hasUnlimitedUploads = userEmail && UNLIMITED_UPLOAD_EMAILS.includes(userEmail);

      // Admin users are always considered premium
      const isPremium = hasUnlimitedUploads || (profile?.subscription_tier === 'premium' &&
        (!profile?.subscription_expires_at || new Date(profile.subscription_expires_at) > new Date()));

      // Calculate current month's upload count
      const now = new Date();
      const resetAt = profile?.monthly_upload_reset_at ? new Date(profile.monthly_upload_reset_at) : null;
      const needsReset = !resetAt || resetAt < new Date(now.getFullYear(), now.getMonth(), 1);
      const currentCount = needsReset ? 0 : (profile?.monthly_upload_count || 0);

      // Check if limit is reached (premium and admin users have unlimited uploads)
      if (!isPremium && currentCount >= FREE_MONTHLY_LIMIT) {
        return NextResponse.json(
          { error: 'UPLOAD_LIMIT_REACHED', code: 'UPLOAD_LIMIT_REACHED' },
          { status: 429 }
        );
      }

      // Update monthly count
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          monthly_upload_count: currentCount + 1,
          monthly_upload_reset_at: needsReset ? now.toISOString() : profile?.monthly_upload_reset_at,
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error(`[upload] Failed to update monthly count for user ${userId}:`, updateError);
      }
    }

    const { courseId, jobId } = await queueCourseProcessing({
      userId,
      file,
      isPublic: !userId,
      guestSessionId: !userId ? guestSessionId : null,
    });
    await logEvent('upload_success', { userId: userId ?? undefined, courseId, payload: { jobId, guestSessionId: !userId ? guestSessionId : undefined } });

    // Assign course to folder if specified (do this before returning)
    if (folderId && userId) {
      const { error: folderError } = await supabase
        .from('courses')
        .update({ folder_id: folderId })
        .eq('id', courseId)
        .eq('user_id', userId);

      if (folderError) {
        console.error(`[upload] Failed to assign course ${courseId} to folder ${folderId}:`, folderError);
      } else {
        console.log(`[upload] Course ${courseId} assigned to folder ${folderId}`);
      }
    }

    // Process the course in the background using after()
    // This allows us to return immediately while processing continues
    if (jobId) {
      after(async () => {
        try {
          console.log(`[upload] Starting background processing for job ${jobId}`);
          await processCourseJob(jobId);
          console.log(`[upload] Background processing completed for job ${jobId}`);
        } catch (err) {
          console.error(`[upload] Background processing failed for job ${jobId}:`, err);
        }
      });
    }

    // Return immediately with courseId - client will redirect to learn page
    // which shows ExtractionLoader while pipeline runs in background
    return NextResponse.json({
      success: true,
      courseId,
      content_language: null,
      message: 'Cours en cours de traitement.',
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
