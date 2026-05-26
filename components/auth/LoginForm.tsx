"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleForgotPassword() {
    setError(null);
    setResetMessage(null);
    const addr = email.trim();
    if (!addr) {
      setError("Enter your email address above, then try again.");
      return;
    }
    setResetLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      // Must match Supabase Auth → URL Configuration → Redirect allow list:
      // https://estimatereviewpro.com/auth/reset-password
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        addr,
        { redirectTo: "https://estimatereviewpro.com/auth/reset-password" }
      );
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setResetMessage(
        "If an account exists for that address, you’ll get an email with a link to reset your password shortly. Check your inbox and spam folder."
      );
    } catch (err) {
      console.error(err);
      setError("Could not start password reset. Please try again.");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResetMessage(null);
    setIsLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setIsLoading(false);
        return;
      }

      let redirectTo =
        searchParams?.get("redirectedFrom") ||
        searchParams?.get("redirect") ||
        "/app";
      if (
        !redirectTo.startsWith("/") ||
        redirectTo.startsWith("//") ||
        redirectTo.includes("://")
      ) {
        redirectTo = "/app";
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Unable to log in. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg shadow-slate-950/60"
    >
      <div className="space-y-1 text-sm">
        <label
          htmlFor="email"
          className="text-xs font-medium text-slate-200"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-50 outline-none ring-0 placeholder:text-slate-500 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]"
          placeholder="you@firm.com"
        />
      </div>

      <div className="space-y-1 text-sm">
        <label
          htmlFor="password"
          className="text-xs font-medium text-slate-200"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-50 outline-none ring-0 placeholder:text-slate-500 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]"
          placeholder="••••••••"
        />
      </div>

      <p className="text-right text-xs">
        <button
          type="button"
          onClick={() => void handleForgotPassword()}
          disabled={resetLoading || isLoading}
          className="font-medium text-blue-300 underline-offset-2 transition hover:text-blue-200 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resetLoading ? "Sending…" : "Forgot password?"}
        </button>
      </p>

      {error && (
        <p className="text-xs text-rose-300" role="alert">
          {error}
        </p>
      )}

      {resetMessage && (
        <p className="text-xs text-emerald-200/90" role="status">
          {resetMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="flex w-full items-center justify-center rounded-full bg-[#1e3a8a] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1e3a8a]/40 transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? "Signing in…" : "Log in"}
      </button>
    </form>
  );
}


