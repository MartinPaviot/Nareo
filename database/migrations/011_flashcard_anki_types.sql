-- ============================================================================
-- Migration 011: Add Anki-quality flashcard types
-- Adds support for basic, cloze, and reversed card types
-- ============================================================================

-- 1. Drop the existing type check constraint
ALTER TABLE public.flashcards
DROP CONSTRAINT IF EXISTS flashcards_type_check;

-- 2. Add new constraint with Anki types (basic, cloze, reversed) + legacy types
ALTER TABLE public.flashcards
ADD CONSTRAINT flashcards_type_check
CHECK (type IN (
  -- Legacy types (keep for backwards compatibility)
  'definition', 'formula', 'condition', 'intuition', 'link',
  -- New Anki types
  'basic', 'cloze', 'reversed'
));

-- 3. Add optional columns for cloze and reversed card metadata
-- These can be used later to store the full cloze text or reversed term/definition
ALTER TABLE public.flashcards
ADD COLUMN IF NOT EXISTS cloze_text TEXT,
ADD COLUMN IF NOT EXISTS cloze_answer TEXT,
ADD COLUMN IF NOT EXISTS reversed_term TEXT,
ADD COLUMN IF NOT EXISTS reversed_def TEXT;

-- 4. Comments for documentation
COMMENT ON COLUMN public.flashcards.type IS 'Card type: legacy (definition, formula, condition, intuition, link) or Anki (basic, cloze, reversed)';
COMMENT ON COLUMN public.flashcards.cloze_text IS 'For cloze cards: full text with {{c1::answer}} format';
COMMENT ON COLUMN public.flashcards.cloze_answer IS 'For cloze cards: the hidden answer';
COMMENT ON COLUMN public.flashcards.reversed_term IS 'For reversed cards: the term/acronym';
COMMENT ON COLUMN public.flashcards.reversed_def IS 'For reversed cards: the definition';
