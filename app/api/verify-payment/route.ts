import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { syncStripeCheckoutSession } from "@/lib/billing/stripeCheckoutSync";
import { ensureEntitlementAfterStripeCheckout } from "@/lib/billing/ensureEntitlement";
import { confirmPaidAccessReady } from "@/lib/billing/confirmEntitlement";
import { checkoutSessionBelongsToUser } from "@/lib/billing/stripeLinkUser";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export type PostPaymentDestination = "upload" | "dashboard";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-11-17.clover",
  });
}

function getSupabaseService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getPostPaymentDestination(
  checkoutSession: Stripe.Checkout.Session
): PostPaymentDestination {
  if (checkoutSession.mode === "subscription") return "dashboard";
  return "upload";
}

async function checkoutPaymentAlreadyRecorded(
  supabaseService: ReturnType<typeof getSupabaseService>,
  userId: string,
  checkoutSession: Stripe.Checkout.Session
): Promise<boolean> {
  const ids = [checkoutSession.id];
  const pi = checkoutSession.payment_intent;
  if (typeof pi === "string") ids.push(pi);
  const { data } = await supabaseService
    .from("payment_transactions")
    .select("id")
    .eq("user_id", userId)
    .in("stripe_payment_id", ids)
    .limit(1);
  return !!(data && data.length > 0);
}

async function runVerify(request: NextRequest) {
  const stripe = getStripe();
  const supabaseService = getSupabaseService();

  const authClient = await createSupabaseRouteHandlerClient();
  const {
    data: { session: authSession },
  } = await authClient.auth.getSession();

  if (!authSession?.user?.id) {
    console.log({
      tag: "[verify-payment]",
      session_id: null,
      user_id: null,
      hasAccess: false,
      stripe_customer_id: null,
      reason: "NO_SESSION",
    });
    return NextResponse.json(
      { error: "Unauthorized", code: "NO_SESSION" },
      { status: 401 }
    );
  }

  const authUserId = authSession.user.id;

  let sessionId =
    request.nextUrl.searchParams.get("session_id") ??
    request.nextUrl.searchParams.get("sessionId");

  if (!sessionId && request.method === "POST") {
    try {
      const body = await request.json();
      sessionId = body?.sessionId ?? body?.session_id;
    } catch {
      /* ignore */
    }
  }

  if (!sessionId || typeof sessionId !== "string") {
    console.log({
      tag: "[verify-payment]",
      session_id: null,
      user_id: authUserId,
      hasAccess: false,
      stripe_customer_id: null,
      reason: "MISSING_SESSION_ID",
    });
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  let checkoutSession: Stripe.Checkout.Session;
  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "line_items", "customer"],
    });
  } catch (e) {
    console.error("[verify-payment] retrieve session:", e);
    console.log({
      tag: "[verify-payment]",
      session_id: sessionId,
      user_id: authUserId,
      hasAccess: false,
      stripe_customer_id: null,
      reason: "INVALID_STRIPE_SESSION",
    });
    return NextResponse.json(
      { error: "Invalid or expired checkout session" },
      { status: 400 }
    );
  }

  const stripePaid =
    checkoutSession.payment_status === "paid" ||
    checkoutSession.payment_status === "no_payment_required";

  if (!stripePaid) {
    const stripeCustomerIdForLog =
      typeof checkoutSession.customer === "string"
        ? checkoutSession.customer
        : checkoutSession.customer &&
            typeof checkoutSession.customer === "object" &&
            "id" in checkoutSession.customer
          ? (checkoutSession.customer as Stripe.Customer).id
          : null;
    console.log({
      tag: "[verify-payment]",
      session_id: sessionId,
      user_id: authUserId,
      hasAccess: false,
      stripe_customer_id: stripeCustomerIdForLog,
      reason: "NOT_PAID",
    });
    return NextResponse.json(
      {
        error: "Payment not completed",
        payment_status: checkoutSession.payment_status,
      },
      { status: 400 }
    );
  }

  const stripeCustomerIdForLog =
    typeof checkoutSession.customer === "string"
      ? checkoutSession.customer
      : checkoutSession.customer &&
          typeof checkoutSession.customer === "object" &&
          "id" in checkoutSession.customer
        ? (checkoutSession.customer as Stripe.Customer).id
        : null;

  function logVerifyPayment(hasAccess: boolean, pending?: boolean) {
    console.log({
      tag: "[verify-payment]",
      session_id: sessionId,
      user_id: authUserId,
      hasAccess,
      stripe_customer_id: stripeCustomerIdForLog,
      pending: pending ?? undefined,
    });
    console.log("[verify-payment] VERIFY_PAYMENT_FINAL", {
      session_id: sessionId,
      user_id: authUserId,
      hasAccess,
      pending: pending ?? null,
    });
  }

  const belongs = await checkoutSessionBelongsToUser({
    session: checkoutSession,
    userId: authUserId,
  });

  const postPaymentDestination = getPostPaymentDestination(checkoutSession);

  const baseOk = {
    postPaymentDestination,
    checkoutMode: checkoutSession.mode,
    metadataPlanType: checkoutSession.metadata?.plan_type ?? null,
  };

  if (!belongs) {
    logVerifyPayment(false, true);
    return NextResponse.json({
      success: true,
      synced: false,
      pending: true,
      hasPaidAccess: false,
      ...baseOk,
    });
  }

  const { data: alreadyPaid } = await authClient.rpc("user_has_paid_access");
  const paidRpc = alreadyPaid === true;
  const recorded = await checkoutPaymentAlreadyRecorded(
    supabaseService,
    authUserId,
    checkoutSession
  );

  if (paidRpc && recorded) {
    logVerifyPayment(true, false);
    return NextResponse.json({
      success: true,
      synced: true,
      pending: false,
      hasPaidAccess: true,
      ...baseOk,
    });
  }

  let syncedUserId: string | null = null;
  try {
    syncedUserId = await syncStripeCheckoutSession(checkoutSession, {
      trustedUserId: authUserId,
    });
    if (syncedUserId === authUserId) {
      await ensureEntitlementAfterStripeCheckout(
        checkoutSession,
        syncedUserId
      );
    }
  } catch (e) {
    console.error("[verify-payment] sync/ensure:", e);
    logVerifyPayment(false, true);
    return NextResponse.json({
      success: true,
      synced: false,
      pending: true,
      hasPaidAccess: false,
      ...baseOk,
    });
  }

  if (!syncedUserId || syncedUserId !== authUserId) {
    logVerifyPayment(false, true);
    return NextResponse.json({
      success: true,
      synced: false,
      pending: true,
      hasPaidAccess: false,
      ...baseOk,
    });
  }

  const ready = await confirmPaidAccessReady({
    userId: syncedUserId,
    authClient,
  });

  if (!ready) {
    logVerifyPayment(false, true);
    return NextResponse.json({
      success: true,
      synced: true,
      pending: true,
      hasPaidAccess: false,
      ...baseOk,
    });
  }

  logVerifyPayment(true, false);
  return NextResponse.json({
    success: true,
    synced: true,
    pending: false,
    hasPaidAccess: true,
    ...baseOk,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await runVerify(request);
  } catch (error) {
    console.error("[verify-payment] GET:", error);
    return NextResponse.json(
      {
        success: true,
        pending: true,
        synced: false,
        hasPaidAccess: false,
      },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    return await runVerify(request);
  } catch (error) {
    console.error("[verify-payment] POST:", error);
    return NextResponse.json(
      {
        success: true,
        pending: true,
        synced: false,
        hasPaidAccess: false,
      },
      { status: 200 }
    );
  }
}
