"use client";

import { useCallback, useEffect } from "react";
import { LockIcon } from "@/components/LockIcon";
import { PreviewPaywallBlock } from "@/components/PreviewPaywallBlock";
import {
  PREVIEW_BLUR_CLASS,
  splitPreviewLines,
} from "@/lib/preview-blur";
import { netlifyFunctionUrl } from "@/lib/netlify-function-url";
import { wizardFetch } from "@/lib/supabaseClient";

export type LetterPlaceholderFields = {
  insured: string;
  policy: string;
  claim: string;
  dol: string;
  adjuster: string;
  carrier: string;
  amount: string;
  deadline: string;
};

export function emptyLetterPlaceholders(): LetterPlaceholderFields {
  return {
    insured: "",
    policy: "",
    claim: "",
    dol: "",
    adjuster: "",
    carrier: "",
    amount: "",
    deadline: "",
  };
}

export type ClaimMetaSlice = {
  insuredName: string;
  carrierName?: string;
  policyNumber: string;
  claimNumber: string;
  dateOfLoss: string;
  adjusterName: string;
  responseDeadline: string;
};

export function letterPlaceholdersFromClaimMeta(
  meta: ClaimMetaSlice
): LetterPlaceholderFields {
  return {
    insured: meta.insuredName ?? "",
    policy: meta.policyNumber ?? "",
    claim: meta.claimNumber ?? "",
    dol: meta.dateOfLoss ?? "",
    adjuster: meta.adjusterName ?? "",
    carrier: meta.carrierName?.trim() ?? "",
    amount: "",
    deadline: meta.responseDeadline ?? "",
  };
}

const PLACEHOLDER_REPLACEMENTS: [string, keyof LetterPlaceholderFields][] = [
  ["[INSURED NAME]", "insured"],
  ["[POLICY NUMBER]", "policy"],
  ["[CLAIM NUMBER]", "claim"],
  ["[DATE OF LOSS]", "dol"],
  ["[ADJUSTER NAME]", "adjuster"],
  ["[CARRIER NAME]", "carrier"],
  ["[DISPUTED AMOUNT]", "amount"],
  ["[RESPONSE DEADLINE]", "deadline"],
];

export function applyPlaceholdersToLetter(
  text: string,
  fields: LetterPlaceholderFields
): string {
  let out = text;
  for (const [token, key] of PLACEHOLDER_REPLACEMENTS) {
    const v = fields[key] ?? "";
    out = out.split(token).join(v);
  }
  return out;
}

const LETTER_TYPE_OPTIONS = [
  {
    id: "erp-step6-type-supplement",
    label: "Supplement Demand Letter",
    value: "SUPPLEMENT_DEMAND",
  },
  { id: "erp-step6-type-dispute", label: "Dispute Letter", value: "DISPUTE" },
  {
    id: "erp-step6-type-reinspection",
    label: "Re-Inspection Request",
    value: "REINSPECTION_REQUEST",
  },
  {
    id: "erp-step6-type-appraisal",
    label: "Appraisal Invocation",
    value: "APPRAISAL_INVOCATION",
  },
  {
    id: "erp-step6-type-custom",
    label: "Custom / Narrative",
    value: "CUSTOM_NARRATIVE",
  },
] as const;

function syncExportSource(text: string) {
  const el = document.getElementById("erp-step6-letter-export-source");
  if (el) el.textContent = text;
}

type WizardApiFetch = typeof wizardFetch;

type Props = {
  active: boolean;
  letterType: string | null;
  onLetterTypeChange: (code: string) => void;
  letterRaw: string | null;
  onLetterChange: (text: string) => void;
  letterPlaceholders: LetterPlaceholderFields;
  onLetterPlaceholdersChange: (patch: Partial<LetterPlaceholderFields>) => void;
  showLetterEditor: boolean;
  generateLoading: boolean;
  onGenerate: () => void | Promise<void>;
  onBack: () => void;
  onStartOver: () => void;
  announce: (message: string) => void;
  isPreviewMode?: boolean;
  wizardApiFetch?: WizardApiFetch;
  onPreviewUnlock?: () => void;
  previewUnlockBusy?: boolean;
};

