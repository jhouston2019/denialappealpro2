import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  CHECKOUT_PLAN_PRICE_ENV_KEYS,
  discoverSimilarStripeEnvKeys,
  isCheckoutPlanType,
  planPriceFromStripe,
  resolveStripePriceId,
  retrieveCheckoutPrice,
  type CheckoutPlanType,
  type PlanPriceDisplay,
  type PlanPriceResolveError,
} from "@/lib/billing/stripePlanPrices";

const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2025-11-17.clover";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
  const plans: Partial<Record<CheckoutPlanType, PlanPriceDisplay>> = {};
  const missing: CheckoutPlanType[] = [];
  const errors: Partial<Record<CheckoutPlanType, PlanPriceResolveError>> = {};

  for (const planType of Object.keys(
    CHECKOUT_PLAN_PRICE_ENV_KEYS
  ) as CheckoutPlanType[]) {
    const resolved = resolveStripePriceId(planType);
    if (!resolved) {
      missing.push(planType);
      errors[planType] = {
        reason: "env_not_set",
        expectedKeys: CHECKOUT_PLAN_PRICE_ENV_KEYS[planType],
        similarEnvKeys: discoverSimilarStripeEnvKeys(planType),
      };
      continue;
    }

    try {
      const price = await retrieveCheckoutPrice(stripe, resolved.priceId);
      if (planType === "single" && price.type !== "one_time") {
        console.warn(`[plan-prices] single: expected one-time price`);
        missing.push(planType);
        errors[planType] = {
          reason: "invalid_price_type",
          envKey: resolved.envKey,
          message: "Single checkout needs a one-time Stripe price.",
        };
        continue;
      }
      plans[planType] = planPriceFromStripe(planType, price, {
        resolvedFromEnv: resolved.envKey,
      });
    } catch (err) {
      console.error(`[plan-prices] Failed to retrieve ${planType}:`, err);
      missing.push(planType);
      errors[planType] = {
        reason: "stripe_error",
        envKey: resolved.envKey,
        idHint: resolved.priceId.slice(-6),
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json(
    {
      plans,
      missing,
      errors,
      configured: Object.keys(plans).filter((k) =>
        isCheckoutPlanType(k)
      ) as CheckoutPlanType[],
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
