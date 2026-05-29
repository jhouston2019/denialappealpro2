import type Stripe from "stripe";
import { PLAN_CONFIG, type BillablePlanType } from "@/lib/billing/planLimits";

/** Plans sold via /api/create-checkout-session */
export type CheckoutPlanType = Extract<
  BillablePlanType,
  "single" | "essential" | "professional" | "enterprise"
>;

/** Shared fallbacks for live/test — set once instead of four separate price IDs. */
export const STRIPE_PRICE_TEST_ONETIME_ENV = "STRIPE_PRICE_TEST_ONETIME";
export const STRIPE_PRICE_TEST_SUBSCRIPTION_ENV =
  "STRIPE_PRICE_TEST_SUBSCRIPTION";

/** Env keys tried in order (supports legacy Stripe product names). */
export const CHECKOUT_PLAN_PRICE_ENV_KEYS: Record<
  CheckoutPlanType,
  readonly string[]
> = {
  single: ["STRIPE_PRICE_SINGLE_REVIEW", "STRIPE_PRICE_INDIVIDUAL_149"],
  essential: ["STRIPE_PRICE_ESSENTIAL", "STRIPE_PRICE_FIRM_499"],
  professional: ["STRIPE_PRICE_PROFESSIONAL"],
  enterprise: ["STRIPE_PRICE_ENTERPRISE", "STRIPE_PRICE_PRO_1499"],
};

const SUBSCRIPTION_PLANS: readonly CheckoutPlanType[] = [
  "essential",
  "professional",
  "enterprise",
];

function allowTestPriceFallbacks(): boolean {
  return (
    process.env.BYPASS_PAYMENT === "true" ||
    process.env.NODE_ENV === "development"
  );
}

/** Accepts a Stripe Price id (`price_…`) or Product id (`prod_…`, uses default_price). */
export async function retrieveCheckoutPrice(
  stripe: Stripe,
  priceOrProductId: string
): Promise<Stripe.Price> {
  const id = priceOrProductId.trim();
  if (id.startsWith("prod_")) {
    const product = await stripe.products.retrieve(id, {
      expand: ["default_price"],
    });
    const defaultPrice = product.default_price;
    if (!defaultPrice) {
      throw new Error(`Stripe product ${id} has no default_price`);
    }
    if (typeof defaultPrice === "string") {
      return stripe.prices.retrieve(defaultPrice);
    }
    return defaultPrice;
  }
  return stripe.prices.retrieve(id);
}

export function isCheckoutPlanType(
  value: string
): value is CheckoutPlanType {
  return value in CHECKOUT_PLAN_PRICE_ENV_KEYS;
}

export function resolveStripePriceId(
  planType: CheckoutPlanType
): { priceId: string; envKey: string } | null {
  for (const envKey of CHECKOUT_PLAN_PRICE_ENV_KEYS[planType]) {
    const priceId = process.env[envKey]?.trim();
    if (priceId) return { priceId, envKey };
  }

  if (!allowTestPriceFallbacks()) {
    return null;
  }

  if (planType === "single") {
    const testOnce = process.env[STRIPE_PRICE_TEST_ONETIME_ENV]?.trim();
    if (testOnce) {
      return { priceId: testOnce, envKey: STRIPE_PRICE_TEST_ONETIME_ENV };
    }
  } else if (SUBSCRIPTION_PLANS.includes(planType)) {
    const testSub = process.env[STRIPE_PRICE_TEST_SUBSCRIPTION_ENV]?.trim();
    if (testSub) {
      return { priceId: testSub, envKey: STRIPE_PRICE_TEST_SUBSCRIPTION_ENV };
    }
    for (const envKey of CHECKOUT_PLAN_PRICE_ENV_KEYS.single) {
      const priceId = process.env[envKey]?.trim();
      if (priceId) return { priceId, envKey };
    }
  }

  return null;
}

