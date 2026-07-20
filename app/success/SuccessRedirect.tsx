"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  tryParseDapWizardSnapshot,
  DAP_WIZARD_RESUME_KEY,
  DAP_WIZARD_STATE_KEY,
} from "@/lib/dap-wizard-snapshot";
import {
  clearCompletedReviewSession,
  DELIVERABLES_REVIEW_ID_KEY,
  NEW_REVIEW_CHECKOUT_KEY,
  NEW_REVIEW_PLAN_KEY,
  PAID_RESUME_SESSION_KEY,
} from "@/lib/wizard-snapshot";

function hasDapWizardStateInSession(): boolean {
  if (typeof window === "undefined") return false;
  for (const key of [DAP_WIZARD_STATE_KEY, DAP_WIZARD_RESUME_KEY] as const) {
    const raw = window.sessionStorage.getItem(key);
    if (tryParseDapWizardSnapshot(raw)) return true;
  }
  return false;
}

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
      if (!data.session) {
        router.replace(
          "/create-account?session_id=" + encodeURIComponent(sessionId)
        );
        return;
      }

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
          router.replace("/upload");
        } else {
          router.replace("/dashboard?payment=success");
        }
        return;
      }

      const reviewId =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(DELIVERABLES_REVIEW_ID_KEY)?.trim() ||
            null
          : null;

      if (reviewId) {
        router.replace(
          `/deliverables?reviewId=${encodeURIComponent(reviewId)}`
        );
        return;
      }

      if (hasDapWizardStateInSession() && typeof window !== "undefined") {
        window.sessionStorage.setItem(PAID_RESUME_SESSION_KEY, "true");
        router.replace("/upload?resumed=1");
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("plan_type")
        .eq("id", data.session.user.id)
        .single();
      const planType = userData?.plan_type;

      if (planType === "single") {
        router.replace("/upload");
      } else {
        router.replace("/dashboard?payment=success");
      }
    })();
  }, [router, sessionId]);

  return <div>Finishing up…</div>;
}
