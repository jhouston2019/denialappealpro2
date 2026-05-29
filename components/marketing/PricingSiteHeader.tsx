import Link from "next/link";

type Props = {
  userEmail: string | null;
};

export function PricingSiteHeader({ userEmail }: Props) {
  const isLoggedIn = Boolean(userEmail);

  return (
    <header className="border-b border-slate-800/50 bg-[#0F172A]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href={isLoggedIn ? "/dashboard" : "/"} className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB]">
            <span className="text-sm font-black text-white">ER</span>
          </div>
          <span className="text-sm font-semibold text-white">
            Estimate Review Pro
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium sm:gap-6">
          <Link href="/pricing" className="text-white">
            Pricing
          </Link>
          {isLoggedIn ? (
            <>
              <Link
                href="/dashboard"
                className="text-slate-200 transition hover:text-white"
              >
                Dashboard
              </Link>
              <Link
                href="/account"
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                Account
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
