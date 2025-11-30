-- Migration: Add subscription tier to profiles
-- Run this in Supabase SQL Editor

-- Add subscription fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_tier text CHECK (subscription_tier IN ('free', 'premium')) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS monthly_upload_count int DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_upload_reset_at timestamptz DEFAULT NOW();

-- Create index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON public.profiles (subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles (stripe_customer_id);

-- Comment for documentation
COMMENT ON COLUMN public.profiles.subscription_tier IS 'User subscription level: free (2 chapters) or premium (unlimited)';
COMMENT ON COLUMN public.profiles.monthly_upload_count IS 'Number of courses uploaded this month (premium: 12 max)';
COMMENT ON COLUMN public.profiles.monthly_upload_reset_at IS 'When the monthly upload count resets';
