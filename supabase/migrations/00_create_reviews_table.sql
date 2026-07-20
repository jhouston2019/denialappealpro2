-- Denial Appeal Pro: saved appeal letters (reviews table)
-- Base schema for fresh deploys. Later migrations may ADD COLUMN IF NOT EXISTS safely.

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contractor_estimate_url TEXT,
  carrier_estimate_url TEXT,
  ai_analysis_json JSONB,
  ai_comparison_json JSONB,
  ai_summary_json JSONB,
  insured_name TEXT,
  letter_text TEXT,
  letter_type TEXT,
  pdf_report_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON public.reviews(created_at DESC);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own reviews" ON public.reviews;
CREATE POLICY "Users can read own reviews"
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can insert reviews" ON public.reviews;
CREATE POLICY "Service role can insert reviews"
  ON public.reviews
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update reviews" ON public.reviews;
CREATE POLICY "Service role can update reviews"
  ON public.reviews
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
CREATE POLICY "Users can update own reviews"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own reviews" ON public.reviews;
CREATE POLICY "Users can insert own reviews"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
