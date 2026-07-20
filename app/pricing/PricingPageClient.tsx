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

const SINGLE_FEATURES: readonly string[] = [
  "1 appeal",
  ...CORE_FEATURES,
  "No subscription required",
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

function CheckLight() {
  return (
    <svg
      className="h-5 w-5 flex-shrink-0 text-blue-400"
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
  dark = false,
}: {
  plan: PlanKey;
  prices: Partial<Record<PlanKey, PlanPriceDisplay>>;
  pricesLoading: boolean;
  dark?: boolean;
}) {
  const entry = prices[plan];
  const amountClass = dark
    ? "text-5xl font-bold text-white"
    : "text-5xl font-bold text-slate-900";
  const suffixClass = dark ? "text-slate-300" : "text-slate-600";

  if (pricesLoading && !entry) {
    return (
      <div className="mb-4 flex items-baseline gap-2">
        <span className={amountClass}>…</span>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="mb-4 flex items-baseline gap-2">
        <span className={`text-sm ${suffixClass}`}>Price unavailable</span>
      </div>
    );
  }

  const suffixText = entry.suffix.startsWith("(")
    ? entry.suffix
    : entry.suffix.replace(/^\//, "");

  return (
    <div className="mb-4 flex items-baseline gap-2">
      <span className={amountClass}>{entry.amountFormatted}</span>
      <span className={suffixClass}>
        {entry.suffix.startsWith("(") ? suffixText : `/${suffixText}`}
      </span>
    </div>
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

        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-[#F8FAFC] p-8">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-slate-900">Single</h2>
              <PlanPriceLine
                plan="single"
                prices={prices}
                pricesLoading={pricesLoading}
              />
            </div>

            <ul className="mb-8 space-y-3">
              {SINGLE_FEATURES.map((t) => (
                <li
                  key={t}
                  className="flex items-start gap-2 text-sm text-slate-700"
                >
                  <Check />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

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
              <h2 className="mb-2 text-2xl font-bold text-slate-900">
                Essential
              </h2>
              <PlanPriceLine
                plan="essential"
                prices={prices}
                pricesLoading={pricesLoading}
              />
            </div>

            <ul className="mb-8 space-y-3">
              {[
                "10 appeals per month",
                "Unused appeals roll over (up to 1 month)",
                ...CORE_FEATURES,
                "Priority processing",
              ].map((t) => (
                <li
                  key={t}
                  className="flex items-start gap-2 text-sm text-slate-700"
                >
                  <Check />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => handleCheckout("essential")}
              disabled={loading === "essential"}
              className="w-full rounded-lg bg-[#2563EB] px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-[#1E40AF] disabled:opacity-50"
            >
              {loading === "essential"
                ? "Loading..."
                : "Start Essential Plan"}
            </button>
          </div>

          <div className="relative rounded-lg border-2 border-[#2563EB] bg-[#F8FAFC] p-8">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2563EB] px-4 py-1 text-xs font-semibold text-white">
              Most Popular
            </div>
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-slate-900">
                Professional
              </h2>
              <PlanPriceLine
                plan="professional"
                prices={prices}
                pricesLoading={pricesLoading}
              />
            </div>

            <ul className="mb-8 space-y-3">
              {[
                "25 appeals per month",
                "Unused appeals roll over (up to 1 month)",
                ...CORE_FEATURES,
                "Priority processing",
                "Bulk PDF upload (up to 100 files)",
                "CSV / Excel batch processing",
              ].map((t) => (
                <li
                  key={t}
                  className="flex items-start gap-2 text-sm text-slate-700"
                >
                  <Check />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => handleCheckout("professional")}
              disabled={loading === "professional"}
              className="w-full rounded-lg bg-[#2563EB] px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-[#1E40AF] disabled:opacity-50"
            >
              {loading === "professional"
                ? "Loading..."
                : "Start Professional Plan"}
            </button>
          </div>

          <div className="relative rounded-lg border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-8">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-white">Enterprise</h2>
              <PlanPriceLine
                plan="enterprise"
                prices={prices}
                pricesLoading={pricesLoading}
                dark
              />
            </div>

            <ul className="mb-8 space-y-3">
              {[
                "75 appeals per month",
                "Unused appeals roll over (up to 1 month)",
                ...CORE_FEATURES,
                "Priority processing",
                "Bulk PDF upload (up to 100 files)",
                "CSV / Excel batch processing",
                "Dedicated account support",
                "Custom payer templates",
              ].map((t) => (
                <li
                  key={t}
                  className="flex items-start gap-2 text-sm text-slate-200"
                >
                  <CheckLight />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => handleCheckout("enterprise")}
              disabled={loading === "enterprise"}
              className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
            >
              {loading === "enterprise"
                ? "Loading..."
                : "Start Enterprise Plan"}
            </button>
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-slate-400">
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
