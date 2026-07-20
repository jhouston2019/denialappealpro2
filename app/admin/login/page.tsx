import Link from "next/link";
import { Suspense } from "react";
import { AdminLoginForm } from "@/components/auth/AdminLoginForm";
import { redirectToAdminIfAlreadyAdmin } from "@/lib/auth/assertAdminServer";

export default async function AdminLoginPage() {
  await redirectToAdminIfAlreadyAdmin();
  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e3a8a] shadow-lg shadow-[#1e3a8a]/30">
              <span className="text-sm font-black text-white">ER</span>
            </div>
            <span className="text-sm font-semibold text-slate-50">
              Denial Appeal Pro
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300">
            Log in
          </p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-50">
            Admin Access
          </h1>
          <p className="mt-2 text-xs text-slate-300">
            Sign in with an administrator account.
          </p>
        </div>

        <Suspense fallback={null}>
          <AdminLoginForm />
        </Suspense>
      </main>
    </div>
  );
}
