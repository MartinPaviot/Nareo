-- Migration 026: Course Graphics Storage & Analysis
-- Support for automatic extraction and analysis of pedagogical graphics
-- Uses Mistral OCR for extraction + Claude Vision for analysis

-- ============================================================================
-- 1. CREATE TABLE: course_graphics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.course_graphics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id),

  -- Image metadata (from Mistral OCR)
  page_number int NOT NULL,
  image_id text NOT NULL, -- Mistral image ID (e.g., "img-0.jpeg")
  storage_path text NOT NULL, -- Path in course-graphics bucket

  -- Analysis results (from Claude Vision)
  graphic_type text CHECK (graphic_type IN (
    'courbe_offre_demande',  -- Supply/demand curves
    'diagramme_flux',         -- Flowcharts, processes
    'organigramme',           -- Hierarchies, org charts
    'tableau',                -- Tables, matrices
    'autre'                   -- Other (anatomy, circuits, etc.)
  )),
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  description text,

  -- Structured data (JSON)
  elements jsonb, -- Array of GraphicElement with normalized coords [0,1]
                  -- Example: [{"id": "P_equilibre", "type": "point", "label": "P*", "coords": {"x": 0.5, "y": 0.5}}]
  suggestions jsonb, -- DisplaySuggestions (affichage, annotations)
                     -- Example: {"affichage": "SVG", "annotations": ["Explain equilibrium shift"]}

  -- File metadata
  width int,
  height int,
  file_size int,
  mime_type text DEFAULT 'image/jpeg',

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Comment on table
COMMENT ON TABLE public.course_graphics IS 'Stores extracted pedagogical graphics from course documents with AI analysis';

-- Comments on key columns
COMMENT ON COLUMN public.course_graphics.elements IS 'Array of graphic elements with normalized coordinates (x,y in [0,1])';
COMMENT ON COLUMN public.course_graphics.suggestions IS 'Display and annotation suggestions from Claude Vision';
COMMENT ON COLUMN public.course_graphics.graphic_type IS 'Classified type of pedagogical graphic';

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_course_graphics_course ON public.course_graphics(course_id);
CREATE INDEX IF NOT EXISTS idx_course_graphics_chapter ON public.course_graphics(chapter_id);
CREATE INDEX IF NOT EXISTS idx_course_graphics_type ON public.course_graphics(graphic_type);
CREATE INDEX IF NOT EXISTS idx_course_graphics_page ON public.course_graphics(course_id, page_number);
CREATE INDEX IF NOT EXISTS idx_course_graphics_user ON public.course_graphics(user_id);

-- Index for high-confidence graphics (useful for filtering)
CREATE INDEX IF NOT EXISTS idx_course_graphics_confidence ON public.course_graphics(confidence)
WHERE confidence >= 0.9;

-- ============================================================================
-- 3. CREATE STORAGE BUCKET
-- ============================================================================

-- Create storage bucket for extracted course graphics
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-graphics',
  'course-graphics',
  true, -- Public for easy access in revision cards
  10485760, -- 10MB limit (graphics can be large)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES - TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE public.course_graphics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their course graphics" ON public.course_graphics;
DROP POLICY IF EXISTS "Service role can manage course graphics" ON public.course_graphics;

-- Policy: Users can view graphics from their own courses or public courses
CREATE POLICY "Users can view their course graphics"
ON public.course_graphics FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = course_graphics.course_id
    AND courses.is_public = true
  )
);

-- Policy: Service role can manage all graphics (for automatic processing)
CREATE POLICY "Service role can manage course graphics"
ON public.course_graphics FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 5. STORAGE POLICIES
-- ============================================================================

-- Drop existing storage policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Service role can upload course graphics" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update course graphics" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete course graphics" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view course graphics" ON storage.objects;

-- Policy: Service role can upload graphics
CREATE POLICY "Service role can upload course graphics"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'course-graphics');

-- Policy: Service role can update graphics
CREATE POLICY "Service role can update course graphics"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'course-graphics');

-- Policy: Service role can delete graphics
CREATE POLICY "Service role can delete course graphics"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'course-graphics');

-- Policy: Anyone can view graphics (public bucket)
CREATE POLICY "Anyone can view course graphics"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-graphics');

-- ============================================================================
-- 6. TRIGGER: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_course_graphics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_update_course_graphics_updated_at ON public.course_graphics;

CREATE TRIGGER trigger_update_course_graphics_updated_at
  BEFORE UPDATE ON public.course_graphics
  FOR EACH ROW
  EXECUTE FUNCTION update_course_graphics_updated_at();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'course_graphics';

-- Check bucket exists
SELECT id, name, public
FROM storage.buckets
WHERE id = 'course-graphics';

-- Check policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE tablename = 'course_graphics'
ORDER BY policyname;
