import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseServer";
import { appAbsoluteUrl } from "@/lib/appUrl";

/**
 * Minimal receipt / confirmation email after payment (Resend if configured).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      console.warn("[send-receipt] unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let session_id: string | undefined;
    try {
      const body = await request.json();
      session_id = body?.session_id;
    } catch {
      /* optional body */
    }

    const email = session.user.email;
    const appUrl = appAbsoluteUrl("app").replace(/\/$/, "");

    console.log("[send-receipt]", {
      user_id: session.user.id,
      email,
      session_id: session_id ?? null,
      app_url: appUrl,
    });

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (apiKey && email) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:
            process.env.RESEND_FROM_EMAIL ||
            "Denial Appeal Pro <onboarding@resend.dev>",
          to: [email],
          subject: "Your Denial Appeal Pro access is ready",
          text: `Thanks for your purchase. Continue to your workspace: ${appUrl}\n`,
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error("[send-receipt] Resend error:", r.status, t);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[send-receipt]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