export function Step6LetterPanel({
  active,
  letterType,
  onLetterTypeChange,
  letterRaw,
  onLetterChange,
  letterPlaceholders,
  onLetterPlaceholdersChange,
  showLetterEditor,
  generateLoading,
  onGenerate,
  onBack,
  onStartOver,
  announce,
  isPreviewMode = false,
  wizardApiFetch,
  onPreviewUnlock,
  previewUnlockBusy = false,
}: Props) {
  const fetcher = wizardApiFetch ?? wizardFetch;
  useEffect(() => {
    if (!active || !showLetterEditor) return;
    syncExportSource(letterRaw ?? "");
  }, [letterRaw, active, showLetterEditor]);

  const onEditorChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      onLetterChange(v);
      syncExportSource(v);
    },
    [onLetterChange]
  );

  const applyPlaceholders = useCallback(() => {
    const text = applyPlaceholdersToLetter(letterRaw ?? "", letterPlaceholders);
    onLetterChange(text);
    syncExportSource(text);
    announce("Placeholders applied to letter text.");
  }, [letterRaw, letterPlaceholders, onLetterChange, announce]);

  const copyLetter = useCallback(async () => {
    const ta = document.getElementById(
      "erp-step6-letter-editor"
    ) as HTMLTextAreaElement | null;
    const v = ta?.value ?? "";
    try {
      await navigator.clipboard.writeText(v);
      announce("Letter copied to clipboard.");
    } catch {
      announce("Copy failed. Select the letter and copy manually.");
    }
  }, [announce]);

  const downloadPdf = useCallback(async () => {
    const root = document.getElementById("erp-step6-letter-export-source");
    if (!root) {
      announce("Export source missing.");
      return;
    }
    const text = root.innerText;
    const res = await fetcher(netlifyFunctionUrl("generate-pdf"), {
      method: "POST",
      body: JSON.stringify({ text, fileName: "estimate-letter.pdf" }),
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || ct.includes("application/json")) {
      await res.text().catch(() => "");
      announce("PDF download failed. Please try again.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estimate-letter.pdf";
    a.click();
    URL.revokeObjectURL(url);
    announce("PDF downloaded.");
  }, [announce, fetcher]);

  const downloadWord = useCallback(async () => {
    const root = document.getElementById("erp-step6-letter-export-source");
    if (!root) {
      announce("Export source missing.");
      return;
    }
    const text = root.innerText;
    const res = await fetcher(netlifyFunctionUrl("generate-docx"), {
      method: "POST",
      body: JSON.stringify({ text, fileName: "estimate-letter.docx" }),
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || ct.includes("application/json")) {
      await res.text().catch(() => "");
      announce("Word download failed. Please try again.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estimate-letter.docx";
    a.click();
    URL.revokeObjectURL(url);
    announce("Word document downloaded.");
  }, [announce, fetcher]);

  const patchField = (key: keyof LetterPlaceholderFields, value: string) => {
    onLetterPlaceholdersChange({ [key]: value });
  };

  const f = letterPlaceholders;

  return (
    <div className="text-[#2a3a4a]">
      <h2
        id="erp-step6-heading"
        className="text-2xl font-bold text-[#1a2a3a]"
      >
        Step 6 — Letter
      </h2>

      <p className="mt-2 text-sm text-[#7a8a9a]">
        Letter type (required). Tone is fixed to formal / professional for all
        letters.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {LETTER_TYPE_OPTIONS.map((opt) => {
          const selected = letterType === opt.value;
          return (
            <div
              key={opt.id}
              id={opt.id}
              role="button"
              tabIndex={0}
              onClick={() => onLetterTypeChange(opt.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onLetterTypeChange(opt.value);
                }
              }}
              className={`cursor-pointer rounded-[10px] p-4 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f0a050] ${
                selected
                  ? "border-2 border-[#f0a050] bg-[#fffaf4] text-[#1a2a3a]"
                  : "border-[0.5px] border-[#e0e0dc] bg-white text-[#1a2a3a] hover:border-[#c8d4e0]"
              }`}
            >
              {opt.label}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Select a type and generate again to create a different letter.
      </p>

      <div className="mt-4">
        <button
          id="erp-step6-generate"
          type="button"
          disabled={!letterType || generateLoading}
          className="erp-btn-cta disabled:cursor-not-allowed"
          onClick={() => void onGenerate()}
        >
          {generateLoading ? "Generating…" : "Generate"}
        </button>
      </div>

      {showLetterEditor && (
        <div className="mt-10 space-y-6 border-t-[0.5px] border-[#1e3f6e] pt-8">
          <div className="space-y-6 rounded-[10px] border-[0.5px] border-[#e0e0dc] bg-white p-4 md:p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="erp-step6-ph-insured-name"
                className="mb-1 block text-xs font-medium text-[#7a8a9a]"
              >
                Insured name
              </label>
              <input
                id="erp-step6-ph-insured-name"
                type="text"
                autoComplete="off"
                className="w-full rounded-md border-[0.5px] border-[#e0e0dc] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                value={f.insured}
                onChange={(e) => patchField("insured", e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="erp-step6-ph-policy-number"
                className="mb-1 block text-xs font-medium text-[#7a8a9a]"
              >
                Policy number
              </label>
              <input
                id="erp-step6-ph-policy-number"
                type="text"
                autoComplete="off"
                className="w-full rounded-md border-[0.5px] border-[#e0e0dc] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                value={f.policy}
                onChange={(e) => patchField("policy", e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="erp-step6-ph-claim-number"
                className="mb-1 block text-xs font-medium text-[#7a8a9a]"
              >
                Claim number
              </label>
              <input
                id="erp-step6-ph-claim-number"
                type="text"
                autoComplete="off"
                className="w-full rounded-md border-[0.5px] border-[#e0e0dc] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                value={f.claim}
                onChange={(e) => patchField("claim", e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="erp-step6-ph-date-of-loss"
                className="mb-1 block text-xs font-medium text-[#7a8a9a]"
              >
                Date of loss
              </label>
              <input
                id="erp-step6-ph-date-of-loss"
                type="date"
                className="w-full rounded-md border-[0.5px] border-[#e0e0dc] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                value={f.dol}
                onChange={(e) => patchField("dol", e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="erp-step6-ph-adjuster-name"
                className="mb-1 block text-xs font-medium text-[#7a8a9a]"
              >
                Adjuster name
              </label>
              <input
                id="erp-step6-ph-adjuster-name"
                type="text"
                autoComplete="off"
                className="w-full rounded-md border-[0.5px] border-[#e0e0dc] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                value={f.adjuster}
                onChange={(e) => patchField("adjuster", e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="erp-step6-ph-carrier-name"
                className="mb-1 block text-xs font-medium text-[#7a8a9a]"
              >
                Carrier name
              </label>
              <input
                id="erp-step6-ph-carrier-name"
                type="text"
                autoComplete="off"
                className="w-full rounded-md border-[0.5px] border-[#e0e0dc] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                value={f.carrier}
                onChange={(e) => patchField("carrier", e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="erp-step6-ph-disputed-amount"
                className="mb-1 block text-xs font-medium text-[#7a8a9a]"
              >
                Disputed amount
              </label>
              <input
                id="erp-step6-ph-disputed-amount"
                type="text"
                autoComplete="off"
                className="w-full rounded-md border-[0.5px] border-[#e0e0dc] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                value={f.amount}
                onChange={(e) => patchField("amount", e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="erp-step6-ph-response-deadline"
                className="mb-1 block text-xs font-medium text-[#7a8a9a]"
              >
                Response deadline
              </label>
              <input
                id="erp-step6-ph-response-deadline"
                type="date"
                className="w-full rounded-md border-[0.5px] border-[#e0e0dc] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                value={f.deadline}
                onChange={(e) => patchField("deadline", e.target.value)}
              />
            </div>
          </div>

          <button
            id="erp-step6-apply-placeholders"
            type="button"
            className="erp-btn-ghost-panel"
            onClick={applyPlaceholders}
            disabled={isPreviewMode}
          >
            Apply placeholders to letter
          </button>

          <label
            htmlFor="erp-step6-letter-editor"
            className="mb-2 block border-b-[0.5px] border-[#ebebea] pb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#1a2a3a]"
          >
            Letter
          </label>
          {isPreviewMode && letterRaw ? (
            <div className="min-h-[280px] rounded-md border border-[#e0e0dc] bg-white p-4 font-mono text-sm leading-relaxed text-[#2a3a4a]">
              {(() => {
                const { visible, blurred } = splitPreviewLines(letterRaw);
                return (
                  <>
                    <div className="whitespace-pre-wrap">{visible.join("\n")}</div>
                    {blurred.length > 0 ? (
                      <div
                        className={`mt-2 whitespace-pre-wrap ${PREVIEW_BLUR_CLASS}`}
                        aria-hidden
                      >
                        {blurred.join("\n")}
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
          ) : (
            <textarea
              id="erp-step6-letter-editor"
              rows={18}
              spellCheck={false}
              className="w-full rounded-md border-[0.5px] border-[#e0e0dc] bg-white px-3 py-2 font-mono text-sm leading-relaxed text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
              value={letterRaw ?? ""}
              onChange={onEditorChange}
            />
          )}

          </div>

          <pre
            id="erp-step6-letter-export-source"
            aria-hidden="true"
            className="pointer-events-none fixed left-[-9999px] top-0 z-0 w-[min(900px,100vw)] whitespace-pre-wrap border-0 bg-transparent p-0 text-sm text-[#2a3a4a] opacity-0"
          />

          <div className="flex flex-wrap gap-3">
            <button
              id="erp-step6-copy-letter"
              type="button"
              className="erp-btn-ghost-panel"
              onClick={() => void copyLetter()}
              disabled={isPreviewMode}
            >
              Copy letter
            </button>
            {isPreviewMode ? (
              <>
                <button
                  type="button"
                  disabled
                  title="Unlock your analysis to export"
                  className="erp-btn-ghost-panel cursor-not-allowed opacity-60"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <LockIcon className="h-4 w-4" />
                    Unlock to Download PDF
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  title="Unlock your analysis to export"
                  className="erp-btn-ghost-panel cursor-not-allowed opacity-60"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <LockIcon className="h-4 w-4" />
                    Unlock to Download Word
                  </span>
                </button>
              </>
            ) : (
              <>
                <button
                  id="erp-step6-download-pdf"
                  type="button"
                  className="erp-btn-ghost-panel"
                  onClick={() => void downloadPdf()}
                >
                  Download PDF
                </button>
                <button
                  id="erp-step6-download-word"
                  type="button"
                  className="erp-btn-ghost-panel"
                  onClick={() => void downloadWord()}
                >
                  Download Word
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {isPreviewMode && onPreviewUnlock && (
        <PreviewPaywallBlock
          onUnlock={onPreviewUnlock}
          busy={previewUnlockBusy}
        />
      )}

      <div className="mt-10 flex flex-wrap gap-4 border-t-[0.5px] border-[#1e3f6e] pt-6">
        <button
          id="erp-step6-back"
          type="button"
          className="erp-btn-ghost-panel"
          onClick={onBack}
        >
          Back
        </button>
        <button
          id="erp-step6-start-over"
          type="button"
          className="erp-btn-ghost-panel"
          onClick={onStartOver}
        >
          Start over
        </button>
      </div>
    </div>
  );
}
