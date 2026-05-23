import Link from "next/link";

type Props = {
  planDisplayName: string;
  usedReviews: number;
  limitReviews: number;
  reviewsRemaining: number;
  periodEndLabel: string | null;
  billingCadence: "one_time" | "monthly" | null;
};

export function DashboardPlanUsage({
  planDisplayName,
  usedReviews,
  limitReviews,
  reviewsRemaining,
  periodEndLabel,
  billingCadence,
}: Props) {
  if (limitReviews <= 0 || !planDisplayName) return null;

  const usagePct = Math.min(
    100,
    Math.round((usedReviews / limitReviews) * 100)
  );
  const barColor =
    usagePct >= 90
      ? "bg-rose-500"
      : usagePct >= 70
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="mt-4 rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-950/40 via-slate-900/90 to-slate-950 p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
        {planDisplayName} plan
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="text-4xl font-bold tabular-nums tracking-tight text-white sm:text-5xl">
          {reviewsRemaining}
        </span>
        <span className="pb-1 text-sm text-slate-300">
          of {limitReviews} reviews remaining
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        {usedReviews} used · {reviewsRemaining} left this{" "}
        {billingCadence === "one_time" ? "purchase" : "billing period"}
      </p>
      <div
        className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-valuenow={usedReviews}
        aria-valuemin={0}
        aria-valuemax={limitReviews}
        aria-label={`${usedReviews} of ${limitReviews} reviews used`}
      >
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${usagePct}%` }}
        />
      </div>
      {periodEndLabel ? (
        <p className="mt-3 text-xs text-slate-500">
          {billingCadence === "one_time" ? "Access through" : "Resets on"}{" "}
          {periodEndLabel}
        </p>
      ) : null}
      {reviewsRemaining === 0 ? (
        <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-950/30 p-4">
          <p className="text-sm font-medium text-rose-100">
            You&apos;re out of reviews for this{" "}
            {billingCadence === "one_time" ? "purchase" : "billing period"}.
          </p>
          {periodEndLabel && billingCadence === "monthly" ? (
            <p className="mt-1 text-xs text-rose-200/70">
              Your count resets on {periodEndLabel}, or you can buy more now.
            </p>
          ) : null}
          <Link
            href="/pricing"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#2563EB]/30 transition hover:bg-[#1E40AF] sm:w-auto"
          >
            Buy more reviews
          </Link>
        </div>
      ) : null}
    </div>
  );
}
