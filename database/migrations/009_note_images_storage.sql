-- Migration: Create storage bucket for note images
-- Run this in Supabase SQL Editor

-- Create storage bucket for note images
-- Run in Supabase Dashboard > Storage > New Bucket
-- Or use SQL:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'note-images',
  'note-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for note-images bucket

-- Policy: Users can upload images to their own folder
CREATE POLICY "Users can upload note images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'note-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own images
CREATE POLICY "Users can update their own note images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'note-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own images
CREATE POLICY "Users can delete their own note images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'note-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Anyone can view note images (public bucket)
CREATE POLICY "Anyone can view note images"
ON storage.objects FOR SELECT
USING (bucket_id = 'note-images');
