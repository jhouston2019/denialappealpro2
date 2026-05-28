import Link from "next/link";
import { requireUserAndPaywall } from "@/lib/auth/serverPageGuards";
import { getBillingSnapshot } from "@/lib/billing/getBillingSnapshot";
import { ReviewNavCtaLink } from "@/components/billing/ReviewNavCtaLink";
import { AccountSignOutButton } from "./AccountSignOutButton";

export default async function AccountPage() {
  const { supabase, user } = await requireUserAndPaywall();

  const snap = await getBillingSnapshot(supabase, user.id);
  const billingPlan = snap.plan === "none" ? "—" : snap.plan;
  const billingStatusLabel = snap.status === "active" ? "Active" : "Inactive";

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
          <nav className="flex items-center gap-4 text-xs font-medium text-slate-200">
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-slate-500 hover:text-slate-50"
            >
              Dashboard
            </Link>
            <Link
              href="/account"
              className="rounded-full bg-slate-900 px-3 py-1.5 text-blue-300"
            >
              Account
            </Link>
            <ReviewNavCtaLink
              billing={{
                plan: snap.plan,
                status: snap.status,
                reviews_limit: snap.reviews_limit,
                reviews_remaining: snap.reviews_remaining,
              }}
            />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-xl font-semibold text-slate-50">Account</h1>
        <p className="mt-2 text-xs text-slate-400">
          Signed in as{" "}
          <span className="font-medium text-slate-200">{user.email}</span>
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium text-slate-500">Current plan</p>
            <p className="mt-1 text-sm font-semibold capitalize text-slate-100">
              {billingPlan}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500">
              Billing status
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              {billingStatusLabel}
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-400"
          >
            Manage billing
          </Link>
          <AccountSignOutButton />
        </div>
      </main>
    </div>
  );
}
