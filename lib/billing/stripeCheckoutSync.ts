import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { applyAdminAppMetadataForUserId } from "@/lib/auth/adminAppMetadata";
import { getPlanReviewLimit } from "@/lib/billing/planLimits";
import {
  ensureUserForPaidCheckout,
  ensureUserForStripeSubscription,
} from "./stripeLinkUser";

/** Align with SQL `NOW() + INTERVAL '1 month'` (calendar month). */
function billingPeriodEndOneMonthFromNow(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Keep JWT `app_metadata.plan_type` in sync with `public.users` (edge middleware reads JWT only).
 * Merges with existing `app_metadata` so other claims (e.g. `is_admin`) are preserved.
 */
export async function syncUserPlanTypeToAuthMetadata(
  userId: string,
  planType: string | null
): Promise<void> {
  const { data: existing, error: getErr } =
    await supabase.auth.admin.getUserById(userId);
  if (getErr) {
    console.error(
      "[syncUserPlanTypeToAuthMetadata] getUserById failed:",
      userId,
      getErr
    );
    return;
  }
  if (!existing.user) return;

  const raw = existing.user.app_metadata;
  const base: Record<string, unknown> =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  if (planType == null) {
    base.plan_type = null;
  } else {
    base.plan_type = planType;
  }

  const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: base,
  });
  if (updErr) {
    console.error(
      "[syncUserPlanTypeToAuthMetadata] updateUserById failed:",
      userId,
      updErr
    );
  }
}

/**
 * After checkout sets users.plan_type, create user_review_usage if none yet.
 */
export async function ensureUserReviewUsageRow(
  userId: string,
  planType: string
): Promise<void> {
  if (!planType || planType === "none") return;

  const { data: existingUsage } = await supabase
    .from("user_review_usage")
    .select("user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (existingUsage) return;

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id, reviews_per_month")
    .eq("plan_type", planType)
    .maybeSingle();

  const configuredLimit = getPlanReviewLimit(planType);
  const reviewsLimit = plan?.reviews_per_month ?? configuredLimit ?? 0;

  if (!plan && configuredLimit == null) {
    console.warn(
      "[ensureUserReviewUsageRow] No subscription_plans row for plan_type:",
      planType
    );
    return;
  }

  const insertRow: Record<string, unknown> = {
    user_id: userId,
    reviews_used: 0,
    reviews_limit: reviewsLimit,
    billing_period_start: new Date().toISOString(),
    billing_period_end: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString(),
    is_active: true,
  };
  if (plan?.id) {
    insertRow.plan_id = plan.id;
  }

  const { error } = await supabase.from("user_review_usage").insert(insertRow);

  if (error) {
    console.error("[ensureUserReviewUsageRow] insert failed:", error);
  }
}

function normalizeUserPlanType(
  raw: string | undefined,
  planName: string | undefined
):
  | "essential"
  | "professional"
  | "enterprise"
  | "premier"
  | null {
  const p = (raw || "").toLowerCase();
  const n = (planName || "").toLowerCase();
  if (!p && !n) return null;
  if (p === "single") return null;
  if (p === "essential" || n.includes("essential")) return "essential";
  if (p === "professional" || n.includes("professional")) {
    return "professional";
  }
  if (p === "premier" || n.includes("premier")) return "premier";
  if (
    p === "subscription" ||
    p === "enterprise" ||
    n.includes("enterprise")
  ) {
    return "enterprise";
  }
  return "enterprise";
}

export async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription
) {
  const metadata = subscription.metadata;
  const planNameMeta = metadata.plan_name;
  const planType = normalizeUserPlanType(metadata.plan_type, planNameMeta);
  const reviewLimit = parseInt(metadata.review_limit || "0", 10);
  const overagePrice = parseInt(metadata.overage_price || "0", 10);

  if (!planType) return;

  const subStatus = subscription.status;

  const userId = await ensureUserForStripeSubscription(subscription);
  if (!userId) return;

  const { data: existingTeam } = await supabase
    .from("teams")
    .select("*")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (existingTeam) {
    const { data: teamMembers } = await supabase
      .from("users")
      .select("id")
      .eq("team_id", existingTeam.id);

    await supabase
      .from("teams")
      .update({
        plan_type: planType,
        review_limit: reviewLimit,
        overage_price: overagePrice,
        stripe_subscription_status: subStatus,
      })
      .eq("id", existingTeam.id);

    await supabase
      .from("users")
      .update({ plan_type: planType })
      .eq("team_id", existingTeam.id);

    for (const m of teamMembers ?? []) {
      await ensureUserReviewUsageRow(m.id, planType);
      await syncUserPlanTypeToAuthMetadata(m.id, planType);
    }
    const adminIds = new Set<string>([
      userId,
      ...(teamMembers ?? []).map((m) => m.id),
    ]);
    for (const id of adminIds) {
      await applyAdminAppMetadataForUserId(supabase, id);
    }
  } else {
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        name: `${planType.charAt(0).toUpperCase() + planType.slice(1)} Team`,
        owner_id: userId,
        plan_type: planType,
        stripe_subscription_id: subscription.id,
        stripe_subscription_status: subStatus,
        review_limit: reviewLimit,
        overage_price: overagePrice,
      })
      .select()
      .single();

    if (teamError) {
      console.error("Failed to create team:", teamError);
      return;
    }

    await supabase
      .from("users")
      .update({
        team_id: team.id,
        plan_type: planType,
        role: "owner",
      })
      .eq("id", userId);

    await ensureUserReviewUsageRow(userId, planType);
    await syncUserPlanTypeToAuthMetadata(userId, planType);
  }

  console.log(`Subscription ${subscription.id} updated for user ${userId}`);
}

