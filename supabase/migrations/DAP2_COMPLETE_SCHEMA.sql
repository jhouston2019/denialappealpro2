-- =============================================================================
-- DAP2_COMPLETE_SCHEMA.sql
-- Denial Appeal Pro — single combined migration for a fresh Supabase project
--
-- Merged from supabase/migrations/* in application order.
-- EXCLUDED: 01_seed_example_reports.sql (ERP demo seed data)
-- EXCLUDED: add_usage_tracking.sql (legacy profiles/org schema — conflicts with teams model)
--
-- Conflict resolutions:
--   • users.plan_type / teams.plan_type: unified final CHECK incl. essential, premier, bulk_*
--   • user_review_usage: merged 06 + 20260423 (user_id PK + billing period columns)
--   • stripe_webhook_events: deduplicated (20260418 + 20260422)
--   • reviews: single CREATE with all columns (insured_name, letter_text, letter_type)
--   • subscription_plans: DAP2 plan rows (not ERP litigation tiers)
--   • uuid_generate_v4() → gen_random_uuid() for Supabase compatibility
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. USERS (00_create_users_table.sql + billing/admin migrations)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  plan_type TEXT,
  payment_verification_status TEXT,
  is_paid BOOLEAN DEFAULT FALSE,
  team_id UUID,
  role TEXT CHECK (role IN ('owner', 'member')) DEFAULT 'owner',
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS users_is_admin_idx ON public.users(is_admin) WHERE is_admin = true;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_plan_type_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_plan_type_check
  CHECK (
    plan_type IS NULL
    OR plan_type IN (
      'single',
      'essential',
      'professional',
      'enterprise',
      'premier',
      'bulk_10',
      'bulk_25',
      'bulk_50',
      'bulk_100'
    )
  );

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS users_team_id_idx ON public.users(team_id);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own data" ON public.users;
CREATE POLICY "Users can read own data"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own data" ON public.users;
CREATE POLICY "Users can update own data"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
CREATE POLICY "Admins can read all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Users can insert own row" ON public.users;
CREATE POLICY "Users can insert own row"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT SELECT, UPDATE, INSERT ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;

COMMENT ON COLUMN public.users.is_admin IS 'When true, user may read all users via RLS; set only in DB.';

-- ---------------------------------------------------------------------------
-- 2. TEAMS, REPORTS, TEAM USAGE (20260210_pricing_schema.sql)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_subscription_status TEXT,
  review_limit INTEGER NOT NULL,
  overage_price INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_plan_type_check;
ALTER TABLE public.teams
  ADD CONSTRAINT teams_plan_type_check
  CHECK (plan_type IN ('essential', 'professional', 'enterprise', 'premier'));

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_team_id_fkey,
  ADD CONSTRAINT users_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  estimate_name TEXT NOT NULL,
  estimate_type TEXT,
  damage_type TEXT,
  result_json JSONB NOT NULL,
  paid_single_use BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  format_detected TEXT,
  region TEXT,
  overall_score INTEGER,
  pricing_variance NUMERIC,
  depreciation_score INTEGER,
  labor_score INTEGER,
  carrier_tactics_count INTEGER,
  processing_time_ms INTEGER,
  reconstructed_value NUMERIC(12,2),
  recovery_opportunity NUMERIC(12,2),
  litigation_evidence_generated BOOLEAN DEFAULT FALSE,
  carrier_pattern_logged BOOLEAN DEFAULT FALSE,
  scope_reconstruction_data JSONB,
  CONSTRAINT single_use_expires CHECK (
    (paid_single_use = TRUE AND expires_at IS NOT NULL) OR
    (paid_single_use = FALSE)
  )
);

CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  review_count INTEGER DEFAULT 0,
  overage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_team ON public.users(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_subscription ON public.teams(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_team ON public.reports(team_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_overall_score ON public.reports(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_reports_region ON public.reports(region);
CREATE INDEX IF NOT EXISTS idx_reports_format ON public.reports(format_detected);
CREATE INDEX IF NOT EXISTS idx_usage_team_month ON public.usage_tracking(team_id, month_year);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own team" ON public.teams;
CREATE POLICY "Users can view their own team"
  ON public.teams FOR SELECT
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT team_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Team owners can update their team" ON public.teams;
CREATE POLICY "Team owners can update their team"
  ON public.teams FOR UPDATE
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can create teams" ON public.teams;
CREATE POLICY "Users can create teams"
  ON public.teams FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  USING (
    user_id = auth.uid() OR
    team_id IN (SELECT team_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports"
  ON public.reports FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own reports" ON public.reports;
CREATE POLICY "Users can update their own reports"
  ON public.reports FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Team members can view usage" ON public.usage_tracking;
CREATE POLICY "Team members can view usage"
  ON public.usage_tracking FOR SELECT
  USING (
    team_id IN (SELECT team_id FROM public.users WHERE id = auth.uid()) OR
    team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "System can insert usage" ON public.usage_tracking;
CREATE POLICY "System can insert usage"
  ON public.usage_tracking FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update usage" ON public.usage_tracking;
CREATE POLICY "System can update usage"
  ON public.usage_tracking FOR UPDATE
  USING (true);

CREATE OR REPLACE FUNCTION public.get_team_usage(p_team_id UUID)
RETURNS TABLE (
  review_count INTEGER,
  overage_count INTEGER,
  review_limit INTEGER,
  overage_price INTEGER
) AS $$
DECLARE
  current_month TEXT;
BEGIN
  current_month := TO_CHAR(NOW(), 'YYYY-MM');
  RETURN QUERY
  SELECT
    COALESCE(ut.review_count, 0),
    COALESCE(ut.overage_count, 0),
    t.review_limit,
    t.overage_price
  FROM public.teams t
  LEFT JOIN public.usage_tracking ut
    ON ut.team_id = t.id AND ut.month_year = current_month
  WHERE t.id = p_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_team_usage(p_team_id UUID)
RETURNS VOID AS $$
DECLARE
  current_month TEXT;
  limit_count INTEGER;
BEGIN
  current_month := TO_CHAR(NOW(), 'YYYY-MM');
  SELECT review_limit INTO limit_count FROM public.teams WHERE id = p_team_id;
  INSERT INTO public.usage_tracking (team_id, month_year, review_count, overage_count)
  VALUES (p_team_id, current_month, 1, 0)
  ON CONFLICT (team_id, month_year)
  DO UPDATE SET
    review_count = public.usage_tracking.review_count + 1,
    overage_count = CASE
      WHEN public.usage_tracking.review_count >= limit_count
        THEN public.usage_tracking.overage_count + 1
      ELSE public.usage_tracking.overage_count
    END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.can_create_review(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  user_plan TEXT;
  user_team UUID;
  usage_data RECORD;
  single_review_count INTEGER;
BEGIN
  SELECT plan_type, team_id INTO user_plan, user_team FROM public.users WHERE id = p_user_id;
  IF user_plan IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'preview_only', true, 'requires_payment', true);
  END IF;
  IF user_plan = 'single' THEN
    SELECT COUNT(*) INTO single_review_count
    FROM public.reports
    WHERE user_id = p_user_id AND paid_single_use = true;
    IF single_review_count >= 1 THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'preview_only', false,
        'requires_payment', true,
        'message', 'Single review already used. Please upgrade to a subscription plan.'
      );
    END IF;
    RETURN jsonb_build_object('allowed', true, 'preview_only', false, 'plan_type', 'single', 'reviews_remaining', 1);
  END IF;
  IF user_team IS NOT NULL THEN
    SELECT * INTO usage_data FROM public.get_team_usage(user_team);
    RETURN jsonb_build_object(
      'allowed', true,
      'preview_only', false,
      'review_count', usage_data.review_count,
      'review_limit', usage_data.review_limit,
      'overage_count', usage_data.overage_count,
      'overage_price', usage_data.overage_price,
      'is_overage', usage_data.review_count >= usage_data.review_limit
    );
  END IF;
  RETURN jsonb_build_object('allowed', true, 'preview_only', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_usage_updated_at ON public.usage_tracking;
CREATE TRIGGER update_usage_updated_at
  BEFORE UPDATE ON public.usage_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.teams IS 'Team subscriptions for subscription plans';
COMMENT ON TABLE public.reports IS 'Legacy ERP estimate reports (dashboard export paths)';
COMMENT ON TABLE public.usage_tracking IS 'Monthly usage tracking per team';
COMMENT ON COLUMN public.teams.stripe_subscription_status IS 'Mirrors Stripe Subscription.status; updated by webhooks only.';

-- ---------------------------------------------------------------------------
-- 3. REVIEWS — DAP2 appeal letters (00_create_reviews_table + letter columns)
-- ---------------------------------------------------------------------------

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
  ON public.reviews FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can insert reviews" ON public.reviews;
CREATE POLICY "Service role can insert reviews"
  ON public.reviews FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update reviews" ON public.reviews;
CREATE POLICY "Service role can update reviews"
  ON public.reviews FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
CREATE POLICY "Users can update own reviews"
  ON public.reviews FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own reviews" ON public.reviews;
CREATE POLICY "Users can insert own reviews"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

-- ---------------------------------------------------------------------------
-- 4. SUBSCRIPTION BILLING (06_pricing_strategy_schema.sql — adapted for DAP2)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT,
  price NUMERIC(10,2) NOT NULL,
  reviews_per_month INTEGER,
  features JSONB DEFAULT '[]'::jsonb,
  plan_type TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_name ON public.subscription_plans(plan_name);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_plan_type ON public.subscription_plans(plan_type);

CREATE TABLE IF NOT EXISTS public.user_review_usage (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  reviews_used INTEGER NOT NULL DEFAULT 0,
  reviews_limit INTEGER NOT NULL DEFAULT 0,
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_review_usage_updated ON public.user_review_usage(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_review_usage_active ON public.user_review_usage(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_review_usage_period ON public.user_review_usage(billing_period_start, billing_period_end);

CREATE TABLE IF NOT EXISTS public.recovery_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  estimate_id TEXT,
  original_estimate_value NUMERIC(10,2),
  reconstructed_value NUMERIC(10,2),
  recovery_value NUMERIC(10,2) NOT NULL,
  carrier TEXT,
  claim_type TEXT,
  state TEXT,
  guarantee_triggered BOOLEAN DEFAULT false,
  refund_issued BOOLEAN DEFAULT false,
  refund_amount NUMERIC(10,2),
  stripe_refund_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_metrics_user ON public.recovery_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_metrics_report ON public.recovery_metrics(report_id);
CREATE INDEX IF NOT EXISTS idx_recovery_metrics_carrier ON public.recovery_metrics(carrier);
CREATE INDEX IF NOT EXISTS idx_recovery_metrics_guarantee ON public.recovery_metrics(guarantee_triggered);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_id TEXT NOT NULL,
  stripe_customer_id TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  payment_type TEXT NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL,
  refunded_amount NUMERIC(10,2) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe ON public.payment_transactions(stripe_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_review_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view subscription plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Users can view own usage" ON public.user_review_usage;
CREATE POLICY "Users can view own usage"
  ON public.user_review_usage FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own review usage" ON public.user_review_usage;
CREATE POLICY "Users read own review usage"
  ON public.user_review_usage FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage usage" ON public.user_review_usage;
CREATE POLICY "Service role can manage usage"
  ON public.user_review_usage FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own recovery metrics" ON public.recovery_metrics;
CREATE POLICY "Users can view own recovery metrics"
  ON public.recovery_metrics FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert recovery metrics" ON public.recovery_metrics;
CREATE POLICY "Service role can insert recovery metrics"
  ON public.recovery_metrics FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own transactions"
  ON public.payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage transactions" ON public.payment_transactions;
CREATE POLICY "Service role can manage transactions"
  ON public.payment_transactions FOR ALL
  USING (true) WITH CHECK (true);

INSERT INTO public.subscription_plans (plan_name, price, reviews_per_month, plan_type, features) VALUES
  ('Single', 9.00, 1, 'single', '["AI-generated appeal letters","PDF and EOB extraction"]'::jsonb),
  ('Essential', 79.00, 10, 'essential', '["10 appeals per month","Priority generation"]'::jsonb),
  ('Professional', 159.00, 25, 'professional', '["25 appeals per month","Bulk appeal processing"]'::jsonb),
  ('Enterprise', 259.00, 50, 'enterprise', '["50 appeals per month","Saved provider profiles"]'::jsonb),
  ('Bulk 10', 89.00, 10, 'bulk_10', '["10 prepaid appeals"]'::jsonb),
  ('Bulk 25', 199.00, 25, 'bulk_25', '["25 prepaid appeals"]'::jsonb),
  ('Bulk 50', 349.00, 50, 'bulk_50', '["50 prepaid appeals"]'::jsonb),
  ('Bulk 100', 699.00, 100, 'bulk_100', '["100 prepaid appeals"]'::jsonb)
ON CONFLICT (plan_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. STRIPE IDEMPOTENCY + CHECKOUT SESSION TRACKING
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_received_at_idx
  ON public.stripe_webhook_events(received_at DESC);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access to stripe_webhook_events" ON public.stripe_webhook_events;
CREATE POLICY "No client access to stripe_webhook_events"
  ON public.stripe_webhook_events FOR ALL
  USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.processed_sessions (
  session_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_processed_sessions_user_id
  ON public.processed_sessions(user_id);

ALTER TABLE public.processed_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access to processed_sessions" ON public.processed_sessions;
CREATE POLICY "No client access to processed_sessions"
  ON public.processed_sessions FOR ALL
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 6. PAID ACCESS RPC (20260418_billing_access_control.sql)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_has_paid_access()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_review_usage uru
    WHERE uru.user_id = uid
      AND COALESCE(uru.is_active, true) = true
      AND (
        uru.billing_period_end IS NULL
        OR uru.billing_period_end > NOW()
      )
      AND uru.reviews_limit > 0
      AND uru.reviews_used < uru.reviews_limit
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_review_usage uru
    WHERE uru.user_id = uid
      AND COALESCE(uru.is_active, true) = true
      AND (
        uru.billing_period_end IS NULL
        OR uru.billing_period_end > NOW()
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.users u
    LEFT JOIN public.teams t ON t.id = u.team_id
    WHERE u.id = uid
      AND (
        u.plan_type IS NOT NULL
        OR (
          u.team_id IS NOT NULL
          AND t.id IS NOT NULL
          AND COALESCE(t.stripe_subscription_status, 'active') IN (
            'active', 'trialing', 'past_due'
          )
        )
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_paid_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_paid_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_paid_access() TO service_role;

CREATE OR REPLACE FUNCTION public.get_user_plan_usage(user_id_param UUID)
RETURNS TABLE (
  plan_name TEXT,
  reviews_used INTEGER,
  reviews_limit INTEGER,
  reviews_remaining INTEGER,
  billing_period_end TIMESTAMPTZ,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.plan_name,
    uru.reviews_used,
    uru.reviews_limit,
    CASE
      WHEN uru.reviews_limit IS NULL THEN NULL
      ELSE GREATEST(uru.reviews_limit - uru.reviews_used, 0)
    END,
    uru.billing_period_end,
    COALESCE(uru.is_active, true)
  FROM public.user_review_usage uru
  LEFT JOIN public.subscription_plans sp ON uru.plan_id = sp.id
  WHERE uru.user_id = user_id_param
    AND COALESCE(uru.is_active, true) = true
  ORDER BY uru.updated_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.can_user_create_review(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  usage_record RECORD;
BEGIN
  SELECT * INTO usage_record
  FROM public.user_review_usage
  WHERE user_id = user_id_param
    AND COALESCE(is_active, true) = true
    AND (billing_period_end IS NULL OR billing_period_end > NOW())
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF usage_record.reviews_limit IS NULL THEN
    RETURN true;
  END IF;

  RETURN usage_record.reviews_used < usage_record.reviews_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_review_usage(user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.user_review_usage
  SET reviews_used = reviews_used + 1, updated_at = NOW()
  WHERE user_id = user_id_param
    AND COALESCE(is_active, true) = true
    AND (billing_period_end IS NULL OR billing_period_end > NOW());

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_plan_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_plan_usage(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_user_create_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_create_review(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_review_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_review_usage(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. PRICING & VALIDATION (03_pricing_and_validation_schema.sql)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pricing_database (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_code TEXT NOT NULL,
  item_code TEXT,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  base_price NUMERIC NOT NULL,
  price_source TEXT NOT NULL CHECK (price_source IN ('xactimate', 'rsmeans', 'market')),
  region TEXT NOT NULL,
  effective_date DATE NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_trade_region ON public.pricing_database(trade_code, region);
CREATE INDEX IF NOT EXISTS idx_pricing_item_code ON public.pricing_database(item_code);
CREATE INDEX IF NOT EXISTS idx_pricing_effective_date ON public.pricing_database(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_source ON public.pricing_database(price_source);

CREATE TABLE IF NOT EXISTS public.regional_multipliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  city TEXT,
  multiplier NUMERIC NOT NULL CHECK (multiplier > 0),
  effective_date DATE NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regional_state ON public.regional_multipliers(state);
CREATE INDEX IF NOT EXISTS idx_regional_effective_date ON public.regional_multipliers(effective_date DESC);

CREATE TABLE IF NOT EXISTS public.labor_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade TEXT NOT NULL,
  region TEXT NOT NULL,
  min_rate NUMERIC NOT NULL,
  avg_rate NUMERIC NOT NULL,
  max_rate NUMERIC NOT NULL,
  unit TEXT DEFAULT 'per hour',
  effective_date DATE NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  source TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trade, region, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_labor_trade_region ON public.labor_rates(trade, region);
CREATE INDEX IF NOT EXISTS idx_labor_effective_date ON public.labor_rates(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_labor_source ON public.labor_rates(source);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  engine_name TEXT NOT NULL,
  input_data JSONB,
  output_data JSONB,
  confidence_score NUMERIC,
  processing_time_ms INTEGER,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_report ON public.audit_events(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_type ON public.audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_engine ON public.audit_events(engine_name);

CREATE TABLE IF NOT EXISTS public.ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL,
  input_prompt TEXT,
  ai_response JSONB,
  confidence NUMERIC,
  fallback_used BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  model TEXT,
  temperature NUMERIC,
  tokens_used INTEGER,
  cost_usd NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_ai_report ON public.ai_decisions(report_id);
CREATE INDEX IF NOT EXISTS idx_ai_type ON public.ai_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_ai_timestamp ON public.ai_decisions(timestamp DESC);

ALTER TABLE public.pricing_database ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regional_multipliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view pricing data" ON public.pricing_database;
CREATE POLICY "Authenticated users can view pricing data"
  ON public.pricing_database FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can view regional multipliers" ON public.regional_multipliers;
CREATE POLICY "Authenticated users can view regional multipliers"
  ON public.regional_multipliers FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can view labor rates" ON public.labor_rates;
CREATE POLICY "Authenticated users can view labor rates"
  ON public.labor_rates FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view their own audit events" ON public.audit_events;
CREATE POLICY "Users can view their own audit events"
  ON public.audit_events FOR SELECT
  USING (report_id IN (SELECT id FROM public.reports WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their own AI decisions" ON public.ai_decisions;
CREATE POLICY "Users can view their own AI decisions"
  ON public.ai_decisions FOR SELECT
  USING (report_id IN (SELECT id FROM public.reports WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "System can insert audit events" ON public.audit_events;
CREATE POLICY "System can insert audit events"
  ON public.audit_events FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert AI decisions" ON public.ai_decisions;
CREATE POLICY "System can insert AI decisions"
  ON public.ai_decisions FOR INSERT
  WITH CHECK (true);

INSERT INTO public.regional_multipliers (region, state, city, multiplier, effective_date) VALUES
  ('CA-San Francisco', 'CA', 'San Francisco', 1.45, '2026-01-01'),
  ('CA-Los Angeles', 'CA', 'Los Angeles', 1.38, '2026-01-01'),
  ('CA-San Diego', 'CA', 'San Diego', 1.32, '2026-01-01'),
  ('NY-New York City', 'NY', 'New York', 1.42, '2026-01-01'),
  ('IL-Chicago', 'IL', 'Chicago', 1.15, '2026-01-01'),
  ('TX-Houston', 'TX', 'Houston', 0.95, '2026-01-01'),
  ('TX-Dallas', 'TX', 'Dallas', 0.98, '2026-01-01'),
  ('FL-Miami', 'FL', 'Miami', 1.08, '2026-01-01'),
  ('FL-Orlando', 'FL', 'Orlando', 1.02, '2026-01-01'),
  ('WA-Seattle', 'WA', 'Seattle', 1.28, '2026-01-01'),
  ('CO-Denver', 'CO', 'Denver', 1.12, '2026-01-01'),
  ('AZ-Phoenix', 'AZ', 'Phoenix', 0.98, '2026-01-01'),
  ('GA-Atlanta', 'GA', 'Atlanta', 1.05, '2026-01-01'),
  ('MA-Boston', 'MA', 'Boston', 1.35, '2026-01-01'),
  ('PA-Philadelphia', 'PA', 'Philadelphia', 1.18, '2026-01-01'),
  ('OR-Portland', 'OR', 'Portland', 1.18, '2026-01-01'),
  ('NV-Las Vegas', 'NV', 'Las Vegas', 1.05, '2026-01-01'),
  ('NC-Charlotte', 'NC', 'Charlotte', 0.96, '2026-01-01'),
  ('TN-Nashville', 'TN', 'Nashville', 0.94, '2026-01-01'),
  ('DEFAULT', 'US', NULL, 1.00, '2026-01-01')
ON CONFLICT (region) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_pricing_data(
  p_trade_code TEXT,
  p_region TEXT,
  p_unit TEXT DEFAULT NULL
)
RETURNS TABLE (
  item_code TEXT,
  description TEXT,
  unit TEXT,
  base_price NUMERIC,
  adjusted_price NUMERIC,
  price_source TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.item_code,
    pd.description,
    pd.unit,
    pd.base_price,
    pd.base_price * COALESCE(rm.multiplier, 1.0),
    pd.price_source
  FROM public.pricing_database pd
  LEFT JOIN public.regional_multipliers rm ON rm.region = p_region
  WHERE pd.trade_code = p_trade_code
    AND (p_unit IS NULL OR pd.unit = p_unit)
    AND pd.effective_date <= CURRENT_DATE
  ORDER BY pd.effective_date DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_labor_rate(p_trade TEXT, p_region TEXT)
RETURNS TABLE (min_rate NUMERIC, avg_rate NUMERIC, max_rate NUMERIC, source TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT lr.min_rate, lr.avg_rate, lr.max_rate, lr.source
  FROM public.labor_rates lr
  WHERE lr.trade = p_trade AND lr.region = p_region AND lr.effective_date <= CURRENT_DATE
  ORDER BY lr.effective_date DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT lr.min_rate, lr.avg_rate, lr.max_rate, lr.source
    FROM public.labor_rates lr
    WHERE lr.trade = p_trade AND lr.region = 'DEFAULT' AND lr.effective_date <= CURRENT_DATE
    ORDER BY lr.effective_date DESC
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 8. CLAIMS INTELLIGENCE (04_claims_intelligence_schema.sql — structure only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.carrier_behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_name TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  average_gap NUMERIC(12,2),
  states_observed TEXT[],
  total_claims_analyzed INTEGER DEFAULT 1,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scope_gap_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_type TEXT NOT NULL,
  missing_item TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  average_cost_impact NUMERIC(12,2),
  carriers_observed TEXT[],
  regions_observed TEXT[],
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pricing_deviation_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_code TEXT NOT NULL,
  line_item_description TEXT,
  expected_price NUMERIC(12,2),
  observed_price NUMERIC(12,2),
  suppression_rate NUMERIC(5,2),
  region TEXT,
  carrier TEXT,
  occurrences INTEGER DEFAULT 1,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.labor_rate_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  trade_type TEXT NOT NULL,
  industry_rate NUMERIC(10,2),
  carrier_rate NUMERIC(10,2),
  suppression_percentage NUMERIC(5,2),
  carrier TEXT,
  occurrences INTEGER DEFAULT 1,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.claim_recovery_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  claim_type TEXT,
  carrier TEXT,
  state TEXT,
  estimate_value NUMERIC(12,2),
  reconstructed_value NUMERIC(12,2),
  underpayment_gap NUMERIC(12,2),
  recovery_percentage NUMERIC(5,2),
  issues_detected JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.litigation_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL,
  evidence_data JSONB NOT NULL,
  industry_standard TEXT,
  carrier_deviation TEXT,
  financial_impact NUMERIC(12,2),
  supporting_documentation TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reconstructed_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  original_value NUMERIC(12,2),
  reconstructed_value NUMERIC(12,2),
  gap_value NUMERIC(12,2),
  missing_line_items JSONB,
  reconstruction_methodology TEXT,
  confidence_score NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrier_behavior_carrier ON public.carrier_behavior_patterns(carrier_name);
CREATE INDEX IF NOT EXISTS idx_scope_gap_trade ON public.scope_gap_patterns(trade_type);
CREATE INDEX IF NOT EXISTS idx_pricing_deviation_code ON public.pricing_deviation_patterns(line_item_code);
CREATE INDEX IF NOT EXISTS idx_labor_patterns_region ON public.labor_rate_patterns(region);
CREATE INDEX IF NOT EXISTS idx_recovery_carrier ON public.claim_recovery_patterns(carrier);
CREATE INDEX IF NOT EXISTS idx_litigation_report ON public.litigation_evidence(report_id);
CREATE INDEX IF NOT EXISTS idx_reconstructed_report ON public.reconstructed_estimates(report_id);

ALTER TABLE public.carrier_behavior_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scope_gap_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_deviation_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_rate_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_recovery_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.litigation_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconstructed_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view all carrier patterns" ON public.carrier_behavior_patterns;
CREATE POLICY "Admin can view all carrier patterns"
  ON public.carrier_behavior_patterns FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Service role can insert carrier patterns" ON public.carrier_behavior_patterns;
CREATE POLICY "Service role can insert carrier patterns"
  ON public.carrier_behavior_patterns FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own litigation evidence" ON public.litigation_evidence;
CREATE POLICY "Users can view own litigation evidence"
  ON public.litigation_evidence FOR SELECT
  USING (report_id IN (SELECT id FROM public.reports WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own reconstructed estimates" ON public.reconstructed_estimates;
CREATE POLICY "Users can view own reconstructed estimates"
  ON public.reconstructed_estimates FOR SELECT
  USING (report_id IN (SELECT id FROM public.reports WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role can insert litigation evidence" ON public.litigation_evidence;
CREATE POLICY "Service role can insert litigation evidence"
  ON public.litigation_evidence FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert reconstructed estimates" ON public.reconstructed_estimates;
CREATE POLICY "Service role can insert reconstructed estimates"
  ON public.reconstructed_estimates FOR INSERT WITH CHECK (true);

CREATE OR REPLACE VIEW public.carrier_underpayment_summary AS
SELECT carrier, COUNT(*) AS total_claims, AVG(underpayment_gap) AS avg_gap,
  SUM(underpayment_gap) AS total_gap, AVG(recovery_percentage) AS avg_recovery_pct
FROM public.claim_recovery_patterns GROUP BY carrier;

CREATE OR REPLACE VIEW public.top_scope_gaps AS
SELECT trade_type, missing_item, frequency, average_cost_impact
FROM public.scope_gap_patterns ORDER BY frequency DESC LIMIT 50;

GRANT SELECT ON public.carrier_behavior_patterns TO authenticated;
GRANT SELECT ON public.scope_gap_patterns TO authenticated;
GRANT SELECT ON public.pricing_deviation_patterns TO authenticated;
GRANT SELECT ON public.labor_rate_patterns TO authenticated;
GRANT SELECT ON public.claim_recovery_patterns TO authenticated;
GRANT SELECT ON public.litigation_evidence TO authenticated;
GRANT SELECT ON public.reconstructed_estimates TO authenticated;
GRANT SELECT ON public.carrier_underpayment_summary TO authenticated;
GRANT SELECT ON public.top_scope_gaps TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. CODE COMPLIANCE (05_code_compliance_schema.sql)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.code_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction TEXT NOT NULL,
  code_reference TEXT NOT NULL,
  requirement TEXT NOT NULL,
  trigger_trade TEXT NOT NULL,
  required_item TEXT NOT NULL,
  estimated_cost NUMERIC(10,2),
  unit TEXT,
  estimated_quantity NUMERIC(10,2),
  severity TEXT DEFAULT 'HIGH',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_requirements_jurisdiction ON public.code_requirements(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_code_requirements_trade ON public.code_requirements(trigger_trade);

ALTER TABLE public.code_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view code requirements" ON public.code_requirements;
CREATE POLICY "Anyone can view code requirements"
  ON public.code_requirements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can insert code requirements" ON public.code_requirements;
CREATE POLICY "Service role can insert code requirements"
  ON public.code_requirements FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_code_requirements_for_trade(
  trade_param TEXT,
  jurisdiction_param TEXT DEFAULT 'National'
)
RETURNS TABLE (
  code_reference TEXT,
  requirement TEXT,
  required_item TEXT,
  estimated_cost NUMERIC,
  severity TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT cr.code_reference, cr.requirement, cr.required_item, cr.estimated_cost, cr.severity
  FROM public.code_requirements cr
  WHERE cr.trigger_trade = trade_param
    AND (cr.jurisdiction = jurisdiction_param OR cr.jurisdiction = 'National')
  ORDER BY CASE cr.severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT ON public.code_requirements TO authenticated;
GRANT SELECT ON public.code_requirements TO anon;

INSERT INTO public.code_requirements (jurisdiction, code_reference, requirement, trigger_trade, required_item, estimated_cost, unit, estimated_quantity, severity)
SELECT * FROM (VALUES
  ('National', 'IRC R903.2', 'Drip edge required at all roof edges', 'Roofing', 'drip edge', 1200.00, 'LF', 120, 'HIGH'),
  ('National', 'NEC 110.3', 'Electrical work requires permit', 'Electrical', 'permit', 400.00, 'EA', 1, 'CRITICAL'),
  ('National', 'IPC 106', 'Plumbing work requires permit', 'Plumbing', 'permit', 350.00, 'EA', 1, 'CRITICAL'),
  ('Florida', 'Florida Building Code', 'Hurricane straps required', 'Roofing', 'hurricane straps', 1200.00, 'EA', 40, 'CRITICAL')
) AS v(jurisdiction, code_reference, requirement, trigger_trade, required_item, estimated_cost, unit, estimated_quantity, severity)
WHERE NOT EXISTS (
  SELECT 1 FROM public.code_requirements cr
  WHERE cr.jurisdiction = v.jurisdiction AND cr.code_reference = v.code_reference AND cr.required_item = v.required_item
);

-- ---------------------------------------------------------------------------
-- 10. LEGACY REPORT SUMMARY VIEW (from 01_seed tail — structure only, no seed)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.report_summary AS
SELECT
  r.id,
  r.estimate_name,
  r.estimate_type,
  r.damage_type,
  r.created_at,
  u.email AS user_email,
  t.name AS team_name,
  (r.result_json->'classification'->>'classification') AS classification_type,
  (r.result_json->'classification'->>'confidence') AS confidence,
  (r.result_json->'property_details'->>'total_estimate_value') AS estimate_value,
  (r.result_json->>'risk_level') AS risk_level,
  (r.result_json->'total_missing_value_estimate'->>'low') AS missing_value_low,
  (r.result_json->'total_missing_value_estimate'->>'high') AS missing_value_high,
  jsonb_array_length(COALESCE(r.result_json->'detected_trades', '[]'::jsonb)) AS trade_count,
  jsonb_array_length(COALESCE(r.result_json->'missing_items', '[]'::jsonb)) AS missing_item_count,
  jsonb_array_length(COALESCE(r.result_json->'quantity_issues', '[]'::jsonb)) AS quantity_issue_count
FROM public.reports r
LEFT JOIN public.users u ON r.user_id = u.id
LEFT JOIN public.teams t ON r.team_id = t.id;

GRANT SELECT ON public.report_summary TO authenticated;

-- ---------------------------------------------------------------------------
-- 11. TABLE GRANTS
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT ON public.user_review_usage TO authenticated;
GRANT SELECT ON public.recovery_metrics TO authenticated;
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT SELECT ON public.pricing_database TO authenticated;
GRANT SELECT ON public.regional_multipliers TO authenticated;
GRANT SELECT ON public.labor_rates TO authenticated;

COMMENT ON SCHEMA public IS 'Denial Appeal Pro (DAP2) combined schema';

-- =============================================================================
-- END DAP2_COMPLETE_SCHEMA.sql
-- =============================================================================
