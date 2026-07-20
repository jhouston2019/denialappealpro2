import { redirect } from "next/navigation";
import { requireUserAndPaywall } from "@/lib/auth/serverPageGuards";
import { isPaymentBypassActive } from "@/lib/billing/devBypass";
import { getBillingSnapshot } from "@/lib/billing/getBillingSnapshot";
import UploadWizardClient from "./UploadWizardClient";

export default async function UploadRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; reviewId?: string; new?: string }>;
}) {
  const { supabase, user } = await requireUserAndPaywall({
    unpaidRedirect: "/analysis-preview",
  });

  const sp = await searchParams;
  const reviewId =
    typeof sp.reviewId === "string" ? sp.reviewId.trim() : "";

  let resumeExistingReview = false;
  if (reviewId) {
    const { data: ownedReview } = await supabase
      .from("reviews")
      .select("id")
      .eq("id", reviewId)
      .eq("user_id", user.id)
      .maybeSingle();
    resumeExistingReview = Boolean(ownedReview);
  }

  if (!isPaymentBypassActive()) {
    const { data: userRow } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    const isAdmin =
      (userRow as { is_admin?: boolean } | null)?.is_admin === true;

    if (!isAdmin && !resumeExistingReview) {
      const snap = await getBillingSnapshot(supabase, user.id);
      if (snap.reviews_limit > 0 && snap.reviews_remaining <= 0) {
        redirect("/analysis-preview");
      }
    }
  }

  const parsed = parseInt(sp.step ?? "1", 10);
  const initialStep = Number.isFinite(parsed)
    ? Math.min(4, Math.max(1, parsed))
    : 1;
  const startFreshReview =
    (sp.new === "1" || sp.new === "true") && !resumeExistingReview;

  return (
    <UploadWizardClient
      initialStep={initialStep}
      initialReviewId={resumeExistingReview ? reviewId : undefined}
      startFreshReview={startFreshReview}
    />
  );
}
