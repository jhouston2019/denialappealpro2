"use client";

import Link from "next/link";
import { useState } from "react";
import { markNewReviewCheckout } from "@/lib/wizard-snapshot";

type PlanKey = "single" | "essential" | "professional" | "enterprise";

const CORE_FEATURES: readonly string[] = [
  "Scope gap and omission detection",
  "Pricing discrepancy flags",
  "Carrier vs. contractor comparison",
  "Strategy recommendations",
  "AI-generated dispute letter",
  "PDF and Word export",
  "Review dashboard with full history",
];

const SINGLE_FEATURES: readonly string[] = [
  "1 estimate review",
  ...CORE_FEATURES,
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

export default function PricingPage() {
  const [loading, setLoading] = useState<PlanKey | null>(null);

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
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0F172A]">
      <header className="border-b border-slate-800/50 bg-[#0F172A]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB]">
              <span className="text-sm font-black text-white">ER</span>
            </div>
            <span className="text-sm font-semibold text-white">
              Estimate Review Pro
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/pricing" className="text-white">
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Log in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-white sm:text-5xl">
            Find What the Carrier Missed — In Minutes
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-300 sm:text-xl">
            Start with a single review or subscribe
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
          {/* Single */}
          <div className="relative rounded-lg border-2 border-[#2563EB] bg-[#F8FAFC] p-8">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-slate-900">Single</h2>
              <div className="mb-4 flex items-baseline gap-2">
                <span className="text-5xl font-bold text-slate-900">$49</span>
                <span className="text-slate-600">(one-time)</span>
              </div>
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
              {loading === "single" ? "Loading..." : "Start Review"}
            </button>
          </div>

          {/* Essential */}
          <div className="rounded-lg border border-slate-800 bg-[#F8FAFC] p-8">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-slate-900">
                Essential
              </h2>
              <div className="mb-4 flex items-baseline gap-2">
                <span className="text-5xl font-bold text-slate-900">$399</span>
                <span className="text-slate-600">/month</span>
              </div>
            </div>

            <ul className="mb-8 space-y-3">
              {[
                "10 reviews per month, unused roll over",
                ...CORE_FEATURES,
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

          {/* Professional */}
          <div className="rounded-lg border border-slate-800 bg-[#F8FAFC] p-8">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-slate-900">
                Professional
              </h2>
              <div className="mb-4 flex items-baseline gap-2">
                <span className="text-5xl font-bold text-slate-900">$699</span>
                <span className="text-slate-600">/month</span>
              </div>
            </div>

            <ul className="mb-8 space-y-3">
              {[
                "20 reviews per month, unused roll over",
                ...CORE_FEATURES,
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

          {/* Enterprise */}
          <div className="relative rounded-lg border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-8">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold text-white">Enterprise</h2>
              <div className="mb-4 flex items-baseline gap-2">
                <span className="text-5xl font-bold text-white">$1,499</span>
                <span className="text-slate-300">/month</span>
              </div>
            </div>

            <ul className="mb-8 space-y-3">
              {[
                "50 reviews per month, unused roll over",
                ...CORE_FEATURES,
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
      </main>

      <footer className="border-t border-slate-800/50 bg-[#0F172A]/95">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Estimate Review Pro. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/pricing" className="transition hover:text-slate-300">
              Pricing
            </Link>
            <Link href="/" className="transition hover:text-slate-300">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
