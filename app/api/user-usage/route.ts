/**
 * USER USAGE API
 * Returns user's plan usage and recovery statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBillingSnapshot } from "@/lib/billing/getBillingSnapshot";
import { formatPlanDisplayName } from "@/lib/billing/planLimits";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  try {
    const authClient = await createSupabaseRouteHandlerClient();
    const {
      data: { session },
    } = await authClient.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paramUserId = searchParams.get("userId");

    const { data: adminRow } = await (supabaseAdmin as any)
      .from("users")
      .select("is_admin")
      .eq("id", session.user.id)
      .maybeSingle();

    const isAdmin = !!(adminRow as { is_admin?: boolean } | null)?.is_admin;

    let userId = session.user.id;
    if (paramUserId && paramUserId !== session.user.id) {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      userId = paramUserId;
    }

    const snap = await getBillingSnapshot(authClient, userId);

    const { data: recoveryData, error: recoveryError } = await (
      supabaseAdmin as any
    ).rpc("get_recovery_summary", { user_id_param: userId });

    if (recoveryError) {
      console.error("[USER-USAGE] Error fetching recovery:", recoveryError);
    }

    const recovery = recoveryData?.[0] || {};
    const planName =
      snap.plan_display_name ||
      formatPlanDisplayName(snap.plan === "none" ? null : snap.plan);

    if (!planName || snap.reviews_limit <= 0) {
      return NextResponse.json({
        planName: planName || null,
        reviewsUsed: snap.usage,
        reviewsLimit: snap.reviews_limit,
        reviewsRemaining: snap.reviews_remaining,
        billingPeriodEnd: snap.billing_period_end,
        totalRecovery: recovery.total_recovery || 0,
        averageRecovery: recovery.average_recovery || 0,
        totalReviews: recovery.total_reviews || 0,
      });
    }

    return NextResponse.json({
      planName,
      reviewsUsed: snap.usage,
      reviewsLimit: snap.reviews_limit,
      reviewsRemaining: snap.reviews_remaining,
      billingPeriodEnd: snap.billing_period_end,
      totalRecovery: recovery.total_recovery || 0,
      averageRecovery: recovery.average_recovery || 0,
      totalReviews: recovery.total_reviews || 0,
    });
  } catch (error) {
    console.error("[USER-USAGE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
