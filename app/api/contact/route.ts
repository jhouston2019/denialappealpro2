import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const OWNER_EMAIL = "info@axis-strategic-labs.com";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Valid email is required").max(320),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(10000),
  /** Honeypot (optional); non-empty = bot — handled after parse. */
  company: z.string().optional(),
});

/**
 * Public contact form → email to owner via Resend (same as send-receipt when configured).
 */
export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = Object.values(first).flat().filter(Boolean)[0] ?? "Invalid request";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { name, email, message, company } = parsed.data;
    if (company != null && String(company).trim().length > 0) {
      return NextResponse.json({ ok: true });
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      console.warn("[contact] RESEND_API_KEY not set; cannot deliver form email");
      return NextResponse.json(
        {
          error: "Message delivery is not configured. Please use the email address on the contact page.",
          code: "EMAIL_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    const from =
      process.env.RESEND_FROM_EMAIL ||
      "Denial Appeal Pro <onboarding@resend.dev>";

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [OWNER_EMAIL],
        reply_to: email,
        subject: `[Denial Appeal Pro] Message from ${name}`,
        text: `From: ${name} <${email}>\n\n${message}\n`,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error("[contact] Resend error:", r.status, t);
      return NextResponse.json(
        { error: "Could not send your message. Please try email directly." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contact]", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again or email us directly." },
      { status: 500 }
    );
  }
}
