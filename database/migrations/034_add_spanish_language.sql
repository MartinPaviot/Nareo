-- Migration: Add Spanish language support for badges
-- This migration adds Spanish (es) columns to the badges table

-- Add Spanish name and description columns to badges table
ALTER TABLE badges
ADD COLUMN IF NOT EXISTS name_es TEXT,
ADD COLUMN IF NOT EXISTS description_es TEXT;

-- Update existing badges with Spanish translations
UPDATE badges SET
  name_es = CASE code
    WHEN 'first_quiz' THEN 'Primer quiz'
    WHEN 'quiz_master' THEN 'Maestro del quiz'
    WHEN 'perfect_score' THEN 'Puntuación perfecta'
    WHEN 'streak_7' THEN 'Racha de 7 días'
    WHEN 'streak_30' THEN 'Racha de 30 días'
    WHEN 'early_bird' THEN 'Madrugador'
    WHEN 'night_owl' THEN 'Noctámbulo'
    WHEN 'quick_learner' THEN 'Aprendiz rápido'
    WHEN 'dedicated' THEN 'Dedicado'
    WHEN 'explorer' THEN 'Explorador'
    WHEN 'chapter_complete' THEN 'Capítulo completado'
    WHEN 'course_complete' THEN 'Curso completado'
    WHEN 'flashcard_master' THEN 'Maestro de flashcards'
    WHEN 'first_star' THEN 'Primera estrella'
    ELSE name_en
  END,
  description_es = CASE code
    WHEN 'first_quiz' THEN '¡Completaste tu primer quiz!'
    WHEN 'quiz_master' THEN 'Completa 10 quizzes'
    WHEN 'perfect_score' THEN 'Obtén 100% en un quiz'
    WHEN 'streak_7' THEN 'Mantén una racha de 7 días'
    WHEN 'streak_30' THEN 'Mantén una racha de 30 días'
    WHEN 'early_bird' THEN 'Estudia antes de las 8am'
    WHEN 'night_owl' THEN 'Estudia después de las 10pm'
    WHEN 'quick_learner' THEN 'Completa un capítulo en menos de 5 minutos'
    WHEN 'dedicated' THEN 'Estudia durante más de 1 hora'
    WHEN 'explorer' THEN 'Prueba todas las funciones'
    WHEN 'chapter_complete' THEN 'Completa un capítulo'
    WHEN 'course_complete' THEN 'Completa un curso entero'
    WHEN 'flashcard_master' THEN 'Domina 50 flashcards'
    WHEN 'first_star' THEN '¡Completaste tu primer quiz!'
    ELSE description_en
  END
WHERE name_es IS NULL;

-- Set default values for any remaining NULL values
UPDATE badges SET
  name_es = COALESCE(name_es, name_en),
  description_es = COALESCE(description_es, description_en);
