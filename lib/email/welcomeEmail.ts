import { Resend } from "resend";
import { appAbsoluteUrl } from "@/lib/appUrl";

const WELCOME_FROM = "noreply@denialappealpro.com";

export async function sendWelcomeEmail(args: {
  email: string;
  planType?: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !args.email) {
    return;
  }

  const dashboardUrl = appAbsoluteUrl("/dashboard").replace(/\/$/, "");
  const planLine = args.planType
    ? `Your ${args.planType.replace(/_/g, " ")} plan is active.`
    : "Your account is ready.";

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL?.trim() || `Denial Appeal Pro <${WELCOME_FROM}>`,
    to: [args.email],
    subject: "Your Denial Appeal Pro account is ready",
    text: [
      "Welcome to Denial Appeal Pro!",
      "",
      planLine,
      "",
      "How to start your first appeal:",
      "1. Sign in to your dashboard",
      "2. Upload a denial letter or EOB (PDF or paste text)",
      "3. Review extracted claim data and confirm provider details",
      "4. Generate your submission-ready appeal letter",
      "",
      `Open your dashboard: ${dashboardUrl}`,
      "",
      "Questions? Reply to this email or contact support@denialappealpro.com",
    ].join("\n"),
  });

  if (error) {
    console.error("[welcome-email] Resend error:", error);
  }
}
