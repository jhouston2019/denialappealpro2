"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlanPriceDisplay } from "@/lib/billing/stripePlanPrices";

type Props = {
  onUnlock: () => void;
  busy?: boolean;
  /** Kept for API compatibility; all variants use the same copy. */
  variant?: "default" | "letter";
};

export function PreviewPaywallBlock({
  onUnlock,
  busy = false,
}: Props) {
  const [singlePrice, setSinglePrice] = useState<PlanPriceDisplay | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/plan-prices", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data.plans?.single) {
          setSinglePrice(data.plans.single);
        }
      } catch {
        /* keep fallback label */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const priceLabel = singlePrice
    ? singlePrice.amountFormatted
    : "$49";

  return (
    <div className="my-6 rounded-2xl border-2 border-[#2563EB]/40 bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center shadow-lg shadow-black/20">
      <h3 className="text-lg font-bold text-white sm:text-xl">
        Your Full Analysis Is Ready
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-300 sm:text-base">
        Unlock your demand letter, full findings, PDF report, and Word export
        — structured for negotiation or litigation.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={onUnlock}
        className="mt-5 inline-flex w-full max-w-sm items-center justify-center rounded-lg bg-[#f0a050] px-6 py-3.5 text-base font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Redirecting…" : `Unlock My Analysis — ${priceLabel}`}
      </button>
      <p className="mt-3 text-center text-xs text-slate-500">
        <Link
          href="/pricing"
          className="text-slate-400 underline-offset-2 transition hover:text-slate-300 hover:underline"
        >
          Need multiple reviews? See plans →
        </Link>
      </p>
    </div>
  );
}
