"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PricingSiteHeader } from "@/components/marketing/PricingSiteHeader";
import { markNewReviewCheckout } from "@/lib/wizard-snapshot";
import type { CheckoutPlanType, PlanPriceDisplay } from "@/lib/billing/stripePlanPrices";

type PlanKey = CheckoutPlanType;

type Props = {
  userEmail: string | null;
};

const CORE_FEATURES: readonly string[] = [
  "AI-generated appeal letters",
  "PDF and EOB extraction",
  "CARC/RARC code intelligence",
  "Regulatory citations (NCCI, CMS, ERISA, ACA)",
  "PDF and Word export",
  "Appeal history",
];

const SUBSCRIPTION_FEATURES: readonly string[] = [
  "Priority generation",
  "Saved provider profiles",
  "Bulk appeal processing",
];

const SUBSCRIPTION_PLANS: readonly {
  plan: Extract<PlanKey, "essential" | "professional" | "enterprise">;
  title: string;
  appealsLabel: string;
  cta: string;
  popular?: boolean;
}[] = [
  {
    plan: "essential",
    title: "Essential",
    appealsLabel: "10 appeals per month",
    cta: "Start Essential Plan",
  },
  {
    plan: "professional",
    title: "Professional",
    appealsLabel: "25 appeals per month",
    cta: "Start Professional Plan",
    popular: true,
  },
  {
    plan: "enterprise",
    title: "Enterprise",
    appealsLabel: "50 appeals per month",
    cta: "Start Enterprise Plan",
  },
];

const BULK_PACKS: readonly {
  plan: Extract<PlanKey, "bulk_10" | "bulk_25" | "bulk_50" | "bulk_100">;
  appeals: number;
  perAppeal: string;
  cta: string;
}[] = [
  {
    plan: "bulk_10",
    appeals: 10,
    perAppeal: "$8.90/appeal",
    cta: "Buy 10 Appeals",
  },
  {
    plan: "bulk_25",
    appeals: 25,
    perAppeal: "$7.96/appeal",
    cta: "Buy 25 Appeals",
  },
  {
    plan: "bulk_50",
    appeals: 50,
    perAppeal: "$6.98/appeal",
    cta: "Buy 50 Appeals",
  },
  {
    plan: "bulk_100",
    appeals: 100,
    perAppeal: "$6.99/appeal",
    cta: "Buy 100 Appeals",
  },
];

