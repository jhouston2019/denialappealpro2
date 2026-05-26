/**
 * Synchronous entitlement materialization after Stripe Checkout (service role).
 */
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getPlanReviewLimit } from "@/lib/billing/planLimits";
import {
  provisionSingleReviewCredit,
  syncUserPlanTypeToAuthMetadata,
} from "./stripeCheckoutSync";
import { userHasPaidAccessForUserId } from "./paidAccess";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function customerId(session: Stripe.Checkout.Session): string | null {
  const c = session.customer;
  if (typeof c === "string") return c;
  if (c && typeof c === "object" && "id" in c)
    return (c as Stripe.Customer).id;
  return null;
}

/**
 * If RPC-equivalent access is still false after sync, upsert usage row and payment log (one path).
 */
export async function ensureEntitlementAfterStripeCheckout(
  session: Stripe.Checkout.Session,
  userId: string
): Promise<void> {
  if (await userHasPaidAccessForUserId(userId)) {
    const planTypeMeta = session.metadata?.plan_type?.toLowerCase() ?? null;
    if (session.mode === "payment" && planTypeMeta === "single") {
      await provisionSingleReviewCredit(userId);
    }
    return;
  }

  const { data: activeUsage } = await supabase
    .from("user_review_usage")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .gt("billing_period_end", new Date().toISOString())
    .limit(1);
  if (activeUsage && activeUsage.length > 0) {
    const planTypeMeta = session.metadata?.plan_type?.toLowerCase() ?? null;
    if (session.mode === "payment" && planTypeMeta === "single") {
      await provisionSingleReviewCredit(userId);
    }
    return;
  }

  const paid =
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required";
  if (!paid) return;

  const planName = session.metadata?.plan_name || "Single Review";
  const reviewsLimitRaw = session.metadata?.reviews_limit;
  const reviewsLimit =
    reviewsLimitRaw === "unlimited"
      ? null
      : parseInt(reviewsLimitRaw || "1", 10);

  const planTypeMeta = session.metadata?.plan_type?.toLowerCase() ?? null;
  const resolvedLimit =
    reviewsLimit != null && !Number.isNaN(reviewsLimit) && reviewsLimit > 0
      ? reviewsLimit
      : getPlanReviewLimit(planTypeMeta);

  const { data: plan, error: planErr } = await supabase
    .from("subscription_plans")
    .select("id, price")
    .eq("plan_name", planName)
    .maybeSingle();

  const now = new Date();
  const periodEnd = new Date(now);
  if (session.mode === "subscription") {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setDate(periodEnd.getDate() + 30);
  }

  const subField = session.subscription;
  const subId =
    typeof subField === "string"
      ? subField
      : subField && typeof subField === "object" && "id" in subField
        ? (subField as { id: string }).id
        : null;

  if (planErr || !plan) {
    if (session.mode === "payment") {
      await supabase.from("users").update({ plan_type: "single" }).eq("id", userId);
      await syncUserPlanTypeToAuthMetadata(userId, "single");
      await provisionSingleReviewCredit(userId);
    } else if (planTypeMeta) {
      await supabase.from("users").update({ plan_type: planTypeMeta }).eq("id", userId);
      await syncUserPlanTypeToAuthMetadata(userId, planTypeMeta);
    }

    if (resolvedLimit != null && resolvedLimit > 0) {
      const { data: existingUsage } = await supabase
        .from("user_review_usage")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      const usagePayload = {
        reviews_used: 0,
        reviews_limit: resolvedLimit,
        billing_period_start: now.toISOString(),
        billing_period_end: periodEnd.toISOString(),
        stripe_subscription_id: subId,
        is_active: true,
      };

      if (existingUsage) {
        await supabase
          .from("user_review_usage")
          .update(usagePayload)
          .eq("user_id", userId);
      } else {
        await supabase.from("user_review_usage").insert({
          user_id: userId,
          ...usagePayload,
        });
      }
    }
    return;
  }

  await supabase.from("user_review_usage").insert({
    user_id: userId,
    plan_id: plan.id,
    reviews_used: 0,
    reviews_limit: resolvedLimit ?? reviewsLimit,
    billing_period_start: now.toISOString(),
    billing_period_end: periodEnd.toISOString(),
    stripe_subscription_id: subId,
    is_active: true,
  });

  const cid = customerId(session);
  await supabase.from("payment_transactions").insert({
    user_id: userId,
    stripe_payment_id: (session.payment_intent as string) || session.id,
    stripe_customer_id: cid,
    amount: plan.price,
    currency: "usd",
    payment_type: session.mode === "subscription" ? "subscription" : "one-time",
    plan_id: plan.id,
    status: "succeeded",
    metadata: session.metadata as Record<string, string>,
  });
}