export function missingPriceEnvHint(planType: CheckoutPlanType): string {
  const keys = CHECKOUT_PLAN_PRICE_ENV_KEYS[planType].join(" or ");
  if (planType === "single") {
    return `Set ${keys} (one-time price) or ${STRIPE_PRICE_TEST_ONETIME_ENV}=price_… in Netlify, then redeploy.`;
  }
  return (
    `Set ${keys}, ${STRIPE_PRICE_TEST_SUBSCRIPTION_ENV}, or the same one-time price as ` +
    `STRIPE_PRICE_SINGLE_REVIEW in Netlify, then redeploy.`
  );
}

/** Stripe Checkout mode required for each plan (price object must match). */
export function checkoutModeForPlan(
  planType: CheckoutPlanType
): Stripe.Checkout.SessionCreateParams["mode"] {
  return planType === "single" ? "payment" : "subscription";
}

export function validatePriceForCheckout(
  planType: CheckoutPlanType,
  price: Stripe.Price
): string | null {
  const mode = checkoutModeForPlan(planType);
  if (mode === "payment" && price.type !== "one_time") {
    return `Price ${price.id} is recurring; Single checkout needs a one-time price in Stripe.`;
  }
  return null;
}

/** Subscription plan using a one-time Stripe price — checkout uses price_data at the same amount. */
export function subscriptionUsesOneTimePriceFallback(
  planType: CheckoutPlanType,
  price: Stripe.Price
): boolean {
  return planType !== "single" && !price.recurring;
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export type PlanPriceDisplay = {
  planType: CheckoutPlanType;
  displayName: string;
  amountCents: number;
  amountFormatted: string;
  suffix: string;
  interval: Stripe.Price.Recurring.Interval | null;
  /** Last 6 chars of resolved Stripe price id — for verifying distinct plans in /api/plan-prices */
  priceIdHint?: string;
  resolvedFromEnv?: string;
};

export function planPriceFromStripe(
  planType: CheckoutPlanType,
  price: Stripe.Price,
  meta?: { resolvedFromEnv?: string }
): PlanPriceDisplay {
  const amountCents = price.unit_amount ?? 0;
  const config = PLAN_CONFIG[planType];
  const useMonthlyDisplay = subscriptionUsesOneTimePriceFallback(planType, price);
  const interval = useMonthlyDisplay
    ? ("month" as const)
    : (price.recurring?.interval ?? null);

  return {
    planType,
    displayName: config.displayName,
    amountCents,
    amountFormatted: formatUsdFromCents(amountCents),
    suffix:
      config.billingCadence === "one_time" && !useMonthlyDisplay
        ? "(one-time)"
        : `/${interval ?? "month"}`,
    interval,
    priceIdHint: price.id.slice(-6),
    resolvedFromEnv: meta?.resolvedFromEnv,
  };
}

export function checkoutLineItemForPlan(
  planType: CheckoutPlanType,
  price: Stripe.Price
): Stripe.Checkout.SessionCreateParams.LineItem {
  if (subscriptionUsesOneTimePriceFallback(planType, price)) {
    const config = PLAN_CONFIG[planType];
    const unitAmount = price.unit_amount;
    if (unitAmount == null) {
      throw new Error(`Price ${price.id} has no unit_amount`);
    }
    return {
      price_data: {
        currency: price.currency,
        unit_amount: unitAmount,
        recurring: { interval: "month" },
        product_data: {
          name: `${config.displayName} Plan`,
        },
      },
      quantity: 1,
    };
  }

  return { price: price.id, quantity: 1 };
}

export function buildCheckoutSessionParams(
  planType: CheckoutPlanType,
  lineItem: Stripe.Checkout.SessionCreateParams.LineItem,
  successUrl: string,
  cancelUrl: string
): Stripe.Checkout.SessionCreateParams {
  const config = PLAN_CONFIG[planType];
  const reviewLimit = String(config.reviewsPerPeriod);

  const baseMetadata = {
    plan_type: planType,
    plan_name: config.displayName,
    reviews_limit: reviewLimit,
  };

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [lineItem];

  if (planType === "single") {
    return {
      mode: "payment",
      customer_creation: "always",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: baseMetadata,
    };
  }

  return {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        plan_type: planType,
        plan_name: config.displayName,
        review_limit: reviewLimit,
        overage_price: "0",
      },
    },
    metadata: baseMetadata,
  };
}
