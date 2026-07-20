import Link from "next/link";
import { redirect } from "next/navigation";
import { PostPaymentSessionRefresh } from "@/components/billing/PostPaymentSessionRefresh";
import { CreateAccountForm } from "./CreateAccountForm";
import { resolveCheckoutEmailForCreateAccount } from "./stripeSession";

function sessionIdFromSearchParams(sp: {
  session_id?: string | string[];
}): string | null {
  const raw = sp.session_id;
  if (Array.isArray(raw)) {
    const first = raw[0]?.trim();
    return first && first.length > 0 ? first : null;
  }
  const s = raw?.trim();
  return s && s.length > 0 ? s : null;
}

export default async function CreateAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  // Intentionally no auth/session gate: post-payment account creation must stay public
  // (do not requireSessionUser or redirect logged-in users).

  const sp = await searchParams;
  const sessionId = sessionIdFromSearchParams(sp);
  if (!sessionId) {
    redirect("/pricing");
  }

  const email = await resolveCheckoutEmailForCreateAccount(sessionId);
  if (!email) {
    redirect("/pricing");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0F172A]">
      <PostPaymentSessionRefresh />
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
              className="text-slate-300 transition hover:text-white"
            >
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

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/60 p-8 shadow-xl shadow-black/40 backdrop-blur">
          <h1 className="text-center text-2xl font-bold tracking-tight text-white">
            Create your account
          </h1>
          <p className="mt-3 text-center text-sm text-slate-300">
            Your payment was successful. Set a password to access your reviews.
          </p>
          <CreateAccountForm sessionId={sessionId} email={email} />
          <p className="mt-3 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-slate-200 transition hover:text-white"
            >
              Log in
            </Link>
          </p>
        </div>
      </main>

      <footer className="border-t border-slate-800/50 bg-[#0F172A]/95">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Denial Appeal Pro. All rights reserved.</p>
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
