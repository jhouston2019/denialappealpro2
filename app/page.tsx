import Link from "next/link";

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Upload your denial letter or EOB",
    description:
      "Drop a PDF or paste denial text. We extract claim details automatically — no manual data entry.",
  },
  {
    step: "2",
    title: "Review extracted claim data and CARC/RARC codes",
    description:
      "Verify patient, payer, and denial codes with confidence highlighting. Edit anything before you generate.",
  },
  {
    step: "3",
    title: "Generate a professional appeal letter",
    description:
      "Get a submission-ready appeal in attorney/CPC voice — cite the right codes, regulations, and clinical facts.",
  },
];

const WHAT_DAP_DOES = [
  {
    title: "Identifies denial reason from CARC/RARC codes",
    description:
      "Maps adjustment and remittance codes to targeted rebuttal strategies for each denial category.",
  },
  {
    title: "Cites regulatory authority (NCCI, CMS, ERISA, ACA)",
    description:
      "Grounds every appeal in applicable billing rules, coverage law, and payer policy frameworks.",
  },
  {
    title: "Writes in attorney/CPC voice",
    description:
      "Formal, authoritative prose that reads like it came from a billing attorney — not a generic template.",
  },
  {
    title: "Produces submission-ready PDF",
    description:
      "Export your appeal as PDF or Word, ready to send to the payer's appeals department.",
  },
];

const WHO_ITS_FOR = [
  "Medical billing professionals",
  "Provider offices",
  "Revenue cycle teams",
  "Patients fighting denials",
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0F172A]">
      <header className="border-b border-slate-800/50 bg-[#0F172A]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB]">
              <span className="text-sm font-black text-white">ER</span>
            </div>
            <span className="text-sm font-semibold text-white">
              Denial Appeal Pro
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link
              href="/pricing"
              className="text-slate-200 transition hover:text-white"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/analysis-preview"
              className="rounded-full bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1E40AF]"
            >
              Free Preview
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col px-6 py-16 md:py-24">
        {/* Hero */}
        <section className="mb-20 text-center">
          <p className="mb-4 inline-block rounded-full border border-slate-600 bg-slate-800/50 px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-300 md:text-sm">
            AI-powered healthcare appeals
          </p>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-[52px]">
            Turn Denials Into Revenue — In Minutes
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl font-medium leading-relaxed text-slate-300 md:text-2xl">
            Upload your denial letter. Get a submission-ready appeal in under
            60 seconds.
          </p>
          <Link
            href="/analysis-preview"
            className="inline-flex items-center justify-center rounded-lg bg-[#2563EB] px-8 py-4 text-base font-semibold text-white transition hover:bg-[#1E40AF]"
          >
            Upload Your Denial Letter
          </Link>
          <p className="mt-6 text-sm text-slate-400">
            No account required for preview · Pay only when you generate
          </p>
        </section>

        {/* How it works */}
        <section className="mb-20">
          <h2 className="mb-10 text-center text-3xl font-bold text-white md:text-4xl">
            How it works
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-slate-700 bg-slate-900/50 p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#2563EB] text-sm font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* What DAP2 does */}
        <section className="mb-20">
          <h2 className="mb-10 text-center text-3xl font-bold text-white md:text-4xl">
            What Denial Appeal Pro does
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {WHAT_DAP_DOES.map((item) => (
              <div
                key={item.title}
                className="flex gap-4 rounded-lg border border-slate-700 bg-slate-900/30 p-6"
              >
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#10B981]">
                  <span className="text-xs font-bold text-white">✓</span>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-white">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Who it's for */}
        <section className="mb-20 rounded-xl border border-slate-700 bg-slate-900/50 p-10">
          <h2 className="mb-8 text-center text-3xl font-bold text-white md:text-4xl">
            Who it&apos;s for
          </h2>
          <ul className="mx-auto grid max-w-xl gap-4 sm:grid-cols-2">
            {WHO_ITS_FOR.map((audience) => (
              <li
                key={audience}
                className="flex items-center gap-3 text-slate-200"
              >
                <span className="text-[#60A5FA]" aria-hidden>
                  •
                </span>
                <span className="text-base">{audience}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Pricing CTA */}
        <section className="mb-20 rounded-xl border border-[#2563EB]/40 bg-gradient-to-b from-slate-900 to-slate-950 p-10 text-center">
          <h2 className="mb-4 text-2xl font-bold text-white md:text-3xl">
            Start with a free preview. Pay only when you generate.
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-slate-400">
            Walk through extraction and review at no cost. Unlock letter
            generation and exports when you&apos;re ready.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-lg bg-[#f0a050] px-8 py-4 text-base font-semibold text-white transition hover:opacity-95"
          >
            See Pricing
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-800/50 bg-[#0F172A]/95">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <p>
            © {new Date().getFullYear()} Denial Appeal Pro. All rights
            reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/pricing" className="transition hover:text-slate-300">
              Pricing
            </Link>
            <Link
              href="/admin/login"
              className="opacity-50 transition hover:text-slate-300 hover:opacity-100"
            >
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
