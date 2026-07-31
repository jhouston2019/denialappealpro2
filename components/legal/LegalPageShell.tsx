import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

type LegalPageShellProps = {
  title: string;
  children: React.ReactNode;
};

export function LegalPageShell({ title, children }: LegalPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0F172A]">
      <header className="border-b border-slate-800/50 bg-[#0F172A]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandLogo size="md" />
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link
              href="/pricing"
              className="text-slate-200 transition hover:text-white"
            >
              Pricing
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <article className="rounded-xl border border-slate-200 bg-white px-8 py-10 text-slate-800 shadow-lg">
          <h1 className="mb-8 text-3xl font-bold tracking-tight text-[#0F172A]">
            {title}
          </h1>
          <div className="prose prose-slate max-w-none prose-headings:text-[#0F172A] prose-a:text-[#2563EB]">
            {children}
          </div>
        </article>
      </main>
    </div>
  );
}
