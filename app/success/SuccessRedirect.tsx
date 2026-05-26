"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { tryParseWizardSnapshot } from "@/lib/wizard-snapshot";

export function SuccessRedirect({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) {
      router.replace("/pricing");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    fetch("/api/auth/create-session-from-stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ session_id: sessionId }),
    }).finally(async () => {
      const { data } = await supabase.auth.refreshSession();
      if (data.session) {
        console.info(
          "[TODO] Post-purchase welcome email: not implemented. Supabase Auth has no built-in marketing/welcome email API — add Resend, SendGrid, or an Edge Function with your template (keep idempotent if also triggered from webhooks)."
        );
        const w =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem("erp_wizard_state")
            : null;
        const hasWizardSnapshot = Boolean(tryParseWizardSnapshot(w));
        const hasTextResume =
          typeof window !== "undefined" &&
          window.sessionStorage.getItem("erp_resume") === "true" &&
          Boolean(
            (window.sessionStorage.getItem("erp_extracted_text") || "").trim()
          );
        const resume = hasWizardSnapshot || hasTextResume;
        const { data: userData } = await supabase
          .from("users")
          .select("plan_type")
          .eq("id", data.session.user.id)
          .single();
        const planType = userData?.plan_type;
        if (resume) {
          router.replace("/deliverables");
        } else if (planType === "single") {
          router.replace("/upload");
        } else {
          router.replace("/dashboard");
        }
      } else {
        router.replace("/create-account?session_id=" + encodeURIComponent(sessionId));
      }
    });
  }, [router, sessionId]);

  return <div>Finishing up…</div>;
}
