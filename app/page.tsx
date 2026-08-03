import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";

const STATS = [
  {
    value: "$262B",
    label: "in claims denied annually by US insurers",
  },
  {
    value: "65%",
    label:
      "of denied claims are never appealed — but 63% of appeals succeed",
  },
  {
    value: "15+ hrs",
    label: "billing staff spend per week on manual appeal letters",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Upload your denial letter or EOB",
    description: "PDF upload or paste text — no manual data entry required.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    ),
  },
  {
    step: "2",
    title: "AI extracts claim details",
    description:
      "CARC, RARC, CPT, ICD-10, patient info, and payer data pulled into a structured FactLedger.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    ),
  },
  {
    step: "3",
    title: "Review and confirm extracted facts",
    description:
      "Verify every field before generation. Edit gaps, add clinical context, and confirm provider details.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    ),
  },
  {
    step: "4",
    title: "Download a defensible appeal letter",
    description:
      "Submission-ready PDF or Word with CARC-specific arguments and pre-approved regulatory citations.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    ),
  },
];

const DIFFERENTIATORS = [
  {
    title: "CARC/RARC-Specific Arguments",
    description:
      "Every denial type gets a targeted strategy, not generic boilerplate.",
  },
  {
    title: "Hallucination-Free Citations",
    description:
      "Authority library of pre-approved regulatory citations. No fabricated guidelines.",
  },
  {
    title: "Fact-Grounded Letters",
    description:
      "FactLedger system ensures every claim in the letter traces back to your document.",
  },
  {
    title: "Export Validation",
    description:
      "Letters are blocked from export if required facts are missing or citations are unverified.",
  },
  {
    title: "230+ Denial Codes Mapped",
    description:
      "CARC table covers the most common denial scenarios billing teams face.",
  },
];

const DENIAL_TYPES = [
  "Prior Authorization",
  "NCCI Bundling",
  "Timely Filing",
  "Medical Necessity",
  "Claim Defects",
  "Non-Covered Benefits",
  "Duplicate Claims",
  "Experimental/Investigational",
  "Wrong Payer",
  "Coordination of Benefits",
];

