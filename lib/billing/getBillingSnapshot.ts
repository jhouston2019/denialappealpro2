import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  formatPlanDisplayName,
  normalizePlanType,
  PLAN_CONFIG,
  resolveEffectiveReviewLimit,
  reviewsRemaining,
} from "@/lib/billing/planLimits";

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-11-17.clover",
    });
  }
  return stripeClient;
}

export type BillingSnapshot = {
  plan: string;
  plan_display_name: string;
  status: "active" | "inactive";
  renewal_date: string | null;
  billing_period_end: string | null;
  /** Reviews consumed this period (same source as `/api/usage` `used`). */
  usage: number;
  /** Plan review cap when applicable (same source as `/api/usage` `limit`). */
  reviews_limit: number;
  reviews_remaining: number;
  billing_cadence: "one_time" | "monthly" | null;
  /** Whether the user belongs to a team (for tier / upsell UI). */
  has_team: boolean;
};

export async function getBillingSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<BillingSnapshot> {
  const { data: u } = await supabase
    .from("users")
    .select("plan_type, team_id")
    .eq("id", userId)
    .maybeSingle();

  const row = u as { plan_type: string | null; team_id: string | null } | null;
  const planType = row?.plan_type ?? null;
  const planLabel = planType ?? "none";
  const has_team = !!row?.team_id;
  const normalizedPlan = normalizePlanType(planType);

  const { data: paid } = await supabase.rpc("user_has_paid_access");
  let status: "active" | "inactive" =
    paid === true ? "active" : "inactive";

  let renewal_date: string | null = null;
  let teamReviewLimit: number | null = null;

  if (row?.team_id) {
    const { data: team } = await supabase
      .from("teams")
      .select("stripe_subscription_id, stripe_subscription_status, review_limit")
      .eq("id", row.team_id)
      .maybeSingle();

    const t = team as {
      stripe_subscription_id: string | null;
      stripe_subscription_status: string | null;
      review_limit: number | null;
    } | null;

    if (t?.review_limit != null && t.review_limit > 0) {
      teamReviewLimit = t.review_limit;
    }

    if (t?.stripe_subscription_id) {
      try {
        const sub = await getStripe().subscriptions.retrieve(t.stripe_subscription_id);
        const cpe = (sub as { current_period_end?: number }).current_period_end;
        if (typeof cpe === "number") {
          renewal_date = new Date(cpe * 1000).toISOString();
        }
        status =
          sub.status === "active" || sub.status === "trialing"
            ? "active"
            : "inactive";
      } catch (e) {
        console.warn("[getBillingSnapshot] subscription retrieve:", e);
      }
    }
  }

  let usage = 0;
  let storedLimit = 0;
  let billing_period_end: string | null = null;

  const { data: usageRow } = await supabase
    .from("user_review_usage")
    .select("reviews_used, reviews_limit")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  const ur = usageRow as {
    reviews_used: number | null;
    reviews_limit: number | null;
  } | null;
  usage = ur?.reviews_used ?? 0;
  storedLimit = ur?.reviews_limit ?? 0;

  const { count: savedReviewCount } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (savedReviewCount != null && savedReviewCount > usage) {
    usage = savedReviewCount;
  }

  const { data: rpcData } = await (
    supabase as unknown as {
      rpc: (
        n: string,
        a: { user_id_param: string }
      ) => Promise<{ data: unknown }>;
    }
  ).rpc("get_user_plan_usage", { user_id_param: userId });

  if (Array.isArray(rpcData) && rpcData[0] && typeof rpcData[0] === "object") {
    const rpcRow = rpcData[0] as {
      reviews_used?: number;
      reviews_limit?: number | null;
      billing_period_end?: string | null;
    };
    if (usage === 0 && (rpcRow.reviews_used ?? 0) > 0) {
      usage = rpcRow.reviews_used ?? 0;
    }
    if (storedLimit <= 0 && (rpcRow.reviews_limit ?? 0) > 0) {
      storedLimit = rpcRow.reviews_limit ?? 0;
    }
    billing_period_end = rpcRow.billing_period_end ?? null;
  }

  const reviews_limit = resolveEffectiveReviewLimit({
    planType,
    storedLimit,
    teamReviewLimit,
  });

  const remaining = reviewsRemaining(usage, reviews_limit);
  const billing_cadence = normalizedPlan
    ? PLAN_CONFIG[normalizedPlan].billingCadence
    : null;

  if (!billing_period_end && renewal_date) {
    billing_period_end = renewal_date;
  }

  return {
    plan: planLabel,
    plan_display_name: formatPlanDisplayName(planType),
    status,
    renewal_date,
    billing_period_end,
    usage,
    reviews_limit,
    reviews_remaining: remaining,
    billing_cadence,
    has_team,
  };
}
