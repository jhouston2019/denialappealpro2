"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProcessingSpinner } from "@/components/wizard/ProcessingSpinner";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  clearPostPaymentResumeStorage,
  generateAppealFromWizardSnapshot,
  readWizardResumeFromStorage,
  waitForPaidAccess,
} from "@/lib/post-payment-resume";
import {
  clearCompletedReviewSession,
  DELIVERABLES_REVIEW_ID_KEY,
  NEW_REVIEW_CHECKOUT_KEY,
  NEW_REVIEW_PLAN_KEY,
} from "@/lib/wizard-snapshot";

export function SuccessRedirect({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState("Confirming payment…");

  useEffect(() => {
    if (!sessionId) {
      router.replace("/pricing");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    void (async () => {
      try {
        setStatus("Confirming payment…");
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

      setStatus("Confirming payment access…");
      const paid = await waitForPaidAccess();

      const snap = readWizardResumeFromStorage();

      if (paid && snap && snap.currentStep >= 3) {
        try {
          setStatus("Generating your appeal letter…");
          const { reviewId: generatedId } =
            await generateAppealFromWizardSnapshot(snap);
          clearPostPaymentResumeStorage();
          router.replace(
            `/deliverables?reviewId=${encodeURIComponent(generatedId)}`
          );
          return;
        } catch (err) {
          console.error("[SuccessRedirect] post-payment generation:", err);
          clearPostPaymentResumeStorage();
          router.replace("/upload?resumed=1&generateFailed=1");
          return;
        }
      }

      const isNewReviewCheckout =
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(NEW_REVIEW_CHECKOUT_KEY) === "true";

      if (isNewReviewCheckout && typeof window !== "undefined") {
        window.sessionStorage.removeItem(NEW_REVIEW_CHECKOUT_KEY);
        window.sessionStorage.removeItem(NEW_REVIEW_PLAN_KEY);
        clearCompletedReviewSession();
        router.replace("/upload?payment=confirmed&new=1");
        return;
      }

      router.replace("/upload?resumed=1");
    })();
  }, [router, sessionId]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f2744] px-6 text-center text-[#e8f0f8]">
      <ProcessingSpinner className="h-10 w-10" colorClassName="text-[#f0a050]" />
      <p className="mt-4 text-base font-semibold">{status}</p>
    </div>
  );
}
