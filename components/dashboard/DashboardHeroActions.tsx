import Link from "next/link";

type Props = {
  reviewsRemaining: number;
  reviewsLimit: number;
};

export function DashboardHeroActions({
  reviewsRemaining,
  reviewsLimit,
}: Props) {
  const canStart =
    reviewsLimit <= 0 || reviewsRemaining > 0;
  const singleHref = canStart ? "/upload" : "/pricing";
  const bulkHref = canStart ? "/upload?mode=bulk" : "/pricing";

  return (
    <div className="mt-6 flex w-full max-w-lg flex-col gap-3 sm:flex-row sm:justify-center">
      <Link
        href={singleHref}
        className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-500 bg-transparent px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-300 hover:bg-slate-900/60 sm:text-base"
      >
        Single Appeal
      </Link>
      <Link
        href={bulkHref}
        className="inline-flex flex-1 items-center justify-center rounded-full bg-[#22c55e] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#22c55e]/30 transition hover:bg-[#16a34a] sm:text-base"
      >
        Bulk Upload — up to 10 PDFs
      </Link>
    </div>
  );
}
