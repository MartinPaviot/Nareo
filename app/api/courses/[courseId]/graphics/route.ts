/**
 * API Route: GET /api/courses/[courseId]/graphics
 *
 * Fetches all extracted graphics for a course with public URLs
 */

import { NextRequest } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const admin = getServiceSupabase();
    const { searchParams } = new URL(request.url);
    const debug = searchParams.get('debug') === 'true';

    // Debug mode - return detailed stats
    if (debug) {
      const { data: all, error: allError } = await admin
        .from('course_graphics')
        .select('id, image_id, page_number, confidence, graphic_type, elements')
        .eq('course_id', courseId)
        .order('page_number');

      if (allError) {
        return Response.json({ error: allError.message }, { status: 500 });
      }

      const withElements = all?.filter(g => g.elements !== null) || [];
      const withoutElements = all?.filter(g => g.elements === null) || [];
      const lowConfidence = all?.filter(g => (g.confidence || 0) < 0.9) || [];

      // Check reanalyze query
      const { data: reanalyze } = await admin
        .from('course_graphics')
        .select('id, image_id, confidence, elements')
        .eq('course_id', courseId)
        .or('confidence.lt.0.9,elements.is.null');

      return Response.json({
        total: all?.length || 0,
        withElements: withElements.length,
        withoutElements: withoutElements.length,
        lowConfidence: lowConfidence.length,
        reanalyzeWouldFind: reanalyze?.length || 0,
        samples: all?.slice(0, 3).map(g => ({
          imageId: g.image_id,
          confidence: g.confidence,
          hasElements: !!g.elements,
        })),
      });
    }

    // Normal mode - fetch all graphics for this course
    const { data: graphics, error } = await admin
      .from('course_graphics')
      .select('*')
      .eq('course_id', courseId)
      .order('page_number', { ascending: true });

    if (error) {
      console.error('[graphics API] Error fetching graphics:', error);
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Add public URLs for each graphic
    const graphicsWithUrls = graphics?.map(g => {
      const { data: urlData } = admin.storage
        .from('course-graphics')
        .getPublicUrl(g.storage_path);

      return {
        ...g,
        imageUrl: urlData.publicUrl,
      };
    }) || [];

    return Response.json({
      success: true,
      count: graphicsWithUrls.length,
      graphics: graphicsWithUrls,
    });

  } catch (error: any) {
    console.error('[graphics API] Unexpected error:', error);
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/courses/[courseId]/graphics
 *
 * Trigger re-analysis of graphics for a course
 * (useful if Claude prompt improved or analysis failed initially)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const { reanalyzeGraphics } = await import('@/lib/backend/graphics-processor');
    const { openaiVisionCircuitBreaker } = await import('@/lib/llm');

    console.log(`[graphics API] Triggering re-analysis for course ${courseId}`);

    // Reset circuit breaker to allow new attempts
    openaiVisionCircuitBreaker.reset();
    console.log(`[graphics API] Circuit breaker reset for OpenAI Vision`);

    const count = await reanalyzeGraphics(courseId);

    return Response.json({
      success: true,
      reanalyzed: count,
      message: `Re-analyzed ${count} graphics`,
    });

  } catch (error: any) {
    console.error('[graphics API] Re-analysis error:', error);
    return Response.json(
      { error: error.message || 'Re-analysis failed' },
      { status: 500 }
    );
  }
}
