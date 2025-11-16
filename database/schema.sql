-- LevelUp Database Schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (optional - can use Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chapters table (uploaded PDFs)
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    pdf_url TEXT,
    summary TEXT,
    total_concepts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Concepts table (extracted from chapters)
CREATE TABLE IF NOT EXISTS concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    order_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    definitions TEXT[] DEFAULT '{}',
    key_ideas TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User progress table (tracks learning progress)
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    phase_1_score INTEGER DEFAULT 0,
    phase_2_score INTEGER DEFAULT 0,
    phase_3_score INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    badge TEXT CHECK (badge IN ('bronze', 'silver', 'gold')),
    completed BOOLEAN DEFAULT FALSE,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, concept_id)
);

-- Chat history table (stores conversation)
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    phase INTEGER CHECK (phase IN (1, 2, 3)),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table (tracks learning sessions)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    total_time_minutes INTEGER DEFAULT 0,
    concepts_mastered INTEGER DEFAULT 0,
    voice_used BOOLEAN DEFAULT FALSE
);

-- Learning sessions table (stores active learning state for resume functionality)
CREATE TABLE IF NOT EXISTS learning_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    current_question INTEGER DEFAULT 1,
    chat_messages JSONB DEFAULT '[]'::jsonb,
    session_state TEXT DEFAULT 'active' CHECK (session_state IN ('active', 'paused', 'completed')),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, chapter_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chapters_user_id ON chapters(user_id);
CREATE INDEX IF NOT EXISTS idx_concepts_chapter_id ON concepts(chapter_id);
CREATE INDEX IF NOT EXISTS idx_concepts_order ON concepts(chapter_id, order_index);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_concept_id ON user_progress(concept_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_concept_id ON chat_history(concept_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_timestamp ON chat_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_chapter_id ON learning_sessions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_state ON learning_sessions(session_state);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_last_activity ON learning_sessions(last_activity DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_chapters_updated_at
    BEFORE UPDATE ON chapters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_concepts_updated_at
    BEFORE UPDATE ON concepts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_sessions_updated_at
    BEFORE UPDATE ON learning_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for chapters
CREATE POLICY "Users can view their own chapters"
    ON chapters FOR SELECT
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own chapters"
    ON chapters FOR INSERT
    WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own chapters"
    ON chapters FOR UPDATE
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own chapters"
    ON chapters FOR DELETE
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policies for concepts (inherit from chapters)
CREATE POLICY "Users can view concepts from their chapters"
    ON concepts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chapters
            WHERE chapters.id = concepts.chapter_id
            AND chapters.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

-- Policies for user_progress
CREATE POLICY "Users can view their own progress"
    ON user_progress FOR SELECT
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own progress"
    ON user_progress FOR INSERT
    WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own progress"
    ON user_progress FOR UPDATE
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policies for chat_history
CREATE POLICY "Users can view their own chat history"
    ON chat_history FOR SELECT
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own chat messages"
    ON chat_history FOR INSERT
    WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policies for sessions
CREATE POLICY "Users can view their own sessions"
    ON sessions FOR SELECT
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own sessions"
    ON sessions FOR INSERT
    WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own sessions"
    ON sessions FOR UPDATE
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policies for learning_sessions
CREATE POLICY "Users can view their own learning sessions"
    ON learning_sessions FOR SELECT
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own learning sessions"
    ON learning_sessions FOR INSERT
    WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own learning sessions"
    ON learning_sessions FOR UPDATE
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own learning sessions"
    ON learning_sessions FOR DELETE
    USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Grant permissions to authenticated users
GRANT ALL ON chapters TO authenticated;
GRANT ALL ON concepts TO authenticated;
GRANT ALL ON user_progress TO authenticated;
GRANT ALL ON chat_history TO authenticated;
GRANT ALL ON sessions TO authenticated;
GRANT ALL ON learning_sessions TO authenticated;

-- Grant permissions to service role (for server-side operations)
GRANT ALL ON chapters TO service_role;
GRANT ALL ON concepts TO service_role;
GRANT ALL ON user_progress TO service_role;
GRANT ALL ON chat_history TO service_role;
GRANT ALL ON sessions TO service_role;
GRANT ALL ON learning_sessions TO service_role;