function Check() {
  return (
    <svg
      className="h-5 w-5 flex-shrink-0 text-[#2563EB]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function PlanPriceLine({
  plan,
  prices,
  pricesLoading,
}: {
  plan: PlanKey;
  prices: Partial<Record<PlanKey, PlanPriceDisplay>>;
  pricesLoading: boolean;
}) {
  const entry = prices[plan];

  if (pricesLoading && !entry) {
    return (
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-slate-900">…</span>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-sm text-slate-600">Price unavailable</span>
      </div>
    );
  }

  const suffixText = entry.suffix.startsWith("(")
    ? entry.suffix
    : entry.suffix.replace(/^\//, "");

  return (
    <div className="mb-2 flex items-baseline gap-2">
      <span className="text-4xl font-bold text-slate-900">
        {entry.amountFormatted}
      </span>
      <span className="text-slate-600">
        {entry.suffix.startsWith("(") ? suffixText : `/${suffixText}`}
      </span>
    </div>
  );
}

function FeatureList({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2 text-sm text-slate-700">
          <Check />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PricingPageClient({ userEmail }: Props) {
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const [prices, setPrices] = useState<Partial<Record<PlanKey, PlanPriceDisplay>>>(
    {}
  );
  const [pricesLoading, setPricesLoading] = useState(true);
  const isLoggedIn = Boolean(userEmail);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/plan-prices", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data.plans) {
          setPrices(data.plans);
        }
      } catch (e) {
        console.error("Failed to load plan prices:", e);
      } finally {
        if (!cancelled) setPricesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCheckout = async (planType: PlanKey) => {
    setLoading(planType);

    try {
      markNewReviewCheckout(planType);
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        const msg = [data.error, data.details].filter(Boolean).join(" — ");
        throw new Error(msg || "Failed to create checkout session");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to start checkout.";
      alert(message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0F172A]">
      <PricingSiteHeader userEmail={userEmail} />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-white sm:text-5xl">
            Turn Denials Into Revenue — In Minutes
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-300 sm:text-xl">
            AI-powered appeal generation that extracts denial details, builds legally
            grounded letters, and gets your claims submission-ready fast.
          </p>
          {isLoggedIn && userEmail ? (
            <p className="mt-2 text-sm text-slate-500">
              Signed in as {userEmail}
            </p>
          ) : null}
        </div>

        <section className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-white sm:text-3xl">
            Subscribe and Save
          </h2>
          <div className="grid gap-8 lg:grid-cols-3">
            {SUBSCRIPTION_PLANS.map(
              ({ plan, title, appealsLabel, cta, popular }) => (
                <div
                  key={plan}
                  className={`relative rounded-lg bg-[#F8FAFC] p-8 ${
                    popular
                      ? "border-2 border-[#2563EB]"
                      : "border border-slate-800"
                  }`}
                >
                  {popular ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2563EB] px-4 py-1 text-xs font-semibold text-white">
                      ★ Most Popular
                    </div>
                  ) : null}
                  <div className="mb-6">
                    <h3 className="mb-2 text-2xl font-bold text-slate-900">
                      {title}
                    </h3>
                    <PlanPriceLine
                      plan={plan}
                      prices={prices}
                      pricesLoading={pricesLoading}
                    />
                  </div>

                  <div className="mb-8">
                    <FeatureList
                      items={[appealsLabel, ...CORE_FEATURES, ...SUBSCRIPTION_FEATURES]}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCheckout(plan)}
                    disabled={loading === plan}
                    className="w-full rounded-lg bg-[#2563EB] px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-[#1E40AF] disabled:opacity-50"
                  >
                    {loading === plan ? "Loading..." : cta}
                  </button>
                </div>
              )
            )}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-8 text-center text-2xl font-bold text-white sm:text-3xl">
            Pay As You Go
          </h2>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-[#F8FAFC] p-8">
              <div className="mb-6">
                <h3 className="mb-2 text-2xl font-bold text-slate-900">Single</h3>
                <PlanPriceLine
                  plan="single"
                  prices={prices}
                  pricesLoading={pricesLoading}
                />
                <p className="text-sm text-slate-600">
                  Try it once, no commitment
                </p>
              </div>

              <div className="mb-8">
                <FeatureList items={["1 appeal", ...CORE_FEATURES]} />
              </div>

              <button
                type="button"
                onClick={() => handleCheckout("single")}
                disabled={loading === "single"}
                className="w-full rounded-lg bg-[#2563EB] px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-[#1E40AF] disabled:opacity-50"
              >
                {loading === "single" ? "Loading..." : "Start Single Appeal"}
              </button>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#F8FAFC] p-8">
              <div className="mb-6">
                <h3 className="mb-2 text-2xl font-bold text-slate-900">
                  Bulk Packs
                </h3>
                <p className="text-sm text-slate-600">
                  Prepaid appeal credits — use anytime
                </p>
              </div>

              <div className="mb-6 space-y-4">
                {BULK_PACKS.map(({ plan, appeals, perAppeal, cta }) => (
                  <div
                    key={plan}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {appeals} appeals
                        </p>
                        <div className="mt-1">
                          <PlanPriceLine
                            plan={plan}
                            prices={prices}
                            pricesLoading={pricesLoading}
                          />
                          <p className="text-xs text-slate-500">{perAppeal}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCheckout(plan)}
                        disabled={loading === plan}
                        className="shrink-0 rounded-lg border border-[#2563EB] bg-white px-4 py-2 text-sm font-semibold text-[#2563EB] transition hover:bg-blue-50 disabled:opacity-50"
                      >
                        {loading === plan ? "Loading..." : cta}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <FeatureList items={CORE_FEATURES} />
            </div>
          </div>
        </section>

        <p className="text-center text-sm text-slate-400">
          No contracts. Cancel anytime. Appeals generated in under 60 seconds.
        </p>
      </main>

      <footer className="border-t border-slate-800/50 bg-[#0F172A]/95">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Denial Appeal Pro. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/pricing" className="transition hover:text-slate-300">
              Pricing
            </Link>
            <Link
              href={isLoggedIn ? "/dashboard" : "/"}
              className="transition hover:text-slate-300"
            >
              {isLoggedIn ? "Dashboard" : "Home"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
