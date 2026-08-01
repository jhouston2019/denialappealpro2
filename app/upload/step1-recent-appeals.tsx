"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatCarcList,
  formatRecentAppealDate,
  parseRecentAppealRow,
  type RecentAppealSummary,
} from "@/lib/recent-appeals";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";

type Step1RecentAppealsProps = {
  isAuthenticated: boolean;
  sessionReady: boolean;
  onPrefillProvider: (patch: Partial<DenialIntake>) => void;
  announce: (message: string) => void;
};

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: RecentAppealSummary["statusTone"];
}) {
  const styles = {
    ready: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
    warning: "border-[#fde68a] bg-[#fffbeb] text-[#b45309]",
    neutral: "border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[tone]}`}
    >
      {label}
    </span>
  );
}

function AppealActions({
  appeal,
  onPrefillProvider,
  announce,
  compact = false,
}: {
  appeal: RecentAppealSummary;
  onPrefillProvider: (patch: Partial<DenialIntake>) => void;
  announce: (message: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex ${compact ? "flex-col" : "flex-wrap"} gap-2`}>
      <Link
        href={`/deliverables?reviewId=${appeal.id}`}
        className="dap-btn-ghost-panel inline-flex items-center justify-center text-xs"
      >
        View
      </Link>
      <button
        type="button"
        className="dap-btn-ghost-panel text-left text-xs"
        onClick={() => {
          onPrefillProvider(appeal.providerPatch);
          announce(
            `Provider details loaded from ${appeal.patientName}'s prior appeal.`
          );
        }}
      >
        New appeal for same patient
      </button>
    </div>
  );
}

export function Step1RecentAppeals({
  isAuthenticated,
  sessionReady,
  onPrefillProvider,
  announce,
}: Step1RecentAppealsProps) {
  const [appeals, setAppeals] = useState<RecentAppealSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !sessionReady) {
      setAppeals([]);
      setLoaded(false);
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) {
          if (!cancelled) {
            setAppeals([]);
            setLoaded(true);
          }
          return;
        }

        const { data, error } = await supabase
          .from("reviews")
          .select("id, insured_name, created_at, ai_summary_json, letter_text")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (cancelled) return;
        if (error) {
          setAppeals([]);
          setLoaded(true);
          return;
        }

        setAppeals((data ?? []).map(parseRecentAppealRow));
        setLoaded(true);
      } catch {
        if (!cancelled) {
          setAppeals([]);
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, sessionReady]);

  if (!isAuthenticated || !loaded || appeals.length === 0) {
    return null;
  }

  return (
    <section
      className="mt-8 border-t border-[#e4e4e4] pt-6"
      aria-label="Recent appeals"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-[#1a2a3a]">Recent Appeals</h3>
        <Link
          href="/dashboard"
          className="text-xs font-semibold text-[#2563EB] hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
          <table className="min-w-[720px] w-full border-collapse text-left text-sm">
            <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-wide text-[#64748b]">
              <tr>
                <th className="px-3 py-2 font-semibold">Patient</th>
                <th className="px-3 py-2 font-semibold">Payer</th>
                <th className="px-3 py-2 font-semibold">CARC</th>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appeals.map((appeal) => (
                <tr key={appeal.id} className="border-t border-[#e2e8f0] align-top">
                  <td className="px-3 py-3 font-medium text-[#1a2a3a]">
                    {appeal.patientName}
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{appeal.payer}</td>
                  <td className="px-3 py-3 text-[#334155]">
                    {formatCarcList(appeal.carcCodes)}
                  </td>
                  <td className="px-3 py-3 text-[#334155]">
                    {formatRecentAppealDate(appeal.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge label={appeal.statusLabel} tone={appeal.statusTone} />
                  </td>
                  <td className="px-3 py-3">
                    <AppealActions
                      appeal={appeal}
                      onPrefillProvider={onPrefillProvider}
                      announce={announce}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dap-recent-appeals-strip md:hidden">
        <div className="flex gap-3 overflow-x-auto pb-1">
          {appeals.map((appeal) => (
            <article
              key={appeal.id}
              className="w-[min(100%,280px)] shrink-0 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1a2a3a]">
                    {appeal.patientName}
                  </p>
                  <p className="mt-1 truncate text-xs text-[#64748b]">
                    {appeal.payer}
                  </p>
                </div>
                <StatusBadge label={appeal.statusLabel} tone={appeal.statusTone} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#334155]">
                <div>
                  <dt className="text-[#94a3b8]">CARC</dt>
                  <dd className="font-medium">{formatCarcList(appeal.carcCodes)}</dd>
                </div>
                <div>
                  <dt className="text-[#94a3b8]">Date</dt>
                  <dd className="font-medium">
                    {formatRecentAppealDate(appeal.createdAt)}
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <AppealActions
                  appeal={appeal}
                  onPrefillProvider={onPrefillProvider}
                  announce={announce}
                  compact
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
