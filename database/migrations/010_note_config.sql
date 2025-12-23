-- Migration: Add note_config column to store personnalisation settings
-- This allows restoring the user's configuration when regenerating a note

-- Add the note_config column (JSONB for flexibility)
ALTER TABLE courses
ADD COLUMN IF NOT EXISTS note_config JSONB DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN courses.note_config IS 'Stores the personnalisation configuration used to generate the A+ Note (matiere, niveau, recaps)';
