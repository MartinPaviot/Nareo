-- Migration: Create newsletter_subscribers table
-- Stores email subscribers for the blog newsletter

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    source TEXT DEFAULT 'blog', -- Where the subscription came from (blog, landing, etc.)
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_active ON newsletter_subscribers(is_active);

-- Add RLS policies
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anyone (for newsletter signup)
CREATE POLICY "Anyone can subscribe to newsletter"
ON newsletter_subscribers FOR INSERT
TO public
WITH CHECK (true);

-- Only allow reading own subscription (not really needed but good practice)
CREATE POLICY "Service role can read all subscribers"
ON newsletter_subscribers FOR SELECT
TO service_role
USING (true);

-- Add comment for documentation
COMMENT ON TABLE newsletter_subscribers IS 'Stores email subscribers for the blog newsletter';
