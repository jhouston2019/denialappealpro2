import Link from "next/link";
import { requireUserAndPaywall } from "@/lib/auth/serverPageGuards";
import { getBillingSnapshot } from "@/lib/billing/getBillingSnapshot";
import { PaymentActivationNotice } from "@/components/billing/PaymentActivationNotice";
import { PostPaymentSessionRefresh } from "@/components/billing/PostPaymentSessionRefresh";
import { ReviewNavCtaLink } from "@/components/billing/ReviewNavCtaLink";
import { DashboardPlanUsage } from "@/components/dashboard/DashboardPlanUsage";

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
    .select("*")
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
            aria-label="Estimate Review Pro home"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1e3a8a] shadow-lg shadow-[#1e3a8a]/30">
              <span className="text-xs font-black text-white">ER</span>
            </div>
            <span className="truncate text-xs font-semibold text-slate-50 sm:text-sm">
              Estimate Review Pro
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
            <ReviewNavCtaLink
              billing={{
                plan: planType ?? "none",
                status: snap.status,
                reviews_limit: limitReviews,
                reviews_remaining: reviewsRemainingCount,
              }}
            />
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-3 py-6 sm:px-6 sm:py-8">
        <PaymentActivationNotice enabled={paymentReturn} />

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

        <section className="flex flex-col justify-between gap-4 min-[400px]:flex-row min-[400px]:items-center">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300">
              Dashboard
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-50 min-[400px]:text-2xl">
              Your estimate reviews
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              Upload new estimates, download AI reports, and re‑run analysis as
              claims evolve.
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-3 text-xs text-slate-200 min-[400px]:w-auto min-[400px]:items-end">
            <Link
              href="/upload?new=1"
              className="inline-flex w-full items-center justify-center rounded-full bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#2563EB]/40 transition hover:bg-[#1E40AF] md:w-auto"
            >
              New review
            </Link>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              {planNameDisplay ? (
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
              ) : null}
              {tier !== "pro" && (
                <Link
                  href="/account"
                  className="shrink-0 font-semibold text-blue-300 hover:underline hover:underline-offset-4"
                >
                  Upgrade
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-200 shadow-lg shadow-slate-950/60 sm:p-5">
          <div className="flex flex-col gap-2 border-b border-slate-800 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <h2 className="shrink-0 text-xs font-semibold text-slate-100">
              Past reports
            </h2>
            <p className="text-[11px] text-slate-400 sm:max-w-md sm:text-right">
              We keep a full history of your PDF exports for audit and
              record‑keeping.
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {!reviews || reviews.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                No reviews yet. Start by uploading a contractor and carrier
                estimate.
              </p>
            ) : (
              <div className="divide-y divide-slate-900/80">
                {reviews.map((review: any) => (
                  <div
                    key={review.id}
                    className="flex flex-col items-start justify-between gap-3 py-3 md:flex-row md:items-center"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-100">
                        {review.insured_name?.trim() || "Estimate Review"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Created{" "}
                        {new Date(review.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                        Ready
                      </span>
                      {review.pdf_report_url && (
                        <a
                          href={review.pdf_report_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 font-semibold hover:border-slate-500 hover:text-slate-50"
                        >
                          Download PDF
                        </a>
                      )}
                      <Link
                        href={`/deliverables?reviewId=${review.id}`}
                        className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 font-semibold hover:border-slate-500 hover:text-slate-50"
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}


