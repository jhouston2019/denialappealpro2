import Link from "next/link";
import { Suspense } from "react";
import { requireUserAndPaywall } from "@/lib/auth/serverPageGuards";
import { DeliverablesHubClient } from "./DeliverablesHubClient";

export const metadata = {
  title: "Your deliverables | Estimate Review Pro",
  description:
    "View, download, and continue your estimate review deliverables after payment.",
};

function DeliverablesFallback() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-6xl items-center justify-center px-6 py-16">
      <p className="text-sm text-slate-400">Loading…</p>
    </main>
  );
}

export default async function DeliverablesPage() {
  await requireUserAndPaywall();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1e3a8a] shadow-lg shadow-[#1e3a8a]/30">
              <span className="text-xs font-black text-white">ER</span>
            </div>
            <span className="text-sm font-semibold text-slate-50">
              Estimate Review Pro
            </span>
          </Link>
          <nav className="flex items-center gap-3 text-xs font-medium text-slate-200">
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-slate-500"
            >
              Dashboard
            </Link>
            <Link
              href="/upload?step=2"
              className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-slate-500"
            >
              Wizard
            </Link>
          </nav>
        </div>
      </header>

      <Suspense fallback={<DeliverablesFallback />}>
        <DeliverablesHubClient />
      </Suspense>
    </div>
  );
}
