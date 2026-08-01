"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export function DeliverablesSiteHeader() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setIsAuthenticated(false);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(Boolean(data.session?.user?.id));
    });
  }, []);

  return (
    <header className="sticky top-0 z-[100] border-b border-[#1e3f6e] bg-[#091c33] text-white">
      <div className="mx-auto flex min-h-12 max-w-6xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6 sm:py-0">
        <BrandLogo size="sm" href="/" className="[&_span]:text-[#e8f0f8]" />
        <nav className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 text-[11px] font-medium sm:ml-auto sm:w-auto sm:gap-3 sm:text-sm">
          {isAuthenticated === null ? null : isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                className="shrink-0 rounded-full border border-[#1e3f6e] px-2.5 py-1.5 text-xs font-semibold text-[#e8f0f8] transition hover:border-[#8aacc8] sm:px-4 sm:py-2 sm:text-sm"
              >
                Dashboard
              </Link>
              <Link
                href="/account"
                className="shrink-0 text-[#8aacc8] transition hover:text-[#e8f0f8]"
              >
                Account
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/pricing"
                className="shrink-0 text-[#8aacc8] transition hover:text-[#e8f0f8]"
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="shrink-0 text-[#8aacc8] transition hover:text-[#e8f0f8]"
              >
                Log in
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
