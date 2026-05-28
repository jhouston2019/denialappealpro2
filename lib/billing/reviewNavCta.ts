import { UPLOAD_NEW_REVIEW_HREF } from "@/lib/wizard-snapshot";

export type ReviewNavCta = {
  label: "Run another review" | "Buy another review";
  href: string;
};

export type ReviewNavBillingInput = {
  plan: string;
  status: "active" | "inactive";
  reviews_limit: number;
  reviews_remaining: number;
};

/** Nav CTA: run another review when allotment remains; buy more when exhausted or no plan. */
export function reviewNavCtaFromSnapshot(
  snap: ReviewNavBillingInput
): ReviewNavCta {
  const hasPaidPlan = snap.plan !== "none" && snap.status === "active";
  const hasMeteredLimit = snap.reviews_limit > 0;

  if (
    hasPaidPlan &&
    hasMeteredLimit &&
    snap.reviews_remaining > 0
  ) {
    return {
      label: "Run another review",
      href: UPLOAD_NEW_REVIEW_HREF,
    };
  }

  return {
    label: "Buy another review",
    href: "/pricing",
  };
}
