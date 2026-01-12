-- Migration 029: Remove graphic_type constraint for universal subject support
--
-- RATIONALE:
-- The original CHECK constraint limited graphic types to 5 predefined French types,
-- which blocked the V2 prompts that use intelligent type detection across ALL subjects.
--
-- This migration removes the constraint entirely to allow Claude Vision to:
-- - Detect ANY type of pedagogical graphic across ALL academic subjects
-- - Adapt type names to the specific domain (economics, physics, biology, etc.)
-- - Use descriptive labels like: force_diagram, molecular_structure, anatomical_chart,
--   flowchart, timeline, map, UML_diagram, circuit_schematic, etc.
--
-- The AI model's intelligence ensures appropriate type classification without
-- requiring a restrictive database constraint.
--
-- SUPPORTED SUBJECTS: Economics, Mathematics, Physics, Chemistry, Biology, History,
-- Computer Science, Geography, Medicine, Engineering, and ANY other academic field.
--
-- ============================================================================
-- 1. DROP OLD CONSTRAINT - ALLOW UNIVERSAL GRAPHIC TYPES
-- ============================================================================

-- Drop the restrictive CHECK constraint
ALTER TABLE public.course_graphics
DROP CONSTRAINT IF EXISTS course_graphics_graphic_type_check;

-- Comment on column to document the open type system
COMMENT ON COLUMN public.course_graphics.graphic_type IS 'Open-ended graphic type determined by Claude Vision AI. Supports any academic subject. Examples: supply_demand_curve, force_diagram, molecular_structure, flowchart, timeline, etc.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify constraint was updated
SELECT
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'course_graphics'
  AND tc.constraint_type = 'CHECK'
  AND tc.constraint_name = 'course_graphics_graphic_type_check';

-- Check current distribution of types
SELECT
  graphic_type,
  COUNT(*) as count,
  ROUND(AVG(confidence) * 100) as avg_confidence
FROM public.course_graphics
WHERE graphic_type IS NOT NULL
GROUP BY graphic_type
ORDER BY count DESC;
