"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type Phase = "checking" | "form" | "success" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const hasRecoveryHash = () => {
      if (typeof window === "undefined") return false;
      const p = new URLSearchParams(
        (window.location.hash || "").replace(/^#/, "")
      );
      return p.get("type") === "recovery";
    };

    const tryShowFormFromSession = () => {
      if (!hasRecoveryHash()) return;
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setPhase("form");
        }
      });
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPhase("form");
        return;
      }
      if (event === "INITIAL_SESSION" && hasRecoveryHash()) {
        void supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            setPhase("form");
          }
        });
      }
    });

    tryShowFormFromSession();
    const t1 = window.setTimeout(tryShowFormFromSession, 100);
    const t2 = window.setTimeout(tryShowFormFromSession, 500);
    const tInvalid = window.setTimeout(() => {
      const recovery = hasRecoveryHash();
      void supabase.auth.getSession().then(({ data: { session } }) => {
        setPhase((p) => {
          if (p !== "checking") {
            return p;
          }
          if (session && recovery) {
            return "form";
          }
          return "invalid";
        });
      });
    }, 5000);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(tInvalid);
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: upErr } = await supabase.auth.updateUser({
        password,
      });
      if (upErr) {
        setError(upErr.message);
        setIsSubmitting(false);
        return;
      }
      await supabase.auth.signOut();
      setPhase("success");
      window.setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-3 py-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1e3a8a] shadow-lg shadow-[#1e3a8a]/30">
              <span className="text-sm font-black text-white">ER</span>
            </div>
            <span className="truncate text-sm font-semibold text-slate-50">
              Denial Appeal Pro
            </span>
          </Link>
          <Link
            href="/login"
            className="shrink-0 text-xs font-semibold text-blue-300 hover:underline hover:underline-offset-4"
          >
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-3 py-10 sm:px-6">
        {phase === "checking" && (
          <p className="text-sm text-slate-400">Preparing your reset link…</p>
        )}

        {phase === "invalid" && (
          <div className="space-y-4 text-center">
            <h1 className="text-lg font-semibold text-slate-50">
              Link invalid or expired
            </h1>
            <p className="text-sm text-slate-400">
              Open the reset link from your email, or request a new password
              from the sign-in page.
            </p>
            <Link
              href="/login"
              className="inline-block rounded-full bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#1e3a8a]/40 transition hover:bg-[#1e40af]"
            >
              Back to log in
            </Link>
          </div>
        )}

        {phase === "form" && (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300">
              Reset password
            </p>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-50">
              Choose a new password
            </h1>
            <p className="mt-2 text-xs text-slate-300">
              Enter it twice to confirm, then you can sign in with the new
              password.
            </p>
            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg shadow-slate-950/60"
            >
              <div className="space-y-1 text-sm">
                <label
                  htmlFor="reset-new-password"
                  className="text-xs font-medium text-slate-200"
                >
                  New password
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-50 outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]"
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-1 text-sm">
                <label
                  htmlFor="reset-confirm-password"
                  className="text-xs font-medium text-slate-200"
                >
                  Confirm password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-50 outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]"
                  placeholder="Re-enter new password"
                />
              </div>
              {error && (
                <p className="text-xs text-rose-300" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center rounded-full bg-[#1e3a8a] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1e3a8a]/40 transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}

        {phase === "success" && (
          <div className="text-center">
            <p className="text-sm font-medium text-emerald-300">
              Password updated successfully
            </p>
            <p className="mt-2 text-xs text-slate-400">Redirecting to sign in…</p>
          </div>
        )}
      </main>

    </div>
  );
}
