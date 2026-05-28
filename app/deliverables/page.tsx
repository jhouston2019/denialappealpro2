import Link from "next/link";
import { Suspense } from "react";
import { requireUserAndPaywall } from "@/lib/auth/serverPageGuards";
import { getBillingSnapshot } from "@/lib/billing/getBillingSnapshot";
import { DeliverablesHubClient } from "./DeliverablesHubClient";
import "@/app/upload/erp-wizard.css";

export const metadata = {
  title: "Complete review report | Estimate Review Pro",
  description:
    "View your full estimate review report with analysis, comparison, strategy, summary, and letter deliverables.",
};

function DeliverablesFallback() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-6xl items-center justify-center px-6 py-16">
      <p className="text-sm text-[#8aacc8]">Loading…</p>
    </main>
  );
}

export default async function DeliverablesPage() {
  const { supabase, user } = await requireUserAndPaywall();
  const snap = await getBillingSnapshot(supabase, user.id);

  return (
    <div className="erp-wizard-shell flex min-h-screen flex-col bg-[#0f2744]">
      <header className="sticky top-0 z-[100] border-b border-[#1e3f6e] bg-[#091c33] text-white">
        <div className="mx-auto flex min-h-12 max-w-6xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6 sm:py-0">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2"
            aria-label="Estimate Review Pro home"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f0a050]">
              <span className="text-xs font-black text-white">ER</span>
            </div>
            <span className="truncate text-xs font-semibold text-[#e8f0f8] sm:text-sm">
              Estimate Review Pro
            </span>
          </Link>
        </div>
      </header>

      <Suspense fallback={<DeliverablesFallback />}>
        <DeliverablesHubClient
          reviewNavBilling={{
            plan: snap.plan,
            status: snap.status,
            reviews_limit: snap.reviews_limit,
            reviews_remaining: snap.reviews_remaining,
          }}
        />
      </Suspense>
    </div>
  );
}
