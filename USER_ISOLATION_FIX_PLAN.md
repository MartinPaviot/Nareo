# User Isolation Fix - Comprehensive Plan

## Problem Analysis

After analyzing the codebase, I've identified the root causes of the user isolation issue:

### Issues Found:

1. **✅ `/api/chapters/route.ts`** - Already properly implemented with authentication and user filtering
2. **❌ `/api/courses/route.ts`** - MISSING authentication and user filtering (CRITICAL BUG)
3. **⚠️ MemoryStore** - Properly filters by user_id, but needs explicit Supabase queries in routes for bulletproof isolation

### Root Cause:

The dashboard might be calling `/api/courses` instead of or in addition to `/api/chapters`, which would return ALL users' data without filtering.

## Fix Strategy

### 1. Fix `/api/chapters/route.ts` (Enhancement)
- Add explicit Supabase queries directly in the route
- Bypass MemoryStore for initial data load to ensure fresh data
- Add logging for debugging

### 2. Fix `/api/courses/route.ts` (CRITICAL)
- Add authentication via `authenticateRequest`
- Pass userId to all MemoryStore calls
- Add proper error handling

### 3. Verify All Other API Routes
- Ensure all routes that fetch user data have authentication
- Ensure all routes pass userId to MemoryStore methods

## Implementation Steps

### Step 1: Update `/api/chapters/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;
    console.log('📊 Fetching chapters for user:', userId);

    // Get Supabase SSR client (NOT service role)
    const supabase = await createSupabaseServerClient();

    // Query chapters directly from Supabase with explicit user_id filter
    const { data: chapterRows, error: chaptersError } = await supabase
      .from('chapters')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (chaptersError) {
      console.error('❌ Error fetching chapters:', chaptersError);
      return NextResponse.json(
        { error: 'Failed to fetch chapters' },
        { status: 500 }
      );
    }

    // Query chapter progress directly from Supabase with explicit user_id filter
    const { data: progressRows, error: progressError } = await supabase
      .from('chapter_progress')
      .select('*')
      .eq('user_id', userId);

    if (progressError) {
      console.error('❌ Error fetching progress:', progressError);
    }

    // Transform data
    const chapters = (chapterRows || []).map(ch => ({
      id: ch.id,
      title: ch.title,
      summary: ch.summary,
      difficulty: ch.difficulty || 'medium',
      orderIndex: ch.order_index || 0,
      questions: ch.questions || [],
      sourceText: ch.source_text,
      englishTitle: ch.english_title || ch.title,
      englishDescription: ch.english_description || ch.summary,
      frenchTitle: ch.french_title || ch.title,
      frenchDescription: ch.french_description || ch.summary,
    }));

    const progress = (progressRows || []).map(p => ({
      chapterId: p.chapter_id,
      currentQuestion: p.current_question,
      questionsAnswered: p.questions_answered,
      score: p.score,
      completed: p.completed,
      answers: p.answers || [],
    }));

    console.log(`✅ Returning ${chapters.length} chapters and ${progress.length} progress records for user ${userId}`);

    return NextResponse.json({
      chapters,
      progress,
    });
  } catch (error) {
    console.error('❌ Unexpected error in GET /api/chapters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Step 2: Fix `/api/courses/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { memoryStore } from '@/lib/memory-store';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;
    console.log('📊 Fetching courses for user:', userId);

    // Get all chapters FOR THIS USER
    const allChapters = await memoryStore.getAllChapters(userId);
    const allProgress = await memoryStore.getAllChapterProgress(userId);

    // ... rest of the logic
  } catch (error) {
    console.error('❌ Error fetching courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}
```

## Testing Plan

1. Create two test users
2. Upload content as User A
3. Sign out and sign up as User B
4. Verify User B sees zero courses
5. Upload content as User B
6. Verify User B only sees their own content
7. Sign back in as User A
8. Verify User A still sees only their content

## Success Criteria

- ✅ New users see zero courses on first login
- ✅ Each user only sees their own chapters
- ✅ No data leakage between users
- ✅ All API routes have authentication
- ✅ All database queries filter by user_id
