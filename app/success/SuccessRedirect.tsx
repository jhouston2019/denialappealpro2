"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { tryParseWizardSnapshot, PAID_RESUME_SESSION_KEY, NEW_REVIEW_CHECKOUT_KEY, NEW_REVIEW_PLAN_KEY, clearCompletedReviewSession, WIZARD_STATE_STORAGE_KEY } from "@/lib/wizard-snapshot";

export function SuccessRedirect({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) {
      router.replace("/pricing");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    void (async () => {
      try {
        await fetch("/api/auth/create-session-from-stripe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch (e) {
        console.error("[SuccessRedirect] create-session-from-stripe:", e);
      }

      const { data } = await supabase.auth.refreshSession();
      if (data.session) {
        console.info(
          "[TODO] Post-purchase welcome email: not implemented. Supabase Auth has no built-in marketing/welcome email API — add Resend, SendGrid, or an Edge Function with your template (keep idempotent if also triggered from webhooks)."
        );
        const isNewReviewCheckout =
          typeof window !== "undefined" &&
          window.sessionStorage.getItem(NEW_REVIEW_CHECKOUT_KEY) === "true";
        const newReviewPlan =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem(NEW_REVIEW_PLAN_KEY)
            : null;

        if (isNewReviewCheckout && typeof window !== "undefined") {
          window.sessionStorage.removeItem(NEW_REVIEW_CHECKOUT_KEY);
          window.sessionStorage.removeItem(NEW_REVIEW_PLAN_KEY);
          clearCompletedReviewSession();
          if (newReviewPlan === "single") {
            router.replace("/upload?payment=success");
          } else {
            router.replace("/dashboard?payment=success");
          }
          return;
        }

        const w =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem(WIZARD_STATE_STORAGE_KEY)
            : null;
        const hasWizardSnapshot = Boolean(tryParseWizardSnapshot(w));
        const hasTextResume =
          typeof window !== "undefined" &&
          window.sessionStorage.getItem("erp_resume") === "true" &&
          Boolean(
            (window.sessionStorage.getItem("erp_extracted_text") || "").trim()
          );
        const resume = hasWizardSnapshot || hasTextResume;
        if (resume && typeof window !== "undefined") {
          window.sessionStorage.setItem(PAID_RESUME_SESSION_KEY, "true");
        }
        const { data: userData } = await supabase
          .from("users")
          .select("plan_type")
          .eq("id", data.session.user.id)
          .single();
        const planType = userData?.plan_type;
        if (resume) {
          router.replace("/deliverables");
        } else if (planType === "single") {
          router.replace("/upload?payment=success");
        } else {
          router.replace("/dashboard?payment=success");
        }
      } else {
        router.replace("/create-account?session_id=" + encodeURIComponent(sessionId));
      }
    })();
  }, [router, sessionId]);

  return <div>Finishing up…</div>;
}
