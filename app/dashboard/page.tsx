import Link from "next/link";
import { requireUserAndPaywall } from "@/lib/auth/serverPageGuards";
import { getBillingSnapshot } from "@/lib/billing/getBillingSnapshot";
import { PaymentActivationNotice } from "@/components/billing/PaymentActivationNotice";
import { PostPaymentSessionRefresh } from "@/components/billing/PostPaymentSessionRefresh";
import { DashboardHeroActions } from "@/components/dashboard/DashboardHeroActions";
import { DashboardPlanUsage } from "@/components/dashboard/DashboardPlanUsage";
import { LowUsageBanner } from "@/components/dashboard/LowUsageBanner";
import { PastReportsPanel } from "@/components/dashboard/PastReportsPanel";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; subscription?: string }>;
}) {
  const sp = await searchParams;
  const paymentReturn =
    sp.payment === "success" || sp.subscription === "success";
  const { supabase, user } = await requireUserAndPaywall();

  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      "id, insured_name, created_at, ai_summary_json, letter_text, pdf_report_url"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  let billingPlan = "—";
  let billingStatusLabel = "—";
  let renewalLabel: string | null = null;
  let usedReviews = 0;
  let limitReviews = 0;
  let reviewsRemainingCount = 0;
  let planType: string | null = null;
  let planNameDisplay = "";
  let billingCadence: "one_time" | "monthly" | null = null;
  let periodEndLabel: string | null = null;
  let hasTeam = false;

  const snap = await getBillingSnapshot(supabase, user.id);
  billingPlan = snap.plan === "none" ? "—" : snap.plan_display_name || snap.plan;
  billingStatusLabel = snap.status === "active" ? "Active" : "Inactive";
  renewalLabel = snap.renewal_date
    ? new Date(snap.renewal_date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  usedReviews = snap.usage;
  limitReviews = snap.reviews_limit;
  reviewsRemainingCount = snap.reviews_remaining;
  planType = snap.plan === "none" ? null : snap.plan;
  planNameDisplay = snap.plan_display_name;
  billingCadence = snap.billing_cadence;
  periodEndLabel = snap.billing_period_end
    ? new Date(snap.billing_period_end).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : renewalLabel;
  hasTeam = snap.has_team;

  const tier =
    planType === "single"
      ? "oneoff"
      : planType === "essential" ||
          planType === "professional" ||
          planType === "enterprise" ||
          planType === "premier" ||
          hasTeam
        ? "pro"
        : "free";

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {paymentReturn ? <PostPaymentSessionRefresh /> : null}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6 sm:py-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2"
            aria-label="Denial Appeal Pro home"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1e3a8a] shadow-lg shadow-[#1e3a8a]/30">
              <span className="text-xs font-black text-white">DAP</span>
            </div>
            <span className="truncate text-xs font-semibold text-slate-50 sm:text-sm">
              Denial Appeal Pro
            </span>
          </Link>
          <nav className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 text-[11px] font-medium text-slate-200 sm:ml-auto sm:w-auto sm:gap-3 sm:text-xs">
            <Link
              href="/dashboard"
              className="rounded-full bg-slate-900 px-2.5 py-1.5 text-blue-300 sm:px-3"
            >
              Dashboard
            </Link>
            <Link
              href="/account"
              className="rounded-full border border-slate-700 px-2.5 py-1.5 hover:border-slate-500 hover:text-slate-50 sm:px-3"
            >
              Account
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-3 py-6 sm:px-6 sm:py-8">
        <PaymentActivationNotice enabled={paymentReturn} />

        {limitReviews > 0 ? (
          <LowUsageBanner reviewsRemaining={reviewsRemainingCount} />
        ) : null}

        <section className="flex flex-col items-center px-2 py-4 text-center sm:py-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300">
            Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Your denial appeals
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Upload denial letters, generate appeal packages, and download PDF
            exports as claims evolve.
          </p>
          {planNameDisplay ? (
            <div className="mt-3 flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span className="min-w-0 break-words">
                Current plan:{" "}
                <span className="font-semibold text-slate-100">
                  {planNameDisplay}
                </span>
                {limitReviews > 0 ? (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-semibold text-emerald-300">
                      {reviewsRemainingCount} of {limitReviews} reviews left
                    </span>
                  </>
                ) : null}
              </span>
              {tier !== "pro" && (
                <Link
                  href="/account"
                  className="shrink-0 font-semibold text-blue-300 hover:underline hover:underline-offset-4"
                >
                  Upgrade
                </Link>
              )}
            </div>
          ) : null}
          <DashboardHeroActions
            reviewsRemaining={reviewsRemainingCount}
            reviewsLimit={limitReviews}
          />
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4 shadow-lg shadow-slate-950/50 sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-300">
            Billing &amp; usage
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
            {renewalLabel && (
              <div>
                <p className="text-[11px] font-medium text-slate-500">Renewal</p>
                <p className="mt-1 text-sm text-slate-200">{renewalLabel}</p>
              </div>
            )}
          </div>

          <DashboardPlanUsage
            planDisplayName={planNameDisplay}
            usedReviews={usedReviews}
            limitReviews={limitReviews}
            reviewsRemaining={reviewsRemainingCount}
            periodEndLabel={periodEndLabel}
            billingCadence={billingCadence}
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/account"
              className="inline-flex items-center justify-center rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-slate-400"
            >
              Manage billing
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full bg-[#1e3a8a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e40af]"
            >
              Upgrade plan
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-500/20"
            >
              Buy more reviews
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-200 shadow-lg shadow-slate-950/60 sm:p-5">
          <div className="flex flex-col gap-2 border-b border-slate-800 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <h2 className="shrink-0 text-xs font-semibold text-slate-100">
              Past reports
            </h2>
            <p className="text-[11px] text-slate-400 sm:max-w-md sm:text-right">
              Search, filter, and download appeal letters from your history.
            </p>
          </div>
          <div className="mt-3">
            <PastReportsPanel
              reviews={reviews ?? []}
              reviewsRemaining={reviewsRemainingCount}
              reviewsLimit={limitReviews}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
