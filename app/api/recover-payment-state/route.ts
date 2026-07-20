import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-11-17.clover",
  });

  const supabaseService = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const authClient = await createSupabaseRouteHandlerClient();
  const {
    data: { session },
  } = await authClient.auth.getSession();

  if (!session?.user?.id) {
    console.log("[recover-payment-state] unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const { data: paid, error: paidErr } = await authClient.rpc(
    "user_has_paid_access"
  );

  if (!paidErr && paid === true) {
    console.log("[recover-payment-state] result", {
      user_id: userId,
      status: "paid",
    });
    return NextResponse.json({
      status: "paid" as const,
      session_id: null as string | null,
    });
  }

  const { data: urow } = await supabaseService
    .from("users")
    .select("stripe_customer_id, payment_verification_status, is_paid")
    .eq("id", userId)
    .maybeSingle();

  const u = urow as {
    stripe_customer_id?: string | null;
    payment_verification_status?: string | null;
    is_paid?: boolean | null;
  } | null;

  if (u?.is_paid === true) {
    console.log("[recover-payment-state] result", {
      user_id: userId,
      status: "paid",
      source: "users.is_paid",
    });
    return NextResponse.json({
      status: "paid" as const,
      session_id: null as string | null,
    });
  }

  if (
    u?.payment_verification_status === "processing" ||
    u?.payment_verification_status === "pending"
  ) {
    console.log("[recover-payment-state] result", {
      user_id: userId,
      status: "processing",
      source: "payment_verification_status",
    });
    return NextResponse.json({
      status: "processing" as const,
      session_id: null as string | null,
    });
  }

  const { data: pendingRow } = await supabaseService
    .from("processed_sessions")
    .select("session_id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (pendingRow?.session_id) {
    console.log("[recover-payment-state] result", {
      user_id: userId,
      status: "processing",
      source: "processed_sessions",
    });
    return NextResponse.json({
      status: "processing" as const,
      session_id: pendingRow.session_id,
    });
  }

  let sessionIdOut: string | null = null;

  if (u?.stripe_customer_id) {
    try {
      const list = await stripe.checkout.sessions.list({
        customer: u.stripe_customer_id,
        limit: 25,
      });
      const since = Date.now() - DAY_MS;
      for (const s of list.data) {
        const createdMs = s.created * 1000;
        if (createdMs < since) continue;
        if (
          s.payment_status === "unpaid" ||
          (s.status === "open" && s.payment_status !== "paid")
        ) {
          sessionIdOut = s.id;
          console.log("[recover-payment-state] result", {
            user_id: userId,
            status: "processing",
            source: "stripe_recent_open",
            session_id: sessionIdOut,
          });
          return NextResponse.json({
            status: "processing" as const,
            session_id: sessionIdOut,
          });
        }
        if (s.payment_status === "paid" && paid !== true) {
          sessionIdOut = s.id;
          console.log("[recover-payment-state] result", {
            user_id: userId,
            status: "processing",
            source: "stripe_paid_unsynced",
            session_id: sessionIdOut,
          });
          return NextResponse.json({
            status: "processing" as const,
            session_id: sessionIdOut,
          });
        }
      }
    } catch (e) {
      console.error("[recover-payment-state] stripe list:", e);
    }
  }

  console.log("[recover-payment-state] result", {
    user_id: userId,
    status: "none",
  });
  return NextResponse.json({
    status: "none" as const,
    session_id: null as string | null,
  });
}
