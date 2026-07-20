import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseServer";
import { incrementReviewUsageForUser } from "@/lib/billing/incrementUserReviewUsage";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const authClient = await createSupabaseRouteHandlerClient();
    const {
      data: { session },
    } = await authClient.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ok = await incrementReviewUsageForUser(
      supabaseAdmin,
      session.user.id
    );

    if (!ok) {
      return NextResponse.json(
        { error: "Failed to increment usage" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[increment-review-usage]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
