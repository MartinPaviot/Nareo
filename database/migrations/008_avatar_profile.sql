-- Migration: Add avatar_url to profiles
-- Run this in Supabase SQL Editor

-- Add avatar_url column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL of the user profile picture stored in Supabase Storage';

-- Create storage bucket for avatars (run this separately in Supabase Dashboard > Storage)
-- Or use SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policy for avatars bucket (allow users to upload their own avatar)
-- Run these in Supabase SQL Editor after creating the bucket:

-- CREATE POLICY "Users can upload their own avatar"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can update their own avatar"
-- ON storage.objects FOR UPDATE
-- USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can delete their own avatar"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Anyone can view avatars"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'avatars');
