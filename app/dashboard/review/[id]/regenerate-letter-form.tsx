"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { applyPlaceholdersToLetter } from "@/lib/estimate-letter-placeholders";
import { buildPlaceholderFieldsFromStoredJson } from "@/lib/letter-placeholder-extract";
import { netlifyFunctionUrl } from "@/lib/netlify-function-url";
import {
  createSupabaseBrowserClient,
  wizardFetch,
} from "@/lib/supabaseClient";

const STRATEGY_CODES = new Set<string>([
  "FULL_SUPPLEMENT_DEMAND",
  "PARTIAL_DISPUTE",
  "DEMAND_REINSPECTION",
  "INVOKE_APPRAISAL",
  "OTHER_CUSTOM",
]);

const LETTER_TYPE_OPTIONS: { label: string; value: string }[] = [
  { label: "Demand Letter", value: "SUPPLEMENT_DEMAND" },
  { label: "Appeal Letter", value: "APPEAL" },
  { label: "Dispute letter", value: "DISPUTE" },
  { label: "Supplemental Request", value: "REINSPECTION_REQUEST" },
  { label: "Custom Letter", value: "CUSTOM" },
];

const OPTION_VALUES = new Set(LETTER_TYPE_OPTIONS.map((o) => o.value));

const CUSTOM_PLACEHOLDER =
  "Describe the letter you need, include any specific points, responses to carrier, or additional context...";

type Props = {
  reviewId: string;
  /** Review `ai_analysis_json` (Netlify request body + optional claim-like keys for placeholders). */
  analysisJson: unknown;
  /** Optional extra / normalized keys for `applyPlaceholdersToLetter` (merged with `analysisJson` for placeholders). */
  analysisJsonForPlaceholders?: Record<string, unknown> | null;
  /** Optional `ai_summary_json` for claim fields nested under `property_details` or `claimMeta`. */
  summaryJsonForPlaceholders?: unknown;
  comparisonJson: unknown;
  strategy: string;
  claimType: string;
  initialLetterType: string | null;
  /** Review `insured_name` — used with analysis for token merge before save. */
  insuredName?: string | null;
  onLetterUpdated?: (newText: string, newType: string) => void;
};

