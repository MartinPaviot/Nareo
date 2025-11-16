-- Authentication and Session Tracking Schema for Supabase
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Visitors table to track all users who have signed up
CREATE TABLE IF NOT EXISTS public.visitors (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table to track user login sessions
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User stats table to aggregate user activity
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_duration_seconds INTEGER DEFAULT 0,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_visitors_email ON public.visitors(email);
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON public.visitors(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON public.sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_ended_at ON public.sessions(ended_at);
CREATE INDEX IF NOT EXISTS idx_user_stats_last_seen ON public.user_stats(last_seen_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for visitors table
-- Users can view their own visitor record
CREATE POLICY "Users can view own visitor record"
    ON public.visitors
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own visitor record
CREATE POLICY "Users can insert own visitor record"
    ON public.visitors
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policies for sessions table
-- Users can only read their own sessions
CREATE POLICY "Users can view own sessions"
    ON public.sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
    ON public.sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
    ON public.sessions
    FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for user_stats table
-- Users can view their own stats
CREATE POLICY "Users can view own stats"
    ON public.user_stats
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own stats
CREATE POLICY "Users can insert own stats"
    ON public.user_stats
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own stats
CREATE POLICY "Users can update own stats"
    ON public.user_stats
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on user_stats
CREATE TRIGGER update_user_stats_updated_at
    BEFORE UPDATE ON public.user_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.visitors TO authenticated;
GRANT ALL ON public.sessions TO authenticated;
GRANT ALL ON public.user_stats TO authenticated;
GRANT SELECT ON public.visitors TO anon;
GRANT SELECT ON public.sessions TO anon;
GRANT SELECT ON public.user_stats TO anon;

-- Comments for documentation
COMMENT ON TABLE public.visitors IS 'Tracks all users who have signed up or signed in';
COMMENT ON TABLE public.sessions IS 'Tracks user login sessions with start and end times';
COMMENT ON TABLE public.user_stats IS 'Aggregates user activity statistics';
COMMENT ON COLUMN public.sessions.duration_seconds IS 'Calculated duration of the session in seconds';
COMMENT ON COLUMN public.user_stats.total_duration_seconds IS 'Total time user has spent in the app across all sessions';
