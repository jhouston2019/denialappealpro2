import { Suspense } from "react";
import { requireUserAndPaywall } from "@/lib/auth/serverPageGuards";
import { getBillingSnapshot } from "@/lib/billing/getBillingSnapshot";
import { DeliverablesSiteHeader } from "@/components/deliverables/DeliverablesSiteHeader";
import { DeliverablesHubClient } from "./DeliverablesHubClient";
import "@/app/upload/dap-wizard.css";

export const metadata = {
  title: "Complete review report | Denial Appeal Pro",
  description:
    "View your full denial appeal report with analysis, comparison, strategy, summary, and letter deliverables.",
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
    <div className="dap-wizard-shell flex min-h-screen flex-col bg-[#0f2744]">
      <DeliverablesSiteHeader />

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
