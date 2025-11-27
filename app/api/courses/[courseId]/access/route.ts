import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// GET: Check access for a course
export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const userId = auth.user.id;
    const courseId = params.courseId;

    // Get access data
    const { data: accessData } = await supabase
      .from('user_course_access')
      .select('*')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();

    return NextResponse.json({
      success: true,
      has_access: !!accessData,
      access_tier: accessData?.access_tier || null,
      granted_at: accessData?.granted_at || null,
    });
  } catch (error) {
    console.error('Error checking course access:', error);
    return NextResponse.json(
      { error: 'Failed to check course access' },
      { status: 500 }
    );
  }
}

// POST: Grant free access to chapter 2 (automatic for authenticated users)
export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const userId = auth.user.id;
    const courseId = params.courseId;

    // Verify course exists and belongs to user
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .eq('user_id', userId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Check if user already has access
    const { data: existingAccess } = await supabase
      .from('user_course_access')
      .select('*')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();

    if (existingAccess) {
      return NextResponse.json({
        success: true,
        message: 'User already has access to this course',
        access_tier: existingAccess.access_tier,
      });
    }

    // Grant free access (allows access to chapters 1 and 2)
    const { data: newAccess, error: accessError } = await supabase
      .from('user_course_access')
      .insert({
        user_id: userId,
        course_id: courseId,
        access_tier: 'free',
      })
      .select()
      .single();

    if (accessError) throw accessError;

    return NextResponse.json({
      success: true,
      message: 'Free access granted',
      access_tier: 'free',
      granted_at: newAccess.granted_at,
    });
  } catch (error) {
    console.error('Error granting course access:', error);
    return NextResponse.json(
      { error: 'Failed to grant course access' },
      { status: 500 }
    );
  }
}
