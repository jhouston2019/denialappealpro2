"use client";

import { useCallback, useState } from "react";
import type { FactLedger } from "@/lib/appeal/ledger/types";
import { netlifyFunctionUrl } from "@/lib/netlify-function-url";
import { wizardFetch } from "@/lib/supabaseClient";

type Props = {
  reviewId: string;
  letterText: string;
  ledger?: FactLedger | null;
  className?: string;
};

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function AppealLetterPdfButton({
  reviewId,
  letterText,
  ledger,
  className,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDownload = useCallback(async () => {
    if (!letterText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const fileName = `appeal-letter-${reviewId}.pdf`;
      const res = await wizardFetch(netlifyFunctionUrl("generate-pdf"), {
        method: "POST",
        body: JSON.stringify({
          text: letterText,
          fileName,
          ledger: ledger || undefined,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        if (ct.includes("application/json")) {
          const j = (await res.json().catch(() => null)) as {
            error?: string;
            details?: string;
          } | null;
          throw new Error(
            j?.error || j?.details || `Download failed (HTTP ${res.status}).`
          );
        }
        throw new Error(`Download failed (HTTP ${res.status}).`);
      }
      if (ct.includes("application/json")) {
        throw new Error("PDF request returned JSON instead of a PDF.");
      }
      const blob = await res.blob();
      triggerBlobDownload(blob, fileName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }, [ledger, letterText, reviewId]);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void onDownload()}
        disabled={busy}
        className={
          className ??
          "inline-flex items-center rounded-full border border-slate-700 px-3 py-1 font-semibold hover:border-slate-500 hover:text-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {busy ? "Preparing…" : "Download PDF"}
      </button>
      {error ? (
        <span className="max-w-[12rem] text-[10px] text-amber-300" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
