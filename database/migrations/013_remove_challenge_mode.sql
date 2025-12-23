-- ============================================================================
-- Migration: Suppression du mode de challenge (mode colonne plus nécessaire)
-- Le nombre de questions dépend maintenant des questions disponibles
-- Seul le temps par question reste configurable
-- ============================================================================

-- Supprimer la colonne mode si elle existe
ALTER TABLE challenges DROP COLUMN IF EXISTS mode;
