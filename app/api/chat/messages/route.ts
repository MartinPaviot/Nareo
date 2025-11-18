import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { userId, chapterId, message } = await request.json();

    if (!userId || !chapterId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, chapterId, or message' },
        { status: 400 }
      );
    }

    console.log('💬 Saving chat message:', {
      userId,
      chapterId,
      messageId: message.id,
      sender: message.role,
    });

    // Use authenticated server client for RLS
    const serverClient = await createSupabaseServerClient();

    // ✅ Insert message into chat_messages table
    // - id: UUID auto-généré par Supabase
    // - message_id: TEXT custom ID from frontend
    const { data, error } = await serverClient
      .from('chat_messages')
      .insert({
        message_id: message.id,           // ✅ Custom TEXT ID
        user_id: userId,                  // ✅ UUID from auth
        chapter_id: chapterId,            // ✅ TEXT chapter identifier
        sender: message.role,             // ✅ TEXT 'user' or 'assistant'
        content: message.content,         // ✅ TEXT message content
      })
      .select('id, message_id, user_id, chapter_id, sender, content, created_at')
      .single();

    if (error) {
      console.error('❌ Error saving message to Supabase:', error);
      return NextResponse.json(
        {
          error: 'Failed to save message',
          details: error.message,
          code: error.code,
          hint: error.hint
        },
        { status: 500 }
      );
    }

    console.log('✅ Message saved successfully:', {
      id: data.id,
      message_id: data.message_id
    });

    return NextResponse.json({
      success: true,
      message: data,
    });
  } catch (error) {
    console.error('❌ Error in save message API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const chapterId = searchParams.get('chapterId');

    if (!userId || !chapterId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId or chapterId' },
        { status: 400 }
      );
    }

    console.log('📖 Loading chat messages for:', { userId, chapterId });

    // Use authenticated server client for RLS
    const serverClient = await createSupabaseServerClient();

    // ✅ Fetch messages from chat_messages table
    // Select all columns including message_id and id
    const { data, error } = await serverClient
      .from('chat_messages')
      .select('id, message_id, user_id, chapter_id, sender, content, created_at')
      .eq('user_id', userId)
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error loading messages from Supabase:', error);
      return NextResponse.json(
        {
          error: 'Failed to load messages',
          details: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    console.log(`✅ Loaded ${data.length} messages`);

    return NextResponse.json({
      success: true,
      messages: data,
    });
  } catch (error) {
    console.error('❌ Error in load messages API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const chapterId = searchParams.get('chapterId');

    if (!userId || !chapterId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId or chapterId' },
        { status: 400 }
      );
    }

    console.log('🗑️ Clearing chat messages for:', { userId, chapterId });

    // Use authenticated server client for RLS
    const serverClient = await createSupabaseServerClient();

    // Delete messages from chat_messages table
    const { error } = await serverClient
      .from('chat_messages')
      .delete()
      .eq('user_id', userId)
      .eq('chapter_id', chapterId);

    if (error) {
      console.error('❌ Error clearing messages from Supabase:', error);
      return NextResponse.json(
        { error: 'Failed to clear messages', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Messages cleared successfully');

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('❌ Error in clear messages API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
