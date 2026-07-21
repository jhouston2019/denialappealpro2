/**
 * Canonical review limits per plan — keep in sync with checkout metadata
 * in app/api/create-checkout-session/route.ts and pricing page copy.
 */
export type BillablePlanType =
  | "single"
  | "essential"
  | "professional"
  | "enterprise"
  | "premier"
  | "bulk_10"
  | "bulk_25"
  | "bulk_50"
  | "bulk_100";

export type PlanConfig = {
  displayName: string;
  reviewsPerPeriod: number;
  billingCadence: "one_time" | "monthly";
};

export const PLAN_CONFIG: Record<BillablePlanType, PlanConfig> = {
  single: {
    displayName: "Single",
    reviewsPerPeriod: 1,
    billingCadence: "one_time",
  },
  essential: {
    displayName: "Essential",
    reviewsPerPeriod: 10,
    billingCadence: "monthly",
  },
  professional: {
    displayName: "Professional",
    reviewsPerPeriod: 25,
    billingCadence: "monthly",
  },
  premier: {
    displayName: "Premier",
    reviewsPerPeriod: 20,
    billingCadence: "monthly",
  },
  enterprise: {
    displayName: "Enterprise",
    reviewsPerPeriod: 50,
    billingCadence: "monthly",
  },
  bulk_10: {
    displayName: "Bulk 10",
    reviewsPerPeriod: 10,
    billingCadence: "one_time",
  },
  bulk_25: {
    displayName: "Bulk 25",
    reviewsPerPeriod: 25,
    billingCadence: "one_time",
  },
  bulk_50: {
    displayName: "Bulk 50",
    reviewsPerPeriod: 50,
    billingCadence: "one_time",
  },
  bulk_100: {
    displayName: "Bulk 100",
    reviewsPerPeriod: 100,
    billingCadence: "one_time",
  },
};

export function normalizePlanType(
  raw: string | null | undefined
): BillablePlanType | null {
  if (!raw || raw === "none") return null;
  const key = raw.toLowerCase();
  if (key in PLAN_CONFIG) return key as BillablePlanType;
  return null;
}

export function getPlanReviewLimit(
  planType: string | null | undefined
): number | null {
  const normalized = normalizePlanType(planType);
  if (!normalized) return null;
  return PLAN_CONFIG[normalized].reviewsPerPeriod;
}

export function formatPlanDisplayName(
  planType: string | null | undefined
): string {
  const normalized = normalizePlanType(planType);
  if (!normalized) return "";
  return PLAN_CONFIG[normalized].displayName;
}

export function resolveEffectiveReviewLimit(args: {
  planType: string | null;
  storedLimit: number;
  teamReviewLimit?: number | null;
  metadataLimit?: number | null;
}): number {
  const planCap = getPlanReviewLimit(args.planType) ?? 0;
  const candidates = [
    planCap,
    args.storedLimit > 0 ? args.storedLimit : 0,
    args.metadataLimit != null && args.metadataLimit > 0 ? args.metadataLimit : 0,
    args.teamReviewLimit != null && args.teamReviewLimit > 0
      ? args.teamReviewLimit
      : 0,
  ];
  return Math.max(0, ...candidates);
}

export function reviewsRemaining(
  used: number,
  limit: number
): number {
  if (limit <= 0) return 0;
  return Math.max(0, limit - used);
}
