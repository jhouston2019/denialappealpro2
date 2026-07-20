import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/serverPageGuards";
import { loadAdminDashboardData } from "@/lib/admin/adminData";
import { AccountSignOutButton } from "@/app/account/AccountSignOutButton";

export default async function AdminPage() {
  await requireAdminUser();

  const data = await loadAdminDashboardData();

  const quickAccess: { name: string; href: string }[] = [
    { name: "Landing page", href: "/" },
    { name: "Pricing", href: "/pricing" },
    { name: "Login", href: "/login?admin=1" },
    { name: "Sign Up / Register", href: "/register?admin=1" },
    { name: "Dashboard", href: "/dashboard" },
    { name: "Upload / Wizard", href: "/upload" },
    { name: "Account", href: "/account" },
    { name: "Admin Login", href: "/admin/login" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1e3a8a] shadow-lg shadow-[#1e3a8a]/30">
              <span className="text-xs font-black text-white">ER</span>
            </div>
            <span className="text-sm font-semibold text-slate-50">
              Denial Appeal Pro
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-[#1e3a8a] hover:text-white"
            >
              View as user →
            </Link>
            <AccountSignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 text-slate-200">
        <h1 className="text-xl font-semibold text-slate-50">Admin</h1>
        {data.error ? (
          <p className="mt-4 text-sm text-rose-300" role="alert">
            {data.error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-[11px] font-medium text-slate-500">Total users</p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">
              {data.totalUsers}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-[11px] font-medium text-slate-500">
              Total reviews
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">
              {data.totalReviews}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-[11px] font-medium text-slate-500">
              Active subscriptions
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">
              {data.activeSubscriptions}
            </p>
          </div>
        </div>

        <h2 className="mt-10 text-sm font-semibold text-slate-100">Quick Access</h2>
        <p className="mt-1 text-xs text-slate-500">
          Each link opens in a new tab. Use &quot;View as user →&quot; in the header to open the
          dashboard in another tab.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickAccess.map((item) => (
            <a
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-2xl border border-slate-800 bg-slate-900/50 p-4 transition hover:border-slate-600 hover:bg-slate-900/80"
            >
              <p className="text-sm font-medium text-slate-100">{item.name}</p>
              <p className="mt-1 break-all font-mono text-[11px] text-slate-500 group-hover:text-slate-400">
                {item.href}
              </p>
            </a>
          ))}
        </div>

        <h2 className="mt-10 text-xs font-semibold uppercase tracking-[0.15em] text-blue-300">
          All users
        </h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] text-slate-500">
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Billing</th>
                <th className="px-3 py-2 font-medium">Reviews used</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-slate-800/80 last:border-0"
                >
                  <td className="px-3 py-2 text-slate-200">{u.email}</td>
                  <td className="px-3 py-2 capitalize text-slate-300">
                    {u.planType ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {u.billingStatus}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {u.reviewsUsed ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {u.createdAt
                      ? new Date(u.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-xs font-semibold uppercase tracking-[0.15em] text-blue-300">
          All reviews
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Click a row to open the full review in a new tab (analysis, letter, and comparison).
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] text-slate-500">
                <th className="px-3 py-2 font-medium">Insured</th>
                <th className="px-3 py-2 font-medium">User email</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Claim #</th>
              </tr>
            </thead>
            <tbody>
              {data.reviews.map((r) => {
                const href = `/deliverables?reviewId=${r.id}`;
                return (
                  <tr
                    key={r.id}
                    className="group border-b border-slate-800/80 last:border-0"
                  >
                    <td colSpan={4} className="p-0">
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid min-w-[680px] grid-cols-4 items-center gap-3 border-l-2 border-l-transparent px-3 py-2.5 text-inherit no-underline transition hover:border-l-[#1e3a8a] hover:bg-slate-900/50"
                        aria-label={`Open review: ${r.insuredName ?? r.id}`}
                      >
                        <span className="text-slate-200">
                          {r.insuredName ?? "—"}
                        </span>
                        <span className="min-w-0 break-all text-slate-300">
                          {r.userEmail}
                        </span>
                        <span className="shrink-0 text-slate-400">
                          {new Date(r.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="min-w-0 break-all text-slate-300">
                          {r.claimNumber ?? "—"}
                        </span>
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
