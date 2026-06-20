-- ============================================================================
-- Gamification: call quality scores + help docs tracking
-- ============================================================================
-- Run AFTER create-broker-profiles.sql.
-- After running, regenerate types:  npm run db:types
-- ============================================================================

-- 1. Track whether the broker has visited the help docs ----------------------
ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS help_docs_viewed boolean NOT NULL DEFAULT false;

-- 2. Per-broker running call-quality score -----------------------------------
-- Incremented each time the AI call analysis API detects qualifying questions.
-- One row per broker; uses UPSERT to accumulate over time.
CREATE TABLE IF NOT EXISTS public.broker_call_quality_scores (
  broker_id                uuid PRIMARY KEY REFERENCES public.brokers(id) ON DELETE CASCADE,
  qualifying_questions_hit int  NOT NULL DEFAULT 0,  -- cumulative total
  calls_analyzed           int  NOT NULL DEFAULT 0,  -- cumulative calls processed
  last_updated             timestamptz NOT NULL DEFAULT now()
);

-- RLS: admins/coaches write; brokers read their own
ALTER TABLE public.broker_call_quality_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_quality_select" ON public.broker_call_quality_scores;
CREATE POLICY "call_quality_select"
  ON public.broker_call_quality_scores FOR SELECT
  TO authenticated
  USING (
    broker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.brokers
      WHERE id = auth.uid()
        AND (is_admin = true OR is_sales_coach = true OR is_manager = true)
    )
  );

-- 3. RPC helper used by the analyze-call-quality API to accumulate scores ----
CREATE OR REPLACE FUNCTION public.increment_call_quality_score(
  p_broker_id      uuid,
  p_questions_hit  int,
  p_calls_analyzed int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.broker_call_quality_scores
    (broker_id, qualifying_questions_hit, calls_analyzed, last_updated)
  VALUES
    (p_broker_id, p_questions_hit, p_calls_analyzed, now())
  ON CONFLICT (broker_id) DO UPDATE SET
    qualifying_questions_hit = broker_call_quality_scores.qualifying_questions_hit + EXCLUDED.qualifying_questions_hit,
    calls_analyzed           = broker_call_quality_scores.calls_analyzed           + EXCLUDED.calls_analyzed,
    last_updated             = now();
END;
$$;

-- ============================================================================
-- Done.
-- ============================================================================
