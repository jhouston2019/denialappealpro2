import Link from "next/link";

type Props = {
  reviewsRemaining: number;
};

export function LowUsageBanner({ reviewsRemaining }: Props) {
  if (reviewsRemaining > 3) return null;

  return (
    <div
      className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-5"
      role="status"
    >
      <p className="text-sm font-medium text-amber-100">
        You have{" "}
        <span className="font-semibold text-amber-50">{reviewsRemaining}</span>{" "}
        appeal{reviewsRemaining === 1 ? "" : "s"} remaining. Upgrade your plan
        to continue without interruption.
      </p>
      <Link
        href="/pricing"
        className="mt-3 inline-flex shrink-0 items-center justify-center rounded-full bg-[#22c55e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#16a34a] sm:mt-0"
      >
        Upgrade now
      </Link>
    </div>
  );
}
