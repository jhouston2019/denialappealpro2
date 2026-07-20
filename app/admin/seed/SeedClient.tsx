'use client';

import Link from 'next/link';

/**
 * Database seeding is done via Supabase SQL migrations only (no public API).
 * See README.md → "Database seeding and migrations".
 */
export default function SeedPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 p-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">
          ← Back to Home
        </Link>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
          <h1 className="text-2xl font-bold text-slate-50">Database Seeding</h1>
          <p className="mt-2 text-sm text-slate-400">
            Seeding is not available over the web. Run migrations and seed SQL in the Supabase
            dashboard (or Supabase CLI) for your environment.
          </p>

          <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900/30 p-4">
            <p className="text-xs font-semibold text-slate-300">Steps</p>
            <ol className="mt-2 space-y-2 text-xs text-slate-400">
              <li>
                1. Open your project → <strong className="text-slate-300">SQL Editor</strong> → New
                query.
              </li>
              <li>
                2. Run files from <code className="text-blue-300">supabase/migrations/</code> in
                order (e.g. <code className="text-blue-300">00_create_users_table.sql</code>, then{' '}
                <code className="text-blue-300">20260210_pricing_schema.sql</code>, then{' '}
                <code className="text-blue-300">01_seed_example_reports.sql</code>).
              </li>
              <li>3. See root <code className="text-blue-300">README.md</code> for the full note.</li>
            </ol>
          </div>

          <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900/30 p-4">
            <p className="text-xs font-semibold text-slate-300">What migrations set up</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              <li>• Tables such as users, teams, reports, usage_tracking (per migration)</li>
              <li>• Example reports when <code className="text-blue-300">01_seed_example_reports.sql</code> is applied</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
