-- Migration: Create chat_messages table for persistent chat memory
-- Date: 2025-11-17
-- Description: Individual message storage for real-time chat persistence

-- Drop existing table if exists (for clean migration)
DROP TABLE IF EXISTS chat_messages CASCADE;

-- Create chat_messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
    content TEXT NOT NULL,
    aristo_state TEXT CHECK (aristo_state IN ('happy', 'confused', 'asking', 'success', 'reading', 'listening')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Composite index for fast retrieval by user and chapter
    CONSTRAINT fk_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

-- Indexes for optimal query performance
CREATE INDEX idx_chat_messages_user_chapter ON chat_messages(user_id, chapter_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp ASC);
CREATE INDEX idx_chat_messages_chapter ON chat_messages(chapter_id);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own messages
CREATE POLICY "Users can view their own chat messages"
ON chat_messages
FOR SELECT
USING (auth.uid()::text = user_id);

-- RLS Policy: Users can insert their own messages
CREATE POLICY "Users can insert their own chat messages"
ON chat_messages
FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

-- RLS Policy: Users can update their own messages
CREATE POLICY "Users can update their own chat messages"
ON chat_messages
FOR UPDATE
USING (auth.uid()::text = user_id);

-- RLS Policy: Users can delete their own messages
CREATE POLICY "Users can delete their own chat messages"
ON chat_messages
FOR DELETE
USING (auth.uid()::text = user_id);

-- Function to clean up old messages (optional, for future use)
CREATE OR REPLACE FUNCTION cleanup_old_chat_messages()
RETURNS void AS $$
BEGIN
    -- Delete messages older than 90 days
    DELETE FROM chat_messages
    WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Comment on table
COMMENT ON TABLE chat_messages IS 'Stores individual chat messages for persistent conversation history between users and Aristo AI';
COMMENT ON COLUMN chat_messages.sender IS 'Message sender: user or assistant';
COMMENT ON COLUMN chat_messages.aristo_state IS 'AI avatar emotional state when message was sent';
COMMENT ON COLUMN chat_messages.chapter_id IS 'Reference to the chapter/course this conversation belongs to';