function parseJsonIfString(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function mergeAnalysisForLetter(
  analysis: unknown,
  comparison: unknown
): Record<string, unknown> {
  const parsed = parseJsonIfString(analysis);
  const body =
    parsed !== null &&
    parsed !== undefined &&
    typeof parsed === "object" &&
    !Array.isArray(parsed)
      ? { ...(parsed as Record<string, unknown>) }
      : {};
  if (comparison != null) {
    body.estimateComparison = parseJsonIfString(comparison) ?? comparison;
  }
  return body;
}

export function RegenerateLetterForm({
  reviewId,
  analysisJson,
  analysisJsonForPlaceholders,
  summaryJsonForPlaceholders,
  comparisonJson,
  strategy,
  claimType,
  initialLetterType,
  insuredName,
  onLetterUpdated,
}: Props) {
  const validInitial = useMemo(() => {
    if (initialLetterType && OPTION_VALUES.has(initialLetterType)) {
      return initialLetterType;
    }
    return LETTER_TYPE_OPTIONS[0].value;
  }, [initialLetterType]);

  const [letterType, setLetterType] = useState<string>(validInitial);
  const [customInstructions, setCustomInstructions] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLetterType && OPTION_VALUES.has(initialLetterType)) {
      setLetterType(initialLetterType);
    }
  }, [initialLetterType]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsedAnalysis = parseJsonIfString(analysisJson);
    if (
      parsedAnalysis === null ||
      parsedAnalysis === undefined ||
      (typeof parsedAnalysis !== "object" && typeof parsedAnalysis !== "string")
    ) {
      setError("This review has no saved analysis to generate a letter from.");
      return;
    }
    setLoading(true);
    try {
      const strat = STRATEGY_CODES.has(strategy)
        ? strategy
        : "FULL_SUPPLEMENT_DEMAND";
      const analysisPayload = mergeAnalysisForLetter(
        parsedAnalysis,
        comparisonJson
      );
      const analysisRecord =
        typeof parsedAnalysis === "object" &&
        parsedAnalysis !== null &&
        !Array.isArray(parsedAnalysis)
          ? (parsedAnalysis as Record<string, unknown>)
          : null;
      const claimMetaInAnalysis =
        analysisRecord?.claimMeta &&
        typeof analysisRecord.claimMeta === "object" &&
        !Array.isArray(analysisRecord.claimMeta)
          ? (analysisRecord.claimMeta as Record<string, unknown>)
          : null;
      let letterState = String(claimMetaInAnalysis?.state ?? "").trim();
      if (!letterState && summaryJsonForPlaceholders != null) {
        const summaryParsed = parseJsonIfString(summaryJsonForPlaceholders);
        if (
          summaryParsed !== null &&
          typeof summaryParsed === "object" &&
          !Array.isArray(summaryParsed)
        ) {
          const summaryCm = (summaryParsed as Record<string, unknown>)
            .claimMeta;
          if (
            summaryCm &&
            typeof summaryCm === "object" &&
            !Array.isArray(summaryCm)
          ) {
            letterState = String(
              (summaryCm as Record<string, unknown>).state ?? ""
            ).trim();
          }
        }
      }
      const body: Record<string, unknown> = {
        analysis: analysisPayload,
        strategy: strat,
        claimType: claimType || "",
        letterType,
        tone: "FORMAL_PROFESSIONAL",
        state: letterState || "",
      };
      if (letterType === "CUSTOM") {
        body.customInstructions = customInstructions;
      }
      if (additionalNotes.trim()) {
        body.additionalNotes = additionalNotes.trim();
      }
      const res = await wizardFetch(
        netlifyFunctionUrl("generate-estimate-letter"),
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      const contentType = res.headers.get("content-type") ?? "";
      const rawBody = await res.text().catch((e) => `[read error: ${e}]`);

      console.log("[generate-estimate-letter] full response (before app logic):", {
        url: res.url,
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        contentType,
        bodyLength: rawBody.length,
        body: rawBody,
      });

      if (!res.ok) {
        setError(
          `Netlify / letter service failed (HTTP ${res.status} ${res.statusText}).\n\n${rawBody || "(empty body)"}`
        );
        return;
      }

      const ct = contentType.toLowerCase();
      if (ct.includes("application/json")) {
        setError(
          `Letter service returned JSON instead of plain text (usually an error payload).\n\n${rawBody}`
        );
        return;
      }

      const text = rawBody;
      if (!text.trim()) {
        setError(
          "The letter response was empty. Check the console for the logged response body."
        );
        return;
      }

      const g = text.trim();
      const analysisForPlaceholders =
        typeof parsedAnalysis === "object" &&
        parsedAnalysis !== null &&
        !Array.isArray(parsedAnalysis)
          ? ({
              ...(parsedAnalysis as Record<string, unknown>),
              ...(analysisJsonForPlaceholders ?? {}),
            } as Record<string, unknown>)
          : analysisJsonForPlaceholders ?? undefined;
      const fields = buildPlaceholderFieldsFromStoredJson(
        insuredName,
        analysisForPlaceholders,
        summaryJsonForPlaceholders
      );
      const mergedText = applyPlaceholdersToLetter(g, fields);
      console.log("[regenerate-letter] placeholder merge", {
        rawLength: g.length,
        mergedLength: mergedText.length,
        fieldsPreview: {
          insured: fields.insured ? `${fields.insured.slice(0, 20)}…` : "(empty)",
          policy: fields.policy ? "set" : "(empty)",
        },
      });

      const supabase = createSupabaseBrowserClient();
      const { data: updateRows, error: upErr } = await supabase
        .from("reviews")
        .update({ letter_text: mergedText, letter_type: letterType })
        .eq("id", reviewId)
        .select("id");

      console.log("[regenerate-letter] Supabase update result:", {
        updateRows,
        error: upErr,
      });

      if (upErr) {
        const errInfo = {
          message: upErr.message,
          code: (upErr as { code?: string }).code,
          details: (upErr as { details?: string }).details,
          hint: (upErr as { hint?: string }).hint,
        };
        setError(
          `Saving the letter to the database failed.\n\n${upErr.message}${errInfo.code ? `\nCode: ${errInfo.code}` : ""}${errInfo.details ? `\nDetails: ${errInfo.details}` : ""}${errInfo.hint ? `\nHint: ${errInfo.hint}` : ""}\n\nRaw: ${JSON.stringify(errInfo)}`
        );
        return;
      }

      if (!updateRows?.length) {
        setError(
          "The letter was generated but the database update did not change any row (0 rows). Check Row Level Security, that this review id exists, and that you are allowed to update it."
        );
        return;
      }

      const m = letterType.trim();
      if (!mergedText.trim()) {
        setError(
          "After placeholder merge, letter text was empty. Check console logs."
        );
        return;
      }
      if (!m) {
        setError("After save, letter type was empty. Check console logs.");
        return;
      }
      console.log(
        "[regenerate-letter] calling onLetterUpdated with mergedText (length, preview), m:",
        mergedText.length,
        mergedText.slice(0, 200),
        m
      );
      onLetterUpdated?.(mergedText, m);
      // Intentionally no router.refresh() here — a refresh can re-render the page
      // with stale RSC props and useEffects that reset letter state from the server.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1">
          <label
            htmlFor="erp-regenerate-letter-type"
            className="text-[11px] font-medium text-slate-500"
          >
            Letter type
          </label>
          <select
            id="erp-regenerate-letter-type"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            value={letterType}
            onChange={(e) => setLetterType(e.target.value)}
            disabled={loading}
          >
            {LETTER_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:self-end">
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Generating..." : "Generate New Letter"}
          </button>
          {error ? (
            <div
              className="max-h-48 w-full min-w-[min(100%,20rem)] overflow-y-auto rounded-lg border border-red-500/50 bg-red-950/50 px-3 py-2 text-left text-xs leading-snug text-red-100"
              role="alert"
            >
              <p className="font-semibold text-red-200">Error</p>
              <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-red-100/95">
                {error}
              </pre>
            </div>
          ) : null}
        </div>
      </div>

      {letterType === "CUSTOM" ? (
        <div>
          <label
            htmlFor="erp-regenerate-custom-instructions"
            className="text-[11px] font-medium text-slate-500"
          >
            Custom letter instructions
          </label>
          <textarea
            id="erp-regenerate-custom-instructions"
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder={CUSTOM_PLACEHOLDER}
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            disabled={loading}
          />
        </div>
      ) : null}

      <div>
        <label
          htmlFor="erp-regenerate-additional-notes"
          className="text-[11px] font-medium text-slate-500"
        >
          Additional notes or context (optional)
        </label>
        <textarea
          id="erp-regenerate-additional-notes"
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Optional context for any letter type — carrier responses, dates, or themes to stress."
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          disabled={loading}
        />
      </div>
    </form>
  );
}
