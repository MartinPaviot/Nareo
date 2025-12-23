-- Migration: Add quiz_config column to store quiz personnalisation settings
-- This allows restoring the user's configuration when regenerating a quiz

-- Add the quiz_config column (JSONB for flexibility)
ALTER TABLE courses
ADD COLUMN IF NOT EXISTS quiz_config JSONB DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN courses.quiz_config IS 'Stores the personnalisation configuration used to generate the quiz (niveau, types)';
