-- ============================================================================
-- ADD DELETE POLICY FOR CHALLENGES
-- Allows hosts to delete their own challenges
-- ============================================================================

-- Drop policy if it exists (idempotent)
DROP POLICY IF EXISTS "Hosts can delete own challenges" ON public.challenges;

-- Allow hosts to delete their own challenges (except those in 'playing' status)
CREATE POLICY "Hosts can delete own challenges" ON public.challenges
  FOR DELETE USING (auth.uid() = host_id AND status != 'playing');

-- Also add delete policies for related tables (for cleanup)
DROP POLICY IF EXISTS "Hosts can delete challenge players" ON public.challenge_players;
CREATE POLICY "Hosts can delete challenge players" ON public.challenge_players
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.challenges
      WHERE id = challenge_id AND host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Hosts can delete challenge questions" ON public.challenge_questions;
CREATE POLICY "Hosts can delete challenge questions" ON public.challenge_questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.challenges
      WHERE id = challenge_id AND host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Hosts can delete challenge answers" ON public.challenge_answers;
CREATE POLICY "Hosts can delete challenge answers" ON public.challenge_answers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.challenges
      WHERE id = challenge_id AND host_id = auth.uid()
    )
  );