const PLANS = [
  {
    name: "Essential",
    price: "$399",
    period: "/month",
    description: "10 appeals per month for growing billing teams.",
    features: ["CARC/RARC intelligence", "PDF & Word export", "Appeal history"],
    popular: false,
  },
  {
    name: "Professional",
    price: "$699",
    period: "/month",
    description: "25 appeals per month — most popular for provider offices.",
    features: [
      "Priority generation",
      "Saved provider profiles",
      "Bulk appeal processing",
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$1,499",
    period: "/month",
    description: "50 appeals per month for high-volume revenue cycle teams.",
    features: [
      "Highest monthly volume",
      "Team-ready workflow",
      "Dedicated support path",
    ],
    popular: false,
  },
];

function PrimaryCta({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-lg bg-[#22c55e] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#22c55e]/20 transition hover:bg-[#16a34a] ${className}`}
    >
      {children}
    </Link>
  );
}

function SecondaryCta({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-lg border border-slate-600 bg-transparent px-6 py-3.5 text-base font-semibold text-slate-200 transition hover:border-slate-400 hover:text-white ${className}`}
    >
      {children}
    </Link>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#1e293b]">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-[#0f172a]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <BrandLogo size="md" />
          <nav className="flex items-center gap-3 text-sm font-medium sm:gap-6">
            <Link
              href="/pricing"
              className="hidden text-slate-200 transition hover:text-white sm:inline"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white sm:px-4"
            >
              Log in
            </Link>
            <Link
              href="/analysis-preview"
              className="rounded-full bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#16a34a] sm:px-5"
            >
              Free Preview
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* 1. Hero */}
        <section className="border-b border-slate-800/50 bg-[#0f172a] px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-4 inline-block rounded-full border border-slate-700 bg-slate-800/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
              Built for billing professionals
            </p>
            <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              Turn Insurance Denials Into Paid Claims — In Minutes
            </h1>
            <p className="mx-auto mb-10 max-w-3xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Denial Appeal Pro generates submission-ready appeal letters with
              CARC-specific arguments, regulatory citations, and clinical
              grounding. Built for billing teams who can&apos;t afford to leave
              money on the table.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <PrimaryCta href="/analysis-preview" className="w-full sm:w-auto">
                Generate Your First Appeal Free
              </PrimaryCta>
              <SecondaryCta href="/pricing" className="w-full sm:w-auto">
                See Pricing
              </SecondaryCta>
            </div>
            <p className="mt-6 text-sm text-slate-400">
              No credit card required for preview · HIPAA-conscious · Used by
              billing professionals
            </p>
          </div>
        </section>

        {/* 2. Problem / Stakes */}
        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-10 text-center text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
              The average denial costs $25–$118 to rework. Most never get
              appealed.
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {STATS.map((stat) => (
                <div
                  key={stat.value}
                  className="rounded-xl border border-slate-700/80 bg-white p-6 shadow-sm"
                >
                  <p className="mb-2 text-3xl font-bold text-[#0f172a] sm:text-4xl">
                    {stat.value}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-slate-500">
              Sources: MGMA, CMS, Advisory Board
            </p>
          </div>
        </section>

        {/* 3. How It Works */}
        <section className="border-y border-slate-800/50 bg-[#0f172a] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-4 text-center text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
              From denial to submission-ready letter in 4 steps
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-slate-400">
              Preview extraction and review free. Pay only when you generate and
              export.
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl border border-slate-700/60 bg-white p-6"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#22c55e]/10">
                      <svg
                        className="h-5 w-5 text-[#22c55e]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden
                      >
                        {item.icon}
                      </svg>
                    </div>
                    <span className="text-sm font-bold text-[#22c55e]">
                      Step {item.step}
                    </span>
                  </div>
                  <h3 className="mb-2 font-semibold text-[#0f172a]">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <PrimaryCta href="/analysis-preview">Try It Free</PrimaryCta>
            </div>
          </div>
        </section>

        {/* 4. Why DAP Is Different */}
        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-4 text-center text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
              Not just ChatGPT with a prompt
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-slate-400">
              Purpose-built appeal infrastructure for revenue cycle teams — not
              a generic AI wrapper.
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {DIFFERENTIATORS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-slate-700/80 bg-white p-6"
                >
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#22c55e]">
                    <svg
                      className="h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-2 font-semibold text-[#0f172a]">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Denial Types Covered */}
        <section className="border-y border-slate-800/50 bg-[#0f172a] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-4 text-center text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
              Built for the denials that cost you the most
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-center text-slate-400">
              Targeted appeal strategies mapped to real CARC codes — not
              one-size-fits-all templates.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {DENIAL_TYPES.map((type) => (
                <span
                  key={type}
                  className="rounded-full border border-slate-600 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-200"
                >
                  {type}
                </span>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">
              Strategies are continuously expanded based on real-world denial
              patterns
            </p>
          </div>
        </section>

        {/* 6. Appeal Resources */}
        <section className="border-y border-slate-800/50 bg-slate-900/40 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-4 text-center text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
              Free Insurance Appeal Resources
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-center text-slate-400">
              Learn how to fight back against common denial types with our free
              guides.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Link
                href="/appeals/ai/can-ai-write-insurance-appeal-letter.html"
                className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 transition hover:border-[#22c55e]/50 hover:bg-slate-800"
              >
                <h3 className="mb-2 font-semibold text-white">
                  Can AI Write an Insurance Appeal Letter?
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  How AI generates CARC-specific appeal letters from your denial
                  in under 60 seconds.
                </p>
              </Link>
              <Link
                href="/appeals/ai/how-do-i-write-appeal-letter-medical-necessity.html"
                className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 transition hover:border-[#22c55e]/50 hover:bg-slate-800"
              >
                <h3 className="mb-2 font-semibold text-white">
                  How to Appeal a Medical Necessity Denial
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  Map clinical findings to payer coverage criteria for CARC 50
                  medical necessity denials.
                </p>
              </Link>
              <Link
                href="/appeals/ai/index.html"
                className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 transition hover:border-[#22c55e]/50 hover:bg-slate-800"
              >
                <h3 className="mb-2 font-semibold text-white">
                  CARC Code Guide for Billing Professionals
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  Direct answers to 20 common AI and insurance appeal questions
                  from billing teams.
                </p>
              </Link>
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/appeals/ai/index.html"
                className="text-sm font-semibold text-[#22c55e] hover:text-[#16a34a] hover:underline"
              >
                View all guides →
              </Link>
            </div>
          </div>
        </section>

        {/* 7. Pricing CTA */}
        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-4 text-center text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
              Start with one free appeal preview
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-slate-400">
              Walk through extraction and review at no cost. Subscribe when
              you&apos;re ready to generate and export at scale.
            </p>
            <div className="grid gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-xl bg-white p-8 ${
                    plan.popular
                      ? "border-2 border-[#22c55e] shadow-lg shadow-[#22c55e]/10"
                      : "border border-slate-200"
                  }`}
                >
                  {plan.popular ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#22c55e] px-4 py-1 text-xs font-semibold text-white">
                      Most Popular
                    </div>
                  ) : null}
                  <h3 className="mb-1 text-xl font-bold text-[#0f172a]">
                    {plan.name}
                  </h3>
                  <div className="mb-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[#0f172a]">
                      {plan.price}
                    </span>
                    <span className="text-slate-500">{plan.period}</span>
                  </div>
                  <p className="mb-6 text-sm text-slate-600">
                    {plan.description}
                  </p>
                  <ul className="mb-8 space-y-2">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-slate-700"
                      >
                        <svg
                          className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#22c55e]"
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
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/pricing"
                    className={`block w-full rounded-lg py-3 text-center text-sm font-semibold transition ${
                      plan.popular
                        ? "bg-[#22c55e] text-white hover:bg-[#16a34a]"
                        : "border border-slate-300 text-[#0f172a] hover:border-[#22c55e] hover:text-[#16a34a]"
                    }`}
                  >
                    View {plan.name} Plan
                  </Link>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <PrimaryCta href="/analysis-preview">
                Start Free Preview
              </PrimaryCta>
              <p className="mt-4 text-xs text-slate-500">
                Live prices shown at checkout · See{" "}
                <Link href="/pricing" className="text-[#22c55e] hover:underline">
                  full pricing
                </Link>{" "}
                for single appeals and bulk packs
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