/**
 * Checkout completion: link user via Stripe customer id / metadata, then mirror plans.
 */
export async function syncStripeCheckoutSession(
  session: Stripe.Checkout.Session,
  opts?: { trustedUserId: string }
): Promise<string | null> {
  const metadata = session.metadata;

  const userId = await ensureUserForPaidCheckout(session, opts?.trustedUserId);
  if (!userId) {
    return null;
  }

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer &&
          typeof session.customer === "object" &&
          "id" in session.customer
        ? (session.customer as Stripe.Customer).id
        : null;
  if (stripeCustomerId) {
    await supabase
      .from("users")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", userId);
  }

  if (metadata?.plan_type === "single") {
    await supabase
      .from("users")
      .update({ plan_type: "single" })
      .eq("id", userId);

    await syncUserPlanTypeToAuthMetadata(userId, "single");

    // Create usage row if it doesn't exist
    await ensureUserReviewUsageRow(userId, "single");

    console.log(`Single plan payment completed for user ${userId}`);
  }

  if (metadata?.type === "single_plan") {
    const legacyUserId = metadata.user_id;
    if (legacyUserId) {
      if (opts?.trustedUserId && legacyUserId !== opts.trustedUserId) {
        console.warn(
          "[syncStripeCheckoutSession] single_plan metadata user_id mismatch, skipping"
        );
      } else {
        await supabase
          .from("users")
          .update({ plan_type: "single" })
          .eq("id", legacyUserId);

        await syncUserPlanTypeToAuthMetadata(legacyUserId, "single");

        // Create usage row if it doesn't exist
        await ensureUserReviewUsageRow(legacyUserId, "single");

        await applyAdminAppMetadataForUserId(supabase, legacyUserId);

        console.log(`Single plan payment completed for user ${legacyUserId}`);
      }
    }
  }

  if (metadata?.type === "single_review") {
    const reportId = metadata.report_id;
    const reportUserId = metadata.user_id;

    if (!reportId || !reportUserId) return userId;
    if (opts?.trustedUserId && reportUserId !== opts.trustedUserId) {
      console.warn(
        "[syncStripeCheckoutSession] single_review user_id mismatch, skipping"
      );
      return userId;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await supabase
      .from("reports")
      .update({
        paid_single_use: true,
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", reportId)
      .eq("user_id", reportUserId);

    console.log(`Single review payment completed for report ${reportId}`);
  }

  if (session.mode === "subscription" && session.subscription) {
    const subField = session.subscription;
    const subscription: Stripe.Subscription =
      typeof subField === "string"
        ? await stripe.subscriptions.retrieve(subField)
        : (subField as Stripe.Subscription);
    await handleSubscriptionUpdate(subscription);

    const sessionPlanFromCheckout = (
      metadata?.plan_type ?? ""
    ).toLowerCase();
    if (
      sessionPlanFromCheckout === "essential" ||
      sessionPlanFromCheckout === "professional" ||
      sessionPlanFromCheckout === "enterprise" ||
      sessionPlanFromCheckout === "premier"
    ) {
      await supabase
        .from("users")
        .update({
          plan_type: sessionPlanFromCheckout as
            | "essential"
            | "professional"
            | "enterprise"
            | "premier",
        })
        .eq("id", userId);

      await syncUserPlanTypeToAuthMetadata(userId, sessionPlanFromCheckout);
    }

    // Create usage row if it doesn't exist (use final plan_type on user after subscription + checkout updates)
    const { data: userAfterSub } = await supabase
      .from("users")
      .select("plan_type")
      .eq("id", userId)
      .maybeSingle();
    const subPlan = userAfterSub?.plan_type;
    if (subPlan) {
      await ensureUserReviewUsageRow(userId, subPlan);
    }
  }

  // TODO: Optional idempotent post-purchase welcome email from webhook (Resend/Edge Function);
  // not sent here — Auth has no generic transactional "welcome" API.

  return userId;
}

/**
 * Resolves all Supabase user ids tied to a Stripe subscription (team members, or
 * the solo subscriber from customer / metadata when no team row exists).
 */
export async function collectUserIdsForStripeSubscription(
  subscription: Stripe.Subscription
): Promise<string[]> {
  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (team) {
    const { data: members } = await supabase
      .from("users")
      .select("id")
      .eq("team_id", team.id);
    return (members ?? []).map((m) => m.id);
  }

  const uid = await ensureUserForStripeSubscription(subscription);
  return uid ? [uid] : [];
}

/**
 * Deactivate usage rows when a subscription is cancelled.
 */
export async function deactivateUserReviewUsageForUserIds(
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) return;
  const { error } = await supabase
    .from("user_review_usage")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .in("user_id", userIds);
  if (error) {
    console.error(
      "[deactivateUserReviewUsageForUserIds] user_review_usage update failed:",
      error
    );
  }
}

/**
 * On paid invoice: reset this billing period’s usage and extend the end date
 * (matches DB interval semantics used elsewhere: ~30 days from now for period end;
 * `billing_period_start` is set to the payment time).
 */
export async function resetUserReviewUsageOnSubscriptionRenewal(
  subscription: Stripe.Subscription
): Promise<void> {
  const userIds = await collectUserIdsForStripeSubscription(subscription);
  if (userIds.length === 0) return;

  const start = new Date().toISOString();
  const end = billingPeriodEndOneMonthFromNow();
  const { error } = await supabase
    .from("user_review_usage")
    .update({
      reviews_used: 0,
      billing_period_start: start,
      billing_period_end: end,
      updated_at: new Date().toISOString(),
    })
    .in("user_id", userIds)
    .eq("is_active", true);

  if (error) {
    console.error(
      "[resetUserReviewUsageOnSubscriptionRenewal] user_review_usage update failed:",
      error
    );
  }
}
