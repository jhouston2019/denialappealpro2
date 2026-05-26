"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { netlifyFunctionUrl } from "@/lib/netlify-function-url";
import { PostPaymentSessionRefresh } from "@/components/billing/PostPaymentSessionRefresh";
import { PreviewPaywallBlock } from "@/components/PreviewPaywallBlock";
import { getPlanReviewLimit } from "@/lib/billing/planLimits";
import {
  createSupabaseBrowserClient,
  wizardFetch,
} from "@/lib/supabaseClient";
import {
  tryParseWizardSnapshot,
  toSupabaseJsonValue,
  WIZARD_STATE_STORAGE_KEY,
  type SerializableWizardV1,
} from "@/lib/wizard-snapshot";
import {
  Step2AnalysisPanel,
  parseAnalysisResult,
  parseComparisonResult,
  type AnalysisResult,
  type ComparisonResult,
} from "./step2-analysis-panel";
import { Step3ComparisonPanel } from "./step3-comparison-panel";
import { Step4StrategyPanel } from "./step4-strategy-panel";
import { Step5SummaryPanel } from "./step5-summary-panel";
import {
  Step6LetterPanel,
  applyPlaceholdersToLetter,
  emptyLetterPlaceholders,
  letterPlaceholdersFromClaimMeta,
  type LetterPlaceholderFields,
} from "./step6-letter-panel";
import { extractImagesFromPDF, extractTextFromPDF } from "@/lib/estimate-pdf-extract";
import "./erp-wizard.css";

const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

type ClaimDocumentSide =
  | "CARRIER"
  | "CONTRACTOR"
  | "PUBLIC_ADJUSTER"
  | "MITIGATION"
  | "OTHER";

type ClaimDocumentCategory =
  | "BUILDING"
  | "CONTENTS"
  | "ALE"
  | "MITIGATION"
  | "OTHER";

type ClaimDocumentVersion =
  | "ORIGINAL"
  | "SUPPLEMENT_1"
  | "SUPPLEMENT_2"
  | "SUPPLEMENT_3"
  | "REVISED"
  | "FINAL";

interface ClaimDocument {
  id: string;
  extractedText: string;
  extractStatus: "idle" | "extracting" | "done" | "error";
  /** Shown under the file slot (e.g. after PDF/image upload). */
  statusMessage?: string;
  side: ClaimDocumentSide;
  category: ClaimDocumentCategory;
  version: ClaimDocumentVersion;
  label: string;
  autoDetected: boolean;
  /** When false, label is auto-updated from side/category/version. */
  labelLocked?: boolean;
}

const SIDE_OPTIONS: { value: ClaimDocumentSide; label: string }[] = [
  { value: "CARRIER", label: "Carrier" },
  { value: "CONTRACTOR", label: "Contractor" },
  { value: "PUBLIC_ADJUSTER", label: "Public Adjuster" },
  { value: "MITIGATION", label: "Mitigation" },
  { value: "OTHER", label: "Other" },
];

const CATEGORY_OPTIONS: { value: ClaimDocumentCategory; label: string }[] = [
  { value: "BUILDING", label: "Building" },
  { value: "CONTENTS", label: "Contents" },
  { value: "ALE", label: "ALE" },
  { value: "MITIGATION", label: "Mitigation" },
  { value: "OTHER", label: "Other" },
];

const VERSION_OPTIONS: { value: ClaimDocumentVersion; label: string }[] = [
  { value: "ORIGINAL", label: "Original" },
  { value: "SUPPLEMENT_1", label: "Supplement 1" },
  { value: "SUPPLEMENT_2", label: "Supplement 2" },
  { value: "SUPPLEMENT_3", label: "Supplement 3" },
  { value: "REVISED", label: "Revised" },
  { value: "FINAL", label: "Final" },
];

function categorySelectValue(
  category: ClaimDocumentCategory | undefined | null
): ClaimDocumentCategory {
  if (
    category &&
    CATEGORY_OPTIONS.some((o) => o.value === category)
  ) {
    return category;
  }
  return "BUILDING";
}

function versionSelectValue(
  version: ClaimDocumentVersion | undefined | null
): ClaimDocumentVersion {
  if (
    version &&
    VERSION_OPTIONS.some((o) => o.value === version)
  ) {
    return version;
  }
  return "ORIGINAL";
}

function autoDetectCategory(text: string): ClaimDocumentCategory {
  const t = text.toLowerCase();

  // Only tag as ALE if it's clearly the primary subject of the document
  // Require multiple ALE indicators or a clear section header
  const aleScore = [
    /^ale\b/m.test(t),
    /additional living expense/i.test(t),
    /loss of use/i.test(t),
    /temporary housing/i.test(t),
    /hotel.*receipt/i.test(t),
    /rental.*reimbursement/i.test(t),
  ].filter(Boolean).length;

  if (aleScore >= 2) return "ALE";

  if (
    /contents|personal property|furniture|appliance|clothing|electronics/.test(
      t
    )
  ) {
    return "CONTENTS";
  }
  if (
    /mitigation|water extraction|drying|dehumidif|mold remediation/.test(t)
  ) {
    return "MITIGATION";
  }
  return "BUILDING";
}

function buildDefaultLabel(
  side: ClaimDocumentSide,
  category: ClaimDocumentCategory,
  version: ClaimDocumentVersion
): string {
  const s = SIDE_OPTIONS.find((o) => o.value === side)?.label ?? side;
  const c = CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? category;
  const v = VERSION_OPTIONS.find((o) => o.value === version)?.label ?? version;
  return `${s} ${c} ${v}`;
}

/** Label from dropped file name: strip extension; underscores → spaces; letter-letter hyphens → spaces (keeps dates like 4-25-2023). */
function labelFromDroppedFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/i, "").trim();
  if (!base) return "";
  const afterUnderscore = base.replace(/_/g, " ");
  const withHyphens = afterUnderscore.replace(
    /([a-zA-Z])-([a-zA-Z])/g,
    "$1 $2"
  );
  return withHyphens.replace(/\s+/g, " ").trim();
}

/** Stable ids for the two default slots so SSR/client hydration list keys stay consistent. */
const INITIAL_CARRIER_DOCUMENT_ID = "erp-initial-doc-carrier";
const INITIAL_CONTRACTOR_DOCUMENT_ID = "erp-initial-doc-contractor";

function createClaimDocument(slotIndex: number): ClaimDocument {
  const side: ClaimDocumentSide =
    slotIndex === 0 ? "CARRIER" : "CONTRACTOR";
  const category: ClaimDocumentCategory = "BUILDING";
  const version: ClaimDocumentVersion = "ORIGINAL";
  return {
    id: crypto.randomUUID(),
    extractedText: "",
    extractStatus: "idle",
    side,
    category,
    version,
    label: buildDefaultLabel(side, category, version),
    autoDetected: false,
    labelLocked: false,
  };
}

function categoriesInDocumentOrder(documents: ClaimDocument[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of documents) {
    if (!seen.has(d.category)) {
      seen.add(d.category);
      out.push(d.category);
    }
  }
  return out;
}

const CARRIER_VERSION_ORDER: Record<ClaimDocumentVersion, number> = {
  ORIGINAL: 0,
  SUPPLEMENT_1: 1,
  SUPPLEMENT_2: 2,
  SUPPLEMENT_3: 3,
  REVISED: 4,
  FINAL: 5,
};

function categoriesWithNonemptyDocs(
  documents: ClaimDocument[]
): ClaimDocumentCategory[] {
  const seen = new Set<ClaimDocumentCategory>();
  const order: ClaimDocumentCategory[] = [];
  for (const d of documents) {
    if (!d.extractedText.trim()) continue;
    if (!seen.has(d.category)) {
      seen.add(d.category);
      order.push(d.category);
    }
  }
  return order;
}

function carrierVersionSegmentsForCategory(
  documents: ClaimDocument[],
  category: ClaimDocumentCategory
): { version: ClaimDocumentVersion; text: string }[] {
  const carriers = documents.filter(
    (d) =>
      d.category === category &&
      d.side === "CARRIER" &&
      d.extractedText.trim()
  );
  const byVersion = new Map<ClaimDocumentVersion, string[]>();
  for (const d of carriers) {
    const list = byVersion.get(d.version) ?? [];
    list.push(d.extractedText.trim());
    byVersion.set(d.version, list);
  }
  const versions = [...byVersion.keys()].sort(
    (a, b) =>
      (CARRIER_VERSION_ORDER[a] ?? 0) - (CARRIER_VERSION_ORDER[b] ?? 0)
  );
  return versions.map((v) => ({
    version: v,
    text: (byVersion.get(v) ?? []).join("\n\n---\n\n"),
  }));
}

type WizardState = {
  accessToken: string;
  /** True after getSession() resolves (or Supabase env missing); avoids racing with "bypass". */
  sessionReady: boolean;
  carrierText: string | null;
  contractorText: string | null;
  documents: ClaimDocument[];
  analyses: Record<string, AnalysisResult>;
  comparisons: Record<string, ComparisonResult>;
  strategies: Record<string, string>;
  fileBase64: string | null;
  claimMeta: {
    insuredName: string;
    carrierName: string;
    claimType: string;
    state: string;
    policyNumber: string;
    claimNumber: string;
    dateOfLoss: string;
    adjusterName: string;
    responseDeadline: string;
  };
  analysis: AnalysisResult | null;
  comparison: ComparisonResult | null;
  summary?: unknown;
  strategy: string | null;
  letterType: string | null;
  letterRaw: string | null;
  letterPlaceholders: LetterPlaceholderFields;
  prefillApplied: boolean;
};

type ClaimMetaFields = WizardState["claimMeta"];

function deriveLegacyFields(
  s: WizardState
): Pick<
  WizardState,
  "carrierText" | "contractorText" | "analysis" | "comparison" | "strategy"
> {
  const carrierParts: string[] = [];
  const contractorParts: string[] = [];
  for (const d of s.documents) {
    const t = d.extractedText.trim();
    if (!t) continue;
    if (d.side === "CARRIER") carrierParts.push(t);
    else contractorParts.push(t);
  }
  const carrierText = carrierParts.length
    ? carrierParts.join("\n\n---\n\n")
    : null;
  const contractorText = contractorParts.length
    ? contractorParts.join("\n\n---\n\n")
    : null;
  const order = categoriesInDocumentOrder(s.documents);
  let analysis: AnalysisResult | null = null;
  let comparison: ComparisonResult | null = null;
  let strategy: string | null = null;
  for (const c of order) {
    if (!analysis && s.analyses[c]) analysis = s.analyses[c] ?? null;
    if (!comparison && s.comparisons[c]) comparison = s.comparisons[c] ?? null;
    if (!strategy && s.strategies[c]) strategy = s.strategies[c] ?? null;
  }
  if (!strategy) {
    const vals = Object.values(s.strategies);
    strategy = vals[0] ?? null;
  }
  return { carrierText, contractorText, analysis, comparison, strategy };
}

function withDerived(
  prev: WizardState,
  patch: Partial<WizardState>
): WizardState {
  const next = { ...prev, ...patch };
  return { ...next, ...deriveLegacyFields(next) };
}

function documentSideSubtitle(side: ClaimDocumentSide): string {
  switch (side) {
    case "CARRIER":
      return "Carrier Estimate";
    case "CONTRACTOR":
      return "Contractor / Independent Estimate";
    case "PUBLIC_ADJUSTER":
      return "Public Adjuster Estimate";
    case "MITIGATION":
      return "Mitigation Invoice";
    case "OTHER":
      return "Other Document";
    default:
      return "";
  }
}

function extractStatusMessage(doc: ClaimDocument): string {
  if (doc.extractStatus === "extracting") {
    return doc.statusMessage?.trim() || "Reading file…";
  }
  if (doc.extractStatus === "error") {
    return doc.statusMessage?.trim() || "Could not read file.";
  }
  if (doc.extractStatus === "done") {
    return doc.statusMessage?.trim() || "Text ready.";
  }
  const hint = doc.statusMessage?.trim();
  if (hint) return hint;
  if (doc.extractedText.trim()) return "Ready.";
  return "Add estimate text (paste, .txt, or PDF). Image files still need pasted text below.";
}

function extractStatusClassName(doc: ClaimDocument): string {
  if (doc.extractStatus === "extracting") return "text-sm text-[#f0a050]";
  if (doc.extractStatus === "error") return "text-sm text-[#b83030]";
  if (doc.extractStatus === "done") return "text-sm text-[#1e3f6e]";
  if (doc.statusMessage?.trim()) return "text-sm text-[#f0a050]";
  return "text-sm text-[#4a5a6a]";
}

const initialWizardState = (): WizardState => {
  const base: WizardState = {
    accessToken: "bypass",
    sessionReady: false,
    carrierText: null,
    contractorText: null,
    documents: [
      {
        id: INITIAL_CARRIER_DOCUMENT_ID,
        extractedText: "",
        extractStatus: "idle",
        side: "CARRIER",
        category: "BUILDING",
        version: "ORIGINAL",
        label: "Carrier Building Original",
        autoDetected: false,
        labelLocked: false,
      },
      {
        id: INITIAL_CONTRACTOR_DOCUMENT_ID,
        extractedText: "",
        extractStatus: "idle",
        side: "CONTRACTOR",
        category: "BUILDING",
        version: "ORIGINAL",
        label: "Contractor Building Original",
        autoDetected: false,
        labelLocked: false,
      },
    ],
    analyses: {},
    comparisons: {},
    strategies: {},
    fileBase64: null,
    claimMeta: {
      insuredName: "",
      carrierName: "",
      claimType: "",
      state: "",
      policyNumber: "",
      claimNumber: "",
      dateOfLoss: "",
      adjusterName: "",
      responseDeadline: "",
    },
    analysis: null,
    comparison: null,
    strategy: null,
    letterType: null,
    letterRaw: null,
    letterPlaceholders: emptyLetterPlaceholders(),
    prefillApplied: false,
  };
  return { ...base, ...deriveLegacyFields(base) };
};

function buildWizardSnapshot(
  s: WizardState,
  currentStep: number
): string {
  const payload: SerializableWizardV1 = {
    v: 1,
    currentStep,
    documents: s.documents,
    claimMeta: s.claimMeta,
    analyses: s.analyses,
    comparisons: s.comparisons,
    strategies: s.strategies,
    letterType: s.letterType,
    letterRaw: s.letterRaw,
    letterPlaceholders: s.letterPlaceholders,
    prefillApplied: s.prefillApplied,
    summary: s.summary,
  };
  return JSON.stringify(payload);
}

function restoreWizardFromSnapshot(
  raw: SerializableWizardV1,
  accessToken: string,
  sessionReady: boolean
): WizardState {
  const base = initialWizardState();
  const claimFromRaw =
    raw.claimMeta && typeof raw.claimMeta === "object"
      ? (raw.claimMeta as WizardState["claimMeta"])
      : base.claimMeta;
  const next: WizardState = {
    ...base,
    accessToken,
    sessionReady,
    documents: Array.isArray(raw.documents)
      ? (raw.documents as ClaimDocument[])
      : base.documents,
    claimMeta: { ...base.claimMeta, ...claimFromRaw },
    analyses: (raw.analyses as WizardState["analyses"]) ?? {},
    comparisons: (raw.comparisons as WizardState["comparisons"]) ?? {},
    strategies: (raw.strategies as WizardState["strategies"]) ?? {},
    letterType: raw.letterType,
    letterRaw: raw.letterRaw,
    letterPlaceholders: {
      ...emptyLetterPlaceholders(),
      ...(raw.letterPlaceholders as LetterPlaceholderFields),
    },
    prefillApplied: raw.prefillApplied,
    summary: (raw.summary as WizardState["summary"]) ?? undefined,
  };
  return withDerived(next, {});
}

async function saveReviewToDatabase(
  s: WizardState,
  letterTextForStore: string
): Promise<boolean> {
  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) return false;
    if (!s.letterType) return false;
    const a = s.analysis;
    const m = s.claimMeta;
    const analysisWithClaimMeta =
      a && typeof a === "object" && a !== null
        ? {
            ...(a as Record<string, unknown>),
            claimMeta: {
              insuredName: m.insuredName,
              carrierName: m.carrierName,
              policyNumber: m.policyNumber,
              claimNumber: m.claimNumber,
              dateOfLoss: m.dateOfLoss,
              adjusterName: m.adjusterName,
              responseDeadline: m.responseDeadline,
            },
          }
        : a;
    const { error } = await supabase.from("reviews").insert({
      user_id: session.user.id,
      ai_analysis_json: toSupabaseJsonValue(analysisWithClaimMeta),
      ai_comparison_json: toSupabaseJsonValue(s.comparison),
      ai_summary_json: toSupabaseJsonValue(s.summary),
      insured_name: s.claimMeta?.insuredName ?? null,
      letter_text: letterTextForStore,
      letter_type: s.letterType,
    });
    if (error) {
      console.error("[upload] reviews insert:", error);
      return false;
    }
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession) {
      const { data: userData } = await supabase
        .from("users")
        .select("plan_type")
        .eq("id", currentSession.user.id)
        .single();

      if (userData?.plan_type === "single") {
        await supabase
          .from("users")
          .update({ plan_type: null })
          .eq("id", currentSession.user.id);
      }
    }
    try {
      const usageRes = await fetch("/api/increment-review-usage", {
        method: "POST",
        credentials: "include",
      });
      if (!usageRes.ok) {
        console.error("[upload] increment-review-usage:", await usageRes.text());
      }
    } catch (usageErr) {
      console.error("[upload] increment-review-usage:", usageErr);
    }
    return true;
  } catch (saveErr) {
    console.error("Failed to save review:", saveErr);
    return false;
  }
}

const CLAIM_META_AUTO_EXTRACT_KEYS = new Set([
  "policyNumber",
  "claimNumber",
  "dateOfLoss",
  "adjusterName",
  "carrierName",
  "insuredName",
]);

function extractClaimMetaFromText(
  rawText: string
): Partial<ClaimMetaFields> {
  let text = rawText.replace(/\t/g, " ");
  for (let pass = 0; pass < 20; pass++) {
    const before = text;
    text = text
      .replace(/\b(\w) (\w) (\w) (\w) (\w)\b/g, "$1$2$3$4$5")
      .replace(/\b(\w) (\w) (\w) (\w)\b/g, "$1$2$3$4")
      .replace(/\b(\w) (\w) (\w)\b/g, "$1$2$3");
    if (text === before) break;
  }
  text = text.replace(/ {3,}/g, " ");

  const policyMatch = text.match(
    /policy\s*(?:number|no\.?|#)?\s*[:\-]?\s*([A-Z0-9\-]{5,20})/i
  );

  const claimMatch = text.match(
    /claim\s*(?:number|no\.?|#)?\s*[:\-]?\s*([A-Z0-9\-]{5,20})/i
  );

  const dolPatterns = [
    /date\s*of\s*loss\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /loss\s*date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /d\.?\s*o\.?\s*l\.?\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ];
  let dolMatch: RegExpMatchArray | null = null;
  for (const pattern of dolPatterns) {
    dolMatch = text.match(pattern);
    if (dolMatch) break;
  }
  if (!dolMatch) {
    dolMatch = text.match(
      /date\s*of\s*loss\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i
    );
  }
  if (!dolMatch) {
    const lossLabel = /date\s*of\s*loss|loss\s*date|d\.?\s*o\.?\s*l\.?/i.exec(
      text
    );
    if (lossLabel) {
      const chunk = text.slice(lossLabel.index, lossLabel.index + 200);
      dolMatch = chunk.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    }
  }

  const adjusterMatch = text.match(
    /(?:adjuster|estimator|assigned\s+to|written\s+by|claim\s+rep|representative)\s*[:\-]?\s*([A-Za-z][A-Za-z\s\.]{2,35})(?:\s*(?:position|phone|email|cell|\n|$))/i
  );

  const carrierMatch = text.match(
    /(?:insurance\s+company|carrier|insurer|company)\s*[:\-]?\s*([A-Za-z][A-Za-z\s\&\.]{2,50})(?:\s*(?:business|address|phone|\n|$))/i
  );

  const insuredMatch = text.match(
    /(?:insured|customer|property\s+owner|owner)\s*[:\-]?\s*([A-Za-z][A-Za-z\s\.\,]{2,50})(?:\s*(?:property|address|phone|\n|$))/i
  );

  let dateOfLoss = "";
  if (dolMatch?.[1]) {
    try {
      const d = new Date(dolMatch[1]);
      if (!isNaN(d.getTime())) {
        dateOfLoss = d.toISOString().split("T")[0];
      }
    } catch {
      /* ignore */
    }
  }

  return {
    policyNumber: policyMatch?.[1]?.trim() ?? "",
    claimNumber: claimMatch?.[1]?.trim() ?? "",
    dateOfLoss,
    adjusterName: adjusterMatch?.[1]?.trim() ?? "",
    carrierName: carrierMatch?.[1]?.trim() ?? "",
    insuredName: insuredMatch?.[1]?.trim() ?? "",
  };
}

function mergeExtractedClaimMeta(
  current: WizardState["claimMeta"],
  extracted: Partial<WizardState["claimMeta"]>
): { claimMeta: WizardState["claimMeta"]; extractedKeys: string[] } {
  const next = { ...current };
  const extractedKeys: string[] = [];
  for (const [key, value] of Object.entries(extracted)) {
    if (typeof value !== "string") continue;
    const v = value.trim();
    if (!v) continue;
    const cur = String(next[key as keyof WizardState["claimMeta"]] ?? "").trim();
    if (cur) continue;
    (next as Record<string, string>)[key] = v;
    extractedKeys.push(key);
  }
  return { claimMeta: next, extractedKeys };
}

/** Fills required Step 1 metadata when resuming from /analysis-preview after payment. */
function fillPreviewResumeClaimMeta(m: ClaimMetaFields): ClaimMetaFields {
  const today = new Date().toISOString().split("T")[0] ?? "";
  return {
    ...m,
    insuredName: m.insuredName?.trim() || "Unknown insured",
    claimType: m.claimType?.trim() || "property",
    state: m.state?.trim() || "TX",
    policyNumber: m.policyNumber?.trim() || "—",
    claimNumber: m.claimNumber?.trim() || "—",
    dateOfLoss: m.dateOfLoss?.trim() || today,
  };
}

function getDocumentText(carrierText: string | null): string {
  return (carrierText ?? "").trim();
}

/** Matches Step 1 file accept list (PDF, images, .txt). */
function isStep1AcceptedEstimateFile(file: File): boolean {
  const n = file.name.toLowerCase();
  if (file.type === "text/plain" || n.endsWith(".txt")) return true;
  if (n.endsWith(".pdf") || file.type === "application/pdf") return true;
  if (/\.(png|jpg|jpeg|webp)$/i.test(n)) return true;
  if (file.type.startsWith("image/")) return true;
  return false;
}

function step1DocFileInputId(idx: number): string {
  if (idx === 0) return "erp-step1-carrier-file";
  if (idx === 1) return "erp-step1-contractor-file";
  return `erp-step1-doc-${idx}-file`;
}

function step1DocPasteId(idx: number): string {
  if (idx === 0) return "erp-step1-carrier-paste";
  if (idx === 1) return "erp-step1-contractor-paste";
  return `erp-step1-doc-${idx}-paste`;
}

function step1DocExtractStatusId(idx: number): string {
  if (idx === 0) return "erp-step1-carrier-extract-status";
  if (idx === 1) return "erp-step1-contractor-extract-status";
  return `erp-step1-doc-${idx}-extract-status`;
}

/** Whether the user may jump to this step from the header step indicator. */
function stepIsNavigable(
  step: number,
  analysis: AnalysisResult | null,
  comparison: ComparisonResult | null,
  letterRaw: string | null,
  stepNow: number
): boolean {
  switch (step) {
    case 1:
      return true;
    case 2:
    case 4:
    case 5:
      return analysis !== null;
    case 3:
      return comparison !== null;
    case 6:
      return letterRaw !== null || stepNow >= 6;
    default:
      return false;
  }
}

type UploadWizardClientProps = { isPreviewMode?: boolean };

export default function UploadWizardClient({
  isPreviewMode = false,
}: UploadWizardClientProps = {}) {
  const router = useRouter();
  const [premierUsageWall, setPremierUsageWall] = useState<
    "checking" | "ok" | "blocked"
  >("checking");
  const [previewUnlockBusy, setPreviewUnlockBusy] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<WizardState>(() => initialWizardState());
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [step6LetterLoading, setStep6LetterLoading] = useState(false);
  const [docDragOverIndex, setDocDragOverIndex] = useState<number | null>(
    null
  );
  const [showXactimateHelp, setShowXactimateHelp] = useState(false);
  const [autoExtractedFields, setAutoExtractedFields] = useState<Set<string>>(
    () => new Set()
  );
  const [pendingOcrFile, setPendingOcrFile] = useState<{
    docId: string;
    file: File;
  } | null>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const wizardStateRef = useRef(state);
  wizardStateRef.current = state;
  const step4StrategyAutoAppliedRef = useRef(false);

  const announce = useCallback((message: string) => {
    const el = liveRegionRef.current;
    if (el) {
      el.textContent = "";
      requestAnimationFrame(() => {
        el.textContent = message;
      });
    }
  }, []);

  const handleLogout = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setState((s) => ({
        ...s,
        accessToken: "bypass",
        sessionReady: true,
      }));
      return () => {
        cancelled = true;
      };
    }

    const supabase = createSupabaseBrowserClient();

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        const token = data.session?.access_token ?? "bypass";
        setState((s) => ({
          ...s,
          accessToken: token,
          sessionReady: true,
        }));
      }
    };
    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const token = session?.access_token ?? "bypass";
      setState((s) => ({
        ...s,
        accessToken: token,
        sessionReady: true,
      }));
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isPreviewMode) {
      setPremierUsageWall("ok");
      return;
    }
    if (typeof window !== "undefined") {
      const pendingPostPayment =
        Boolean(window.sessionStorage.getItem(WIZARD_STATE_STORAGE_KEY)) ||
        window.sessionStorage.getItem("erp_resume") === "true";
      if (pendingPostPayment) {
        setPremierUsageWall("ok");
        return;
      }
    }
    let cancelled = false;
    (async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) {
        if (!cancelled) setPremierUsageWall("ok");
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        if (!cancelled) setPremierUsageWall("ok");
        return;
      }
      const { data, error: userErr } = await supabase
        .from("users")
        .select("plan_type, is_admin")
        .eq("id", userId)
        .maybeSingle();

      const userRow = data as {
        plan_type: string | null;
        is_admin?: boolean;
      } | null;

      if (cancelled) return;
      if (userErr || !userRow) {
        setPremierUsageWall("ok");
        return;
      }
      if (userRow.is_admin) {
        setPremierUsageWall("ok");
        return;
      }
      const plan = userRow.plan_type ?? null;
      const planLimit = getPlanReviewLimit(plan);
      if (planLimit == null) {
        setPremierUsageWall("ok");
        return;
      }

      // Essential, Professional, Enterprise, Premier: prefer billing usage row
      const { data: usageRow, error: usageErr } = await supabase
        .from("user_review_usage")
        .select("reviews_used, reviews_limit, is_active, billing_period_end")
        .eq("user_id", userId)
        .eq("is_active", true)
        .gt("billing_period_end", new Date().toISOString())
        .maybeSingle();

      const ur = usageRow as {
        reviews_used: number | null;
        reviews_limit: number | null;
      } | null;

      if (!usageErr && ur) {
        const used = ur.reviews_used ?? 0;
        const lim =
          ur.reviews_limit != null && ur.reviews_limit > 0
            ? ur.reviews_limit
            : planLimit;
        if (lim > 0) {
          if (used >= lim) {
            if (!cancelled) setPremierUsageWall("blocked");
            return;
          }
          if (!cancelled) setPremierUsageWall("ok");
          return;
        }
      }

      // Fallback: calendar-month review count (when no usage row or limit not set)
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const { count, error: countErr } = await supabase
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());
      if (cancelled) return;
      if (countErr) {
        setPremierUsageWall("ok");
        return;
      }
      const n = count ?? 0;
      setPremierUsageWall(n >= planLimit ? "blocked" : "ok");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patchClaimMeta = useCallback(
    (partial: Partial<WizardState["claimMeta"]>) => {
      const keysToClear = Object.keys(partial).filter((k) =>
        CLAIM_META_AUTO_EXTRACT_KEYS.has(k)
      );
      if (keysToClear.length > 0) {
        setAutoExtractedFields((prev) => {
          const next = new Set(prev);
          for (const k of keysToClear) next.delete(k);
          return next;
        });
      }
      setState((s) => ({
        ...s,
        claimMeta: { ...s.claimMeta, ...partial },
      }));
    },
    []
  );

  const readDocumentFile = useCallback(
    async (docId: string, file: File | null) => {
      if (!file) return;
      try {
        if (
          file.type === "text/plain" ||
          file.name.toLowerCase().endsWith(".txt")
        ) {
          setState((s) =>
            withDerived(s, {
              documents: s.documents.map((d) =>
                d.id === docId
                  ? { ...d, extractStatus: "extracting", statusMessage: undefined }
                  : d
              ),
            })
          );
          const text = await file.text();
          let extractedKeysForAnnounce: string[] = [];
          setState((s) => {
            const documents = s.documents.map((d) => {
              if (d.id !== docId) return d;
              const detected = autoDetectCategory(text);
              return {
                ...d,
                extractedText: text,
                extractStatus: "done" as const,
                statusMessage: undefined,
                category: detected,
                autoDetected: true,
                label: d.labelLocked
                  ? d.label
                  : buildDefaultLabel(d.side, detected, d.version),
              };
            });
            const target = documents.find((d) => d.id === docId);
            let claimMeta = s.claimMeta;
            if (target?.side === "CARRIER") {
              const merged = mergeExtractedClaimMeta(
                s.claimMeta,
                extractClaimMetaFromText(text)
              );
              claimMeta = merged.claimMeta;
              extractedKeysForAnnounce = merged.extractedKeys;
            }
            return withDerived(s, { documents, claimMeta });
          });
          if (extractedKeysForAnnounce.length > 0) {
            setAutoExtractedFields(
              (prev) => new Set([...prev, ...extractedKeysForAnnounce])
            );
            announce(
              `Auto-filled ${extractedKeysForAnnounce.length} claim field${extractedKeysForAnnounce.length > 1 ? "s" : ""} from document.`
            );
          }
          announce("Document text loaded from file.");
          return;
        }

        const lower = file.name.toLowerCase();
        const isPdf =
          file.type === "application/pdf" || lower.endsWith(".pdf");

        if (isPdf && !wizardStateRef.current.sessionReady) {
          setPendingOcrFile({ docId, file });
          return;
        }

        if (isPdf) {
          setState((s) =>
            withDerived(s, {
              documents: s.documents.map((d) =>
                d.id === docId
                  ? {
                      ...d,
                      extractStatus: "extracting" as const,
                      statusMessage: `Extracting text from "${file.name}"…`,
                    }
                  : d
              ),
            })
          );
          try {
            const text = await extractTextFromPDF(file);
            if (text.trim().length < 500) {
              setState((s) =>
                withDerived(s, {
                  documents: s.documents.map((d) =>
                    d.id === docId
                      ? {
                          ...d,
                          extractStatus: "extracting" as const,
                          statusMessage: `Reading "${file.name}" with AI vision…`,
                        }
                      : d
                  ),
                })
              );
              try {
                const images = await extractImagesFromPDF(file);
                if (images.length === 0) {
                  throw new Error("No pages rendered for OCR");
                }
                const pageTexts: string[] = [];
                for (let i = 0; i < images.length; i++) {
                  setState((s) =>
                    withDerived(s, {
                      documents: s.documents.map((d) =>
                        d.id === docId
                          ? {
                              ...d,
                              extractStatus: "extracting" as const,
                              statusMessage: `Reading "${file.name}" with AI vision… (page ${i + 1} of ${images.length})`,
                            }
                          : d
                      ),
                    })
                  );
                  const ocrRes = await wizardFetch(
                    netlifyFunctionUrl("analyze-estimate"),
                    {
                      method: "POST",
                      body: JSON.stringify({
                        mode: "extract_only",
                        images: [images[i]],
                        fileName: file.name,
                        pageNumber: i + 1,
                        totalPages: images.length,
                      }),
                    }
                  );
                  if (!ocrRes.ok) {
                    const err = (await ocrRes.json().catch(() => ({}))) as {
                      error?: string;
                    };
                    throw new Error(
                      err.error ?? `Page ${i + 1} extraction failed`
                    );
                  }
                  const ocrData = (await ocrRes.json()) as {
                    text?: string;
                    error?: string;
                  };
                  if (ocrData.text?.trim()) pageTexts.push(ocrData.text);
                }
                const fullText = pageTexts.join("\n\n");
                if (!fullText.trim()) {
                  throw new Error("OCR returned no text");
                }
                const pageCount = images.length;
                let extractedKeysForAnnounce: string[] = [];
                setState((s) => {
                  const detected = autoDetectCategory(fullText);
                  const documents = s.documents.map((d) => {
                    if (d.id !== docId) return d;
                    return {
                      ...d,
                      extractedText: fullText,
                      extractStatus: "done" as const,
                      statusMessage: `"${file.name}" — AI vision extracted text from ${pageCount} page${pageCount > 1 ? "s" : ""}.`,
                      category: detected,
                      autoDetected: true,
                      label: d.labelLocked
                        ? d.label
                        : buildDefaultLabel(d.side, detected, d.version),
                    };
                  });
                  const updatedDoc = documents.find((d) => d.id === docId);
                  let claimMeta = s.claimMeta;
                  if (updatedDoc?.side === "CARRIER") {
                    const merged = mergeExtractedClaimMeta(
                      s.claimMeta,
                      extractClaimMetaFromText(fullText)
                    );
                    claimMeta = merged.claimMeta;
                    extractedKeysForAnnounce = merged.extractedKeys;
                  }
                  return withDerived(s, { documents, claimMeta });
                });
                if (extractedKeysForAnnounce.length > 0) {
                  setAutoExtractedFields(
                    (prev) => new Set([...prev, ...extractedKeysForAnnounce])
                  );
                  announce(
                    `Auto-filled ${extractedKeysForAnnounce.length} claim field${extractedKeysForAnnounce.length > 1 ? "s" : ""} from document.`
                  );
                }
                announce(`AI vision extracted text from ${file.name}`);
              } catch {
                setState((s) =>
                  withDerived(s, {
                    documents: s.documents.map((d) =>
                      d.id === docId
                        ? {
                            ...d,
                            extractStatus: "error" as const,
                            extractedText: "",
                            statusMessage: `Could not read "${file.name}". Please paste the estimate text below.`,
                          }
                        : d
                    ),
                  })
                );
                announce("Could not read PDF with AI vision.");
              }
              return;
            }
            let extractedKeysForAnnounce: string[] = [];
            setState((s) => {
              const detected = autoDetectCategory(text);
              const documents = s.documents.map((d) => {
                if (d.id !== docId) return d;
                return {
                  ...d,
                  extractedText: text,
                  extractStatus: "done" as const,
                  statusMessage: `"${file.name}" — text extracted successfully (${text.length} characters).`,
                  category: detected,
                  autoDetected: true,
                  label: d.labelLocked
                    ? d.label
                    : buildDefaultLabel(d.side, detected, d.version),
                };
              });
              const updatedDoc = documents.find((d) => d.id === docId);
              let claimMeta = s.claimMeta;
              if (updatedDoc?.side === "CARRIER") {
                const merged = mergeExtractedClaimMeta(
                  s.claimMeta,
                  extractClaimMetaFromText(text)
                );
                claimMeta = merged.claimMeta;
                extractedKeysForAnnounce = merged.extractedKeys;
              }
              return withDerived(s, { documents, claimMeta });
            });
            if (extractedKeysForAnnounce.length > 0) {
              setAutoExtractedFields(
                (prev) => new Set([...prev, ...extractedKeysForAnnounce])
              );
              announce(
                `Auto-filled ${extractedKeysForAnnounce.length} claim field${extractedKeysForAnnounce.length > 1 ? "s" : ""} from document.`
              );
            }
            announce(`Text extracted from ${file.name}`);
          } catch {
            setState((s) =>
              withDerived(s, {
                documents: s.documents.map((d) =>
                  d.id === docId
                    ? {
                        ...d,
                        extractStatus: "error" as const,
                        extractedText: "",
                        statusMessage: `Could not extract text from "${file.name}". Please paste the estimate text below.`,
                      }
                    : d
                ),
              })
            );
            announce("Could not extract text from PDF.");
          }
          return;
        }

        const statusMessage = `"${file.name}" uploaded — Image text extraction is not available in browser. Please paste the estimate text in the field below.`;
        const suggestedLabel = labelFromDroppedFileName(file.name);
        setState((s) =>
          withDerived(s, {
            documents: s.documents.map((d) =>
              d.id === docId
                ? {
                    ...d,
                    extractStatus: "idle" as const,
                    extractedText: "",
                    statusMessage,
                    label: d.labelLocked ? d.label : suggestedLabel,
                  }
                : d
            ),
          })
        );
      } catch {
        setState((s) =>
          withDerived(s, {
            documents: s.documents.map((d) =>
              d.id === docId
                ? { ...d, extractStatus: "error", statusMessage: undefined }
                : d
            ),
          })
        );
        announce("Could not read file.");
      }
    },
    [announce, setPendingOcrFile, wizardFetch]
  );

  useEffect(() => {
    if (!state.sessionReady || !pendingOcrFile) return;
    const p = pendingOcrFile;
    setPendingOcrFile(null);
    void readDocumentFile(p.docId, p.file);
  }, [state.sessionReady, pendingOcrFile, readDocumentFile]);

  const updateDocumentText = useCallback(
    (docId: string, text: string) => {
      let extractedKeysForAnnounce: string[] = [];
      setState((s) => {
        const target = s.documents.find((d) => d.id === docId);
        let claimMeta = s.claimMeta;
        if (target?.side === "CARRIER") {
          const merged = mergeExtractedClaimMeta(
            s.claimMeta,
            extractClaimMetaFromText(text)
          );
          claimMeta = merged.claimMeta;
          extractedKeysForAnnounce = merged.extractedKeys;
        }
        const documents = s.documents.map((d) => {
          if (d.id !== docId) return d;
          const detected = autoDetectCategory(text);
          return {
            ...d,
            extractedText: text,
            extractStatus: text.trim() ? ("done" as const) : ("idle" as const),
            statusMessage: undefined,
            category: detected,
            autoDetected: true,
            label: d.labelLocked
              ? d.label
              : buildDefaultLabel(d.side, detected, d.version),
          };
        });
        return withDerived(s, { documents, claimMeta });
      });
      if (extractedKeysForAnnounce.length > 0) {
        setAutoExtractedFields(
          (prev) => new Set([...prev, ...extractedKeysForAnnounce])
        );
        announce(
          `Auto-filled ${extractedKeysForAnnounce.length} claim field${extractedKeysForAnnounce.length > 1 ? "s" : ""} from document.`
        );
      }
    },
    [announce]
  );

  const updateDocumentSide = useCallback(
    (docId: string, side: ClaimDocumentSide) => {
      setState((s) => {
        const documents = s.documents.map((d) => {
          if (d.id !== docId) return d;
          return {
            ...d,
            side,
            label: d.labelLocked
              ? d.label
              : buildDefaultLabel(side, d.category, d.version),
          };
        });
        return withDerived(s, { documents });
      });
    },
    []
  );

  const updateDocumentCategory = useCallback(
    (docId: string, category: ClaimDocumentCategory) => {
      setState((s) => {
        const documents = s.documents.map((d) => {
          if (d.id !== docId) return d;
          return {
            ...d,
            category,
            autoDetected: false,
            label: d.labelLocked
              ? d.label
              : buildDefaultLabel(d.side, category, d.version),
          };
        });
        return withDerived(s, { documents });
      });
    },
    []
  );

  const updateDocumentVersion = useCallback(
    (docId: string, version: ClaimDocumentVersion) => {
      setState((s) => {
        const documents = s.documents.map((d) => {
          if (d.id !== docId) return d;
          return {
            ...d,
            version,
            label: d.labelLocked
              ? d.label
              : buildDefaultLabel(d.side, d.category, version),
          };
        });
        return withDerived(s, { documents });
      });
    },
    []
  );

  const updateDocumentLabel = useCallback((docId: string, label: string) => {
    setState((s) => {
      const documents = s.documents.map((d) =>
        d.id === docId ? { ...d, label, labelLocked: true } : d
      );
      return withDerived(s, { documents });
    });
  }, []);

  const addDocumentSlot = useCallback(() => {
    setState((s) => {
      if (s.documents.length >= 10) return s;
      return withDerived(s, {
        documents: [...s.documents, createClaimDocument(s.documents.length)],
      });
    });
  }, []);

  const removeDocumentSlot = useCallback((docId: string) => {
    setState((s) => {
      if (s.documents.length <= 1) return s;
      return withDerived(s, {
        documents: s.documents.filter((d) => d.id !== docId),
      });
    });
  }, []);

  const onLoadDemo = useCallback(() => {
    const demoText =
      "RCV Grand Total $18,200.00\nRemove damaged shingles 24 SQ  $3,200.00\nInstall shingles 24 SQ  $4,800.00\nDetach reset gutter 40 LF  $480.00\nFelt underlayment  $320.00\nRidge cap  $220.00\nDrip edge  $180.00\n";
    const contractorDemoText =
      "Independent estimate — Building / Roofing\nRemove damaged shingles 24 SQ  $3,800.00\nInstall architectural shingles 24 SQ  $5,200.00\nDetach/reset gutter 40 LF  $520.00\nFelt and ice & water per code  $850.00\nRCV total shown: $19,370.00\n";
    setState((s) => {
      const slot0 = s.documents[0];
      const slot1 = s.documents[1] ?? createClaimDocument(1);
      const documents: ClaimDocument[] = [
        {
          ...(slot0 ?? createClaimDocument(0)),
          id: slot0?.id ?? crypto.randomUUID(),
          extractedText: demoText,
          extractStatus: "done",
          side: "CARRIER",
          category: "BUILDING",
          version: "ORIGINAL",
          label: "Carrier Building Original",
          autoDetected: false,
          labelLocked: false,
        },
        {
          ...slot1,
          id: slot1.id,
          extractedText: contractorDemoText,
          extractStatus: "done",
          side: "CONTRACTOR",
          category: "BUILDING",
          version: "ORIGINAL",
          label: "Contractor Building Original",
          autoDetected: false,
          labelLocked: false,
        },
      ];
      return withDerived(s, {
        documents,
        claimMeta: {
          insuredName: "Demo Insured",
          carrierName: "Demo Carrier Insurance",
          claimType: "property",
          state: "TX",
          policyNumber: "DEMO-POL-001",
          claimNumber: "DEMO-CLM-9921",
          dateOfLoss: "2024-05-10",
          adjusterName: "Demo Adjuster",
          responseDeadline: "2026-05-01",
        },
        prefillApplied: false,
        letterType: null,
        letterRaw: null,
        analyses: {},
        comparisons: {},
        strategies: {},
      });
    });
    setAutoExtractedFields(new Set());
    announce("Demo estimate and metadata loaded.");
  }, [announce]);

  const onResetStep1 = useCallback(() => {
    setState((s) => ({
      ...initialWizardState(),
      accessToken: s.accessToken,
      sessionReady: s.sessionReady,
    }));
    setAutoExtractedFields(new Set());
    setSubmitError(null);
    announce("Step 1 cleared.");
  }, [announce]);

  const executeStep1Pipeline = useCallback(
    async (workState: WizardState): Promise<boolean> => {
      const m = workState.claimMeta;
      const baseAnalyzeFields = {
        insuredName: m.insuredName.trim(),
        claimType: m.claimType,
        state: m.state,
        policyNumber: m.policyNumber,
        claimNumber: m.claimNumber,
        dateOfLoss: m.dateOfLoss,
        adjusterName: m.adjusterName,
        responseDeadline: m.responseDeadline || "",
      };

      const docCats = categoriesWithNonemptyDocs(workState.documents);
      const analyzeCategories = docCats.filter((category) =>
        workState.documents.some(
          (d) =>
            d.category === category &&
            d.side === "CARRIER" &&
            d.extractedText.trim()
        )
      );

      try {
        const analyzeResults = await Promise.all(
          analyzeCategories.map(async (category) => {
            const carrierDocs = workState.documents.filter(
              (d) =>
                d.category === category &&
                d.side === "CARRIER" &&
                d.extractedText.trim()
            );
            const otherDocs = workState.documents.filter(
              (d) =>
                d.category === category &&
                d.side !== "CARRIER" &&
                d.extractedText.trim()
            );
            const docText = carrierDocs
              .map((d) => d.extractedText.trim())
              .join("\n\n---\n\n");
            const contractorJoined =
              otherDocs.length > 0
                ? otherDocs
                    .map((d) => d.extractedText.trim())
                    .join("\n\n---\n\n")
                : null;
            const analyzePayload: Record<string, unknown> = {
              ...baseAnalyzeFields,
              documentText: docText,
              contractorText: contractorJoined,
            };
            if (docCats.length > 1) analyzePayload.category = category;
            const res = await wizardFetch(
              netlifyFunctionUrl("analyze-estimate"),
              {
                method: "POST",
                body: JSON.stringify(analyzePayload),
              }
            );
            return { category, res };
          })
        );

        const nextAnalyses: Record<string, AnalysisResult> = {};
        for (const { category, res } of analyzeResults) {
          if (!res.ok) {
            await res.text().catch(() => "");
            setSubmitError("Analysis failed. Please try again.");
            announce("Analysis request failed.");
            setSubmitLoading(false);
            return false;
          }
          const analysisJson: unknown = await res.json();
          const parsedAnalysis = parseAnalysisResult(analysisJson);
          if (!parsedAnalysis) {
            setSubmitError("Analysis failed. Please try again.");
            announce("Analysis parse failed.");
            setSubmitLoading(false);
            return false;
          }
          nextAnalyses[category] = parsedAnalysis;
        }

        const compareTargets = new Set<ClaimDocumentCategory>();
        for (const category of docCats) {
          const hasCarrier = workState.documents.some(
            (d) =>
              d.category === category &&
              d.side === "CARRIER" &&
              d.extractedText.trim()
          );
          const hasOther = workState.documents.some(
            (d) =>
              d.category === category &&
              d.side !== "CARRIER" &&
              d.extractedText.trim()
          );
          const segs = carrierVersionSegmentsForCategory(
            workState.documents,
            category
          );
          if ((hasCarrier && hasOther) || segs.length >= 2) {
            compareTargets.add(category);
          }
        }

        const compareResults = await Promise.all(
          [...compareTargets].map(async (category) => {
            const segs = carrierVersionSegmentsForCategory(
              workState.documents,
              category
            );
            const latestText = segs[segs.length - 1]?.text ?? "";
            const otherDocs = workState.documents.filter(
              (d) =>
                d.category === category &&
                d.side !== "CARRIER" &&
                d.extractedText.trim()
            );
            const contractorJoined =
              otherDocs.length > 0
                ? otherDocs
                    .map((d) => d.extractedText.trim())
                    .join("\n\n---\n\n")
                : null;

            let versionDiff:
              | {
                  previousText: string;
                  currentText: string;
                  previousVersion: string;
                  currentVersion: string;
                }
              | undefined;
            if (segs.length >= 2) {
              const prev = segs[segs.length - 2]!;
              const curr = segs[segs.length - 1]!;
              versionDiff = {
                previousText: prev.text,
                currentText: curr.text,
                previousVersion: prev.version,
                currentVersion: curr.version,
              };
            }

            const compareBody: Record<string, unknown> = {
              carrierText: latestText,
              contractorText: contractorJoined,
              claimType: m.claimType,
            };
            if (docCats.length > 1) compareBody.category = category;
            if (versionDiff) compareBody.versionDiff = versionDiff;

            const res = await wizardFetch(
              netlifyFunctionUrl("compare-estimates"),
              {
                method: "POST",
                body: JSON.stringify(compareBody),
              }
            );
            return { category, res };
          })
        );

        const nextComparisons: Record<string, ComparisonResult> = {};
        for (const { category, res } of compareResults) {
          if (!res.ok) {
            await res.text().catch(() => "");
            setSubmitError("Comparison failed. Please try again.");
            announce("Compare request failed.");
            setSubmitLoading(false);
            return false;
          }
          const compareJson: unknown = await res.json();
          const parsedComparison = parseComparisonResult(compareJson);
          if (!parsedComparison) {
            setSubmitError("Comparison failed. Please try again.");
            announce("Comparison parse failed.");
            setSubmitLoading(false);
            return false;
          }
          nextComparisons[category] = parsedComparison;
        }

        setState((s) =>
          withDerived(
            {
              ...s,
              claimMeta: workState.claimMeta,
              documents: workState.documents,
            },
            {
              analyses: nextAnalyses,
              comparisons: nextComparisons,
            }
          )
        );
        setSubmitLoading(false);
        setCurrentStep(2);
        announce("Step 2 — Analysis.");
        return true;
      } catch {
        setSubmitError("Analysis failed. Please try again.");
        announce("Analysis request error.");
        setSubmitLoading(false);
        return false;
      }
    },
    [announce, wizardFetch]
  );

  const onSubmitStep1 = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      if (state.documents.length > 10) {
        setSubmitError("A maximum of 10 documents is allowed.");
        announce("Submit blocked: too many documents.");
        return;
      }
      const extracting = state.documents.some(
        (d) => d.extractStatus === "extracting"
      );
      if (extracting) {
        setSubmitError(
          "Waiting for document extraction to complete before continuing."
        );
        announce("Waiting for document extraction to complete.");
        return;
      }
      const emptyText = state.documents.some((d) => !d.extractedText.trim());
      if (emptyText) {
        setSubmitError(
          "Each document must have estimate text before continuing."
        );
        announce("Submit blocked: complete all documents with text.");
        return;
      }
      const hasCarrier = state.documents.some(
        (d) => d.side === "CARRIER" && d.extractedText.trim().length > 0
      );
      if (!hasCarrier) {
        setSubmitError(
          "At least one carrier-side document with text is required."
        );
        announce("Submit blocked: carrier document required.");
        return;
      }
      const documentText = getDocumentText(state.carrierText);
      if (!documentText) {
        setSubmitError(
          "Add carrier estimate text (paste or .txt file) before continuing."
        );
        announce("Submit blocked: carrier estimate text is required.");
        return;
      }
      const m = state.claimMeta;
      if (
        !m.insuredName?.trim() ||
        !m.claimType ||
        !m.state ||
        !m.policyNumber ||
        !m.claimNumber ||
        !m.dateOfLoss
      ) {
        setSubmitError("Complete all required metadata fields.");
        announce("Submit blocked: missing required metadata.");
        return;
      }
      setSubmitLoading(true);
      announce("Calling analysis services…");
      await executeStep1Pipeline(state);
    },
    [state, announce, executeStep1Pipeline]
  );

  const postPaymentResumeStartedRef = useRef(false);

  useEffect(() => {
    if (!state.sessionReady || isPreviewMode) return;
    if (postPaymentResumeStartedRef.current) return;
    if (typeof window === "undefined") return;

    const snapRaw = window.sessionStorage.getItem(WIZARD_STATE_STORAGE_KEY);
    const fromWizard = tryParseWizardSnapshot(snapRaw);
    if (fromWizard) {
      postPaymentResumeStartedRef.current = true;
      const restored = restoreWizardFromSnapshot(
        fromWizard,
        state.accessToken,
        true
      );
      setState(restored);
      setCurrentStep(6);
      setSubmitError(null);
      void (async () => {
        if (restored.letterRaw?.trim()) {
          const ok = await saveReviewToDatabase(
            restored,
            restored.letterRaw
          );
          if (ok) {
            window.sessionStorage.removeItem(WIZARD_STATE_STORAGE_KEY);
            window.sessionStorage.removeItem("erp_resume");
            window.sessionStorage.removeItem("erp_extracted_text");
            announce(
              "Your full estimate and letter are saved. You can continue in the app."
            );
          } else {
            postPaymentResumeStartedRef.current = false;
            announce(
              "Your work was restored; saving to your account will retry when you open the review again."
            );
          }
        } else {
          window.sessionStorage.removeItem(WIZARD_STATE_STORAGE_KEY);
          window.sessionStorage.removeItem("erp_resume");
          window.sessionStorage.removeItem("erp_extracted_text");
          announce("Your in-progress work was restored to Step 6.");
        }
      })();
      return;
    }

    if (window.sessionStorage.getItem("erp_resume") !== "true") return;
    const raw = window.sessionStorage.getItem("erp_extracted_text");
    if (!raw?.trim()) return;

    postPaymentResumeStartedRef.current = true;
    const text = raw.trim();
    const base = initialWizardState();
    const merged = mergeExtractedClaimMeta(
      base.claimMeta,
      extractClaimMetaFromText(text)
    );
    const claimMeta = fillPreviewResumeClaimMeta(merged.claimMeta);
    const documents = base.documents.map((d) =>
      d.id === INITIAL_CARRIER_DOCUMENT_ID
        ? {
            ...d,
            extractedText: text,
            extractStatus: "done" as const,
            statusMessage: "Restored from your free preview.",
            autoDetected: true,
            category: autoDetectCategory(text),
            label: d.labelLocked
              ? d.label
              : buildDefaultLabel(
                  d.side,
                  autoDetectCategory(text),
                  d.version
                ),
          }
        : d
    );
    const workState = withDerived(
      {
        ...base,
        accessToken: state.accessToken,
        sessionReady: true,
        claimMeta,
        documents,
      },
      {}
    );

    setSubmitLoading(true);
    setSubmitError(null);
    announce("Resuming your estimate from preview — running full analysis…");

    void (async () => {
      const ok = await executeStep1Pipeline(workState);
      if (ok) {
        window.sessionStorage.removeItem("erp_resume");
        window.sessionStorage.removeItem("erp_extracted_text");
      } else {
        postPaymentResumeStartedRef.current = false;
        setState(workState);
        setSubmitLoading(false);
      }
    })();
  }, [
    state.sessionReady,
    state.accessToken,
    isPreviewMode,
    executeStep1Pipeline,
    announce,
  ]);

  const onStep2Back = useCallback(() => {
    setCurrentStep(1);
    announce("Returned to Step 1.");
  }, [announce]);

  const onStep2Next = useCallback(() => {
    setCurrentStep(3);
    announce("Step 3 — Comparison.");
  }, [announce]);

  const onStep3Back = useCallback(() => {
    setCurrentStep(2);
    announce("Returned to Step 2.");
  }, [announce]);

  const onStep3Next = useCallback(() => {
    setCurrentStep(4);
    announce("Step 4 — Strategy.");
  }, [announce]);

  const onStep4Back = useCallback(() => {
    setCurrentStep(3);
    announce("Returned to Step 3.");
  }, [announce]);

  const onStep4Next = useCallback(() => {
    const s = wizardStateRef.current;
    if (!s.strategy || !s.analysis) {
      announce("Select a strategy and complete analysis first.");
      return;
    }
    setCurrentStep(5);
    announce("Step 5 — Summary.");
  }, [announce]);

  const onStep5Back = useCallback(() => {
    setCurrentStep(4);
    announce("Returned to Step 4.");
  }, [announce]);

  const onStep5GoToLetter = useCallback(() => {
    setCurrentStep(6);
    announce("Step 6 — Letter.");
  }, [announce]);

  const onStep6Back = useCallback(() => {
    setCurrentStep(5);
    announce("Returned to Step 5 — Summary.");
  }, [announce]);

  const onLetterTypeChange = useCallback((code: string) => {
    setState((s) => ({ ...s, letterType: code }));
  }, []);

  const handlePreviewUnlock = useCallback(async () => {
    if (typeof window === "undefined") return;
    setPreviewUnlockBusy(true);
    try {
      const s = wizardStateRef.current;
      const text = getDocumentText(s.carrierText) || "";
      sessionStorage.setItem("erp_extracted_text", text);
      sessionStorage.setItem("erp_resume", "true");
      sessionStorage.setItem(
        WIZARD_STATE_STORAGE_KEY,
        buildWizardSnapshot(s, currentStep)
      );
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planType: "single" }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        announce(
          data.error?.trim() ||
            "Could not start checkout. Please try again or go to Pricing."
        );
        return;
      }
      window.location.assign(data.url);
    } catch {
      announce("Could not start checkout. Please try again.");
    } finally {
      setPreviewUnlockBusy(false);
    }
  }, [currentStep, announce]);

  const onStep6GenerateLetter = useCallback(async () => {
    const s = wizardStateRef.current;
    if (!s.letterType || !s.analysis || !s.strategy) {
      announce("Select a letter type and ensure analysis and strategy are set.");
      return;
    }
    setStep6LetterLoading(true);
    try {
      const res = await wizardFetch(
        netlifyFunctionUrl("generate-estimate-letter"),
        {
          method: "POST",
          body: JSON.stringify({
            analysis: s.analysis,
            strategy: s.strategy,
            claimType: s.claimMeta.claimType,
            letterType: s.letterType,
            tone: "FORMAL_PROFESSIONAL",
          }),
        }
      );
      if (!res.ok) {
        await res.text().catch(() => "");
        announce(
          `Letter could not be generated (HTTP ${res.status}). Check the network response and try again.`
        );
        return;
      }
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("application/json")) {
        await res.text().catch(() => "");
        announce(
          "Letter endpoint returned JSON instead of plain text. Check the network response."
        );
        return;
      }
      const text = await res.text();
      let letterTextForStore = text;
      setState((prev) => {
        const shouldPrefill = !prev.prefillApplied;
        if (shouldPrefill) {
          const fields = letterPlaceholdersFromClaimMeta(prev.claimMeta);
          const merged = applyPlaceholdersToLetter(text, fields);
          letterTextForStore = merged;
          return {
            ...prev,
            letterRaw: merged,
            letterPlaceholders: fields,
            prefillApplied: true,
          };
        }
        letterTextForStore = text;
        return {
          ...prev,
          letterRaw: text,
        };
      });
      if (!text.trim()) {
        announce("Letter response was empty. You can edit the text below.");
      } else {
        announce(
          "Letter generated. Placeholders from claim metadata were applied where tokens appear."
        );
      }
      if (!isPreviewMode) {
        void saveReviewToDatabase(
          { ...s, letterRaw: letterTextForStore },
          letterTextForStore
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Network or request error.";
      announce(`Letter could not be generated: ${msg}`);
    } finally {
      setStep6LetterLoading(false);
    }
  }, [announce, isPreviewMode, wizardFetch]);

  const previewLetterAutogenRef = useRef(false);
  useEffect(() => {
    if (!isPreviewMode || currentStep !== 6) {
      previewLetterAutogenRef.current = false;
      return;
    }
    if (state.letterRaw) return;
    if (!state.strategy || !state.analysis) return;
    if (!state.letterType) {
      setState((s) =>
        s.letterType ? s : { ...s, letterType: "SUPPLEMENT_DEMAND" }
      );
      return;
    }
    if (previewLetterAutogenRef.current) return;
    previewLetterAutogenRef.current = true;
    void onStep6GenerateLetter();
  }, [
    isPreviewMode,
    currentStep,
    state.letterRaw,
    state.strategy,
    state.analysis,
    state.letterType,
    onStep6GenerateLetter,
  ]);

  const onLetterChange = useCallback((text: string) => {
    setState((s) => ({ ...s, letterRaw: text }));
  }, []);

  const onLetterPlaceholdersChange = useCallback(
    (patch: Partial<LetterPlaceholderFields>) => {
      setState((s) => ({
        ...s,
        letterPlaceholders: { ...s.letterPlaceholders, ...patch },
      }));
    },
    []
  );

  const onWizardStartOver = useCallback(() => {
    setState((s) => ({
      ...initialWizardState(),
      accessToken: s.accessToken,
      sessionReady: s.sessionReady,
    }));
    setAutoExtractedFields(new Set());
    setCurrentStep(1);
    announce("Wizard reset to Step 1.");
  }, [announce]);

  const onStrategyChange = useCallback((code: string) => {
    setState((s) => {
      const primary =
        categoriesInDocumentOrder(s.documents)[0] ?? "BUILDING";
      return withDerived(s, {
        strategies: { ...s.strategies, [primary]: code },
        strategy: code,
      });
    });
  }, []);

  useEffect(() => {
    if (currentStep !== 4) {
      step4StrategyAutoAppliedRef.current = false;
      return;
    }
    if (step4StrategyAutoAppliedRef.current) return;
    step4StrategyAutoAppliedRef.current = true;
    setState((s) => {
      if (s.strategy !== null) return s;
      const rec =
        typeof s.analysis?.recommendedStrategy === "string"
          ? s.analysis.recommendedStrategy.trim()
          : "";
      if (!rec) return s;
      const primary =
        categoriesInDocumentOrder(s.documents)[0] ?? "BUILDING";
      return withDerived(s, {
        strategies: { ...s.strategies, [primary]: rec },
        strategy: rec,
      });
    });
    return () => {
      step4StrategyAutoAppliedRef.current = false;
    };
  }, [currentStep]);

  const stepLabels = useMemo(
    () => [
      "Input",
      "Analysis",
      "Comparison",
      "Strategy",
      "Summary",
      "Letter",
    ],
    []
  );

  return (
    <div className="erp-wizard-shell flex min-h-screen flex-col bg-[#0f2744]">
      {!isPreviewMode && <PostPaymentSessionRefresh />}
      <header className="sticky top-0 z-[100] border-b border-[#1e3f6e] bg-[#091c33] text-white">
        <div className="mx-auto flex min-h-12 max-w-6xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6 sm:py-0">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2"
            aria-label="Estimate Review Pro home"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f0a050]">
              <span className="text-xs font-black text-white">ER</span>
            </div>
            <span className="truncate text-xs font-semibold text-[#e8f0f8] sm:text-sm">
              Estimate Review Pro
            </span>
          </Link>
          <nav className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 text-[11px] font-medium sm:ml-auto sm:w-auto sm:gap-3 sm:text-sm">
            {isPreviewMode ? (
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
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className="shrink-0 text-[#8aacc8] transition hover:text-[#e8f0f8]"
                >
                  Dashboard
                </Link>
                <Link
                  href="/pricing"
                  className="shrink-0 rounded-full bg-[#2563EB] px-2.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-[#2563EB]/40 transition hover:bg-[#1E40AF] sm:px-4 sm:py-2 sm:text-sm"
                >
                  Buy another review
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="erp-btn-ghost shrink-0 text-center"
                >
                  Log out
                </button>
              </>
            )}
          </nav>
        </div>
        {premierUsageWall === "ok" && (
        <div>
          <div className="mx-auto max-w-6xl px-2 py-2 sm:px-6">
            <nav
              id="erp-wizard-step-indicator"
              className="flex flex-wrap items-end justify-center gap-x-1.5 gap-y-1 sm:gap-5"
              aria-label="Wizard steps"
            >
              {stepLabels.map((label, i) => {
                const n = i + 1;
                const isActive = n === currentStep;
                const isDone = n < currentStep;
                const navigable = stepIsNavigable(
                  n,
                  state.analysis,
                  state.comparison,
                  state.letterRaw,
                  currentStep
                );
                const circleClass = `flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none ${
                  isActive
                    ? "bg-[#f0a050] text-white"
                    : isDone
                      ? "bg-[#2c5a8a] text-[#a8c8e8]"
                      : "bg-[#1e3f6e] text-[#6a8fb8]"
                }`;
                const labelClass = `whitespace-nowrap text-xs font-semibold ${
                  isActive
                    ? "text-white"
                    : isDone
                      ? "text-[#8aacc8]"
                      : "text-[#6a8fb8]"
                }`;
                const barClass = `flex flex-col items-center border-b-2 pb-1.5 ${
                  isActive ? "border-[#f0a050]" : "border-transparent"
                }`;
                const inner = (
                  <div className="flex items-center gap-2">
                    <span className={circleClass}>{n}</span>
                    <span
                      className={`${labelClass} ${
                        navigable
                          ? "underline decoration-current/40 underline-offset-2"
                          : ""
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
                return (
                  <div key={n} className={barClass}>
                    {navigable ? (
                      <button
                        type="button"
                        id={`erp-wizard-step-${n}-nav`}
                        className="flex cursor-pointer flex-col items-center rounded-sm opacity-100 outline-none transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[#f0a050] focus-visible:ring-offset-2 focus-visible:ring-offset-[#091c33]"
                        aria-current={isActive ? "step" : undefined}
                        aria-label={`Go to step ${n}: ${label}`}
                        onClick={() => {
                          setCurrentStep(n);
                          announce(`Step ${n}. ${label}.`);
                        }}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div
                        className="flex cursor-default flex-col items-center opacity-55"
                        aria-current={isActive ? "step" : undefined}
                      >
                        {inner}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e8e8e4]"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-[#f0a050] transition-[width] duration-300 ease-out"
                style={{ width: `${(currentStep / 6) * 100}%` }}
              />
            </div>
          </div>
        </div>
        )}
      </header>

      {premierUsageWall === "checking" ? (
      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col items-center justify-center px-3 py-10 text-[#e8f0f8] sm:px-6">
        <p className="text-sm text-[#8aacc8]">Loading…</p>
      </main>
      ) : premierUsageWall === "blocked" ? (
      <main className="relative mx-auto flex w-full max-w-[1100px] flex-1 flex-col items-center justify-center px-3 py-16 text-[#e8f0f8] sm:px-6">
        <div
          className="pointer-events-none absolute inset-0 bg-[#0a1f35]/80"
          aria-hidden
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscription-usage-heading"
          className="relative z-10 w-full max-w-lg rounded-2xl border border-[#1e3f6e] bg-[#091c33] px-8 py-10 text-center shadow-2xl shadow-black/40"
        >
          <h2
            id="subscription-usage-heading"
            className="text-xl font-bold text-[#e8f0f8]"
          >
            Out of reviews for this period
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#8aacc8]">
            You&apos;ve used all your reviews for this period. Purchase
            additional reviews or upgrade your plan.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-lg bg-[#f0a050] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95"
            >
              View plans
            </Link>
          </div>
        </div>
      </main>
      ) : (
      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col px-3 py-10 text-[#e8f0f8] sm:px-6">
        <div
          id="erp-wizard-root"
          className="relative flex flex-col gap-8 border-0 bg-transparent px-0 py-0 [color-scheme:light]"
          data-access-token={state.accessToken === "bypass" ? "bypass" : "set"}
        >
          <div
            id="erp-wizard-live-region"
            ref={liveRegionRef}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="absolute m-[-1px] h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap"
          />

          <form
            onSubmit={onSubmitStep1}
            className="space-y-8"
            noValidate
            hidden={currentStep !== 1}
          >
            <section
              id="erp-step1-panel"
              className="rounded-xl border-0 bg-transparent p-0 shadow-none"
              aria-labelledby="erp-step1-heading"
              hidden={currentStep !== 1}
            >
              <h2
                id="erp-step1-heading"
                className="text-2xl font-bold text-[#e8f0f8]"
              >
                Step 1 — Input
              </h2>
              <p className="mt-2 text-sm text-[#6a8fb8]">
                Add up to 10 estimate documents (carrier, contractor, or other
                sides), then complete claim metadata. Structured findings only.
              </p>

              <div className="mt-8 space-y-10">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#a8c4e0]">
                    Claim documents
                  </h3>
                  <div className="mt-4 space-y-6">
                    {state.documents.map((doc, idx) => (
                      <div
                        key={doc.id}
                        id={`erp-step1-doc-${idx}`}
                        className="rounded-[10px] border border-[#e4e4e4] bg-[#f8f8f8] p-4 md:p-5"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#1a2a3a]">
                            Document {idx + 1}
                          </span>
                          <button
                            type="button"
                            disabled={state.documents.length <= 1}
                            onClick={() => removeDocumentSlot(doc.id)}
                            className="text-xs font-medium text-[#b83030] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <span className="mb-2 block text-sm font-medium text-[#4a5a6a]">
                              File (PDF, images, or .txt)
                            </span>
                            <div
                              role="button"
                              tabIndex={0}
                              aria-label={`Choose file for document ${idx + 1}`}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  fileInputRefs.current[doc.id]?.click();
                                }
                              }}
                              onClick={() =>
                                fileInputRefs.current[doc.id]?.click()
                              }
                              onDragEnter={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDocDragOverIndex(idx);
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = "copy";
                                setDocDragOverIndex(idx);
                              }}
                              onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (
                                  e.currentTarget.contains(
                                    e.relatedTarget as Node | null
                                  )
                                ) {
                                  return;
                                }
                                setDocDragOverIndex((cur) =>
                                  cur === idx ? null : cur
                                );
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDocDragOverIndex(null);
                                const f = e.dataTransfer.files?.[0] ?? null;
                                if (!f) return;
                                if (isStep1AcceptedEstimateFile(f)) {
                                  void readDocumentFile(doc.id, f);
                                } else {
                                  announce(
                                    "That file type is not accepted. Use PDF, PNG, JPG, JPEG, WEBP, or .txt."
                                  );
                                }
                              }}
                              className={`block cursor-pointer rounded-lg border-[1.5px] border-dashed px-4 py-8 text-center text-sm text-[#4a5a6a] transition-colors ${
                                docDragOverIndex === idx
                                  ? "border-[#f0a050] bg-white"
                                  : "border-[#cccccc] bg-white hover:border-[#f0a050]/70"
                              }`}
                            >
                              Drag and drop PDF, image, or .txt file here, or
                              click to browse
                            </div>
                            <input
                              id={step1DocFileInputId(idx)}
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,text/plain"
                              className="pointer-events-none sr-only"
                              ref={(el) => {
                                fileInputRefs.current[doc.id] = el;
                              }}
                              onChange={(ev) => {
                                const f = ev.target.files?.[0] ?? null;
                                if (f) void readDocumentFile(doc.id, f);
                              }}
                            />
                          </div>
                          <p
                            id={step1DocExtractStatusId(idx)}
                            className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${extractStatusClassName(doc)}`}
                          >
                            {doc.extractStatus === "extracting" && (
                              <span
                                className="inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                                aria-hidden
                              />
                            )}
                            <span>{extractStatusMessage(doc)}</span>
                          </p>
                          {idx === 0 && (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => setShowXactimateHelp((v) => !v)}
                                className="text-xs text-[#6a8fb8] hover:text-[#f0a050] underline-offset-2 hover:underline focus:outline-none"
                              >
                                {showXactimateHelp
                                  ? "Hide Xactimate export guide ▲"
                                  : "Using Xactimate? See how to export →"}
                              </button>
                              {showXactimateHelp && (
                                <div
                                  id="erp-step1-xactimate-help"
                                  className="mt-2 rounded-[10px] border-[0.5px] border-[#e4e4e4] bg-white p-4 text-sm text-[#7a8a9a]"
                                >
                                  <p className="mb-2 font-medium text-[#2a3a4a]">
                                    Exporting from Xactimate
                                  </p>
                                  <ol className="list-inside list-decimal space-y-1">
                                    <li>Open your estimate in Xactimate</li>
                                    <li>
                                      Click{" "}
                                      <span className="font-medium">
                                        File → Print → Save as PDF
                                      </span>
                                    </li>
                                    <li>
                                      Upload that PDF using the drop zone above
                                    </li>
                                  </ol>
                                  <p className="mb-1 mt-3 font-medium text-[#2a3a4a]">
                                    Or paste directly:
                                  </p>
                                  <ol className="list-inside list-decimal space-y-1">
                                    <li>In Xactimate, select all line items</li>
                                    <li>
                                      Copy (
                                      <span className="font-medium">
                                        Ctrl+C
                                      </span>
                                      )
                                    </li>
                                    <li>Paste into the text field below</li>
                                  </ol>
                                  <p className="mt-3 border-t border-[#ebebea] pt-2 text-xs text-[#7a8a9a]">
                                    ESX files cannot be read directly — PDF or
                                    paste export required.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          <div>
                            <label
                              htmlFor={step1DocPasteId(idx)}
                              className="mb-2 block text-sm font-medium text-[#4a5a6a]"
                            >
                              {doc.side === "CARRIER"
                                ? "Paste carrier estimate text"
                                : "Paste estimate text"}
                            </label>
                            <textarea
                              id={step1DocPasteId(idx)}
                              name={step1DocPasteId(idx)}
                              rows={idx === 0 ? 8 : 6}
                              className="w-full rounded-lg border-[0.5px] border-[#d8d8d8] bg-white px-3 py-2 font-mono text-sm text-[#2a3a4a] placeholder:text-[#4a5a6a]/70 focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                              placeholder={
                                doc.side === "CARRIER"
                                  ? "Paste line items and totals…"
                                  : "Paste contractor, PA, or other estimate text"
                              }
                              value={doc.extractedText}
                              onChange={(ev) =>
                                updateDocumentText(doc.id, ev.target.value)
                              }
                            />
                          </div>
                          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="min-w-0">
                              <label
                                className="mb-1 block text-xs font-medium text-[#4a5a6a]"
                                htmlFor={`erp-step1-doc-${idx}-side`}
                              >
                                Side
                              </label>
                              <select
                                id={`erp-step1-doc-${idx}-side`}
                                className="w-full min-w-0 rounded-lg border-[0.5px] border-[#d8d8d8] bg-white px-2 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                                value={doc.side}
                                onChange={(e) =>
                                  updateDocumentSide(
                                    doc.id,
                                    e.target.value as ClaimDocumentSide
                                  )
                                }
                              >
                                {SIDE_OPTIONS.map((o) => (
                                  <option
                                    key={o.value}
                                    value={o.value}
                                    className="bg-white text-[#2a3a4a]"
                                  >
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="min-w-0">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <label
                                  className="text-xs font-medium text-[#4a5a6a]"
                                  htmlFor={`erp-step1-doc-${idx}-category`}
                                >
                                  Category
                                </label>
                                {doc.autoDetected && (
                                  <span className="rounded bg-[#fdf0d5] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#4a5a6a]">
                                    Auto-detected
                                  </span>
                                )}
                              </div>
                              <select
                                id={`erp-step1-doc-${idx}-category`}
                                className="w-full min-w-0 rounded-lg border-[0.5px] border-[#d8d8d8] bg-white px-2 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                                value={categorySelectValue(doc.category)}
                                onChange={(e) =>
                                  updateDocumentCategory(
                                    doc.id,
                                    e.target.value as ClaimDocumentCategory
                                  )
                                }
                              >
                                {CATEGORY_OPTIONS.map((o) => (
                                  <option
                                    key={o.value}
                                    value={o.value}
                                    className="bg-white text-[#2a3a4a]"
                                  >
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="min-w-0">
                              <label
                                className="mb-1 block text-xs font-medium text-[#4a5a6a]"
                                htmlFor={`erp-step1-doc-${idx}-version`}
                              >
                                Version
                              </label>
                              <select
                                id={`erp-step1-doc-${idx}-version`}
                                className="w-full min-w-0 rounded-lg border-[0.5px] border-[#d8d8d8] bg-white px-2 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                                value={versionSelectValue(doc.version)}
                                onChange={(e) =>
                                  updateDocumentVersion(
                                    doc.id,
                                    e.target.value as ClaimDocumentVersion
                                  )
                                }
                              >
                                {VERSION_OPTIONS.map((o) => (
                                  <option
                                    key={o.value}
                                    value={o.value}
                                    className="bg-white text-[#2a3a4a]"
                                  >
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                              <label
                                className="mb-1 block text-xs font-medium text-[#4a5a6a]"
                                htmlFor={`erp-step1-doc-${idx}-label`}
                              >
                                Label{" "}
                                <span className="font-normal text-[#4a5a6a]/80">
                                  (optional)
                                </span>
                              </label>
                              <input
                                id={`erp-step1-doc-${idx}-label`}
                                type="text"
                                className="w-full max-w-md rounded-md border-[0.5px] border-[#d8d8d8] bg-white px-2 py-1 text-sm font-normal text-[#2a3a4a] placeholder:text-[#4a5a6a]/70 focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                                placeholder="Optional note — defaults from selections"
                                value={doc.label}
                                onChange={(e) =>
                                  updateDocumentLabel(doc.id, e.target.value)
                                }
                              />
                              <p className="mt-1 text-xs text-[#4a5a6a]">
                                {documentSideSubtitle(doc.side)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      id="erp-step1-add-document"
                      type="button"
                      disabled={state.documents.length >= 10}
                      onClick={addDocumentSlot}
                      className="erp-btn-ghost disabled:cursor-not-allowed"
                    >
                      Add Document
                    </button>
                  </div>
                </div>

                <div className="rounded-[10px] border border-[#e4e4e4] bg-[#f8f8f8] p-4 md:p-5 space-y-6">
                <div>
                  <label
                    htmlFor="erp-step1-insured-name"
                    className="mb-2 block text-sm font-medium text-[#4a5a6a]"
                  >
                    Insured name <span className="text-[#b83030]">*</span>
                    {autoExtractedFields.has("insuredName") && (
                      <span className="ml-2 text-xs font-normal text-[#4a5a6a]">
                        Auto-extracted
                      </span>
                    )}
                  </label>
                  <input
                    id="erp-step1-insured-name"
                    type="text"
                    required
                    autoComplete="name"
                    className="w-full max-w-xl rounded-lg border-[0.5px] border-[#d8d8d8] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                    value={state.claimMeta.insuredName}
                    onChange={(e) =>
                      patchClaimMeta({ insuredName: e.target.value })
                    }
                  />
                </div>

                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#a8c4e0]">
                    Claim metadata
                  </h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="erp-step1-claim-type"
                        className="mb-2 block text-sm font-medium text-[#4a5a6a]"
                      >
                        Claim type <span className="text-[#b83030]">*</span>
                      </label>
                      <select
                        id="erp-step1-claim-type"
                        required
                        className="w-full rounded-lg border-[0.5px] border-[#d8d8d8] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                        value={state.claimMeta.claimType}
                        onChange={(e) =>
                          patchClaimMeta({ claimType: e.target.value })
                        }
                      >
                        <option value="">Select…</option>
                        <option value="property">Property</option>
                        <option value="auto">Auto</option>
                        <option value="commercial">Commercial</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="erp-step1-state"
                        className="mb-2 block text-sm font-medium text-[#4a5a6a]"
                      >
                        State <span className="text-[#b83030]">*</span>
                      </label>
                      <select
                        id="erp-step1-state"
                        required
                        className="w-full rounded-lg border-[0.5px] border-[#d8d8d8] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                        value={state.claimMeta.state}
                        onChange={(e) =>
                          patchClaimMeta({ state: e.target.value })
                        }
                      >
                        <option value="">Select…</option>
                        {US_STATES.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="erp-step1-policy-number"
                        className="mb-2 block text-sm font-medium text-[#4a5a6a]"
                      >
                        Policy number <span className="text-[#b83030]">*</span>
                        {autoExtractedFields.has("policyNumber") && (
                          <span className="ml-2 text-xs font-normal text-[#4a5a6a]">
                            Auto-extracted
                          </span>
                        )}
                      </label>
                      <input
                        id="erp-step1-policy-number"
                        type="text"
                        required
                        autoComplete="off"
                        className="w-full rounded-lg border-[0.5px] border-[#d8d8d8] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                        value={state.claimMeta.policyNumber}
                        onChange={(e) =>
                          patchClaimMeta({ policyNumber: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="erp-step1-claim-number"
                        className="mb-2 block text-sm font-medium text-[#4a5a6a]"
                      >
                        Claim number <span className="text-[#b83030]">*</span>
                        {autoExtractedFields.has("claimNumber") && (
                          <span className="ml-2 text-xs font-normal text-[#4a5a6a]">
                            Auto-extracted
                          </span>
                        )}
                      </label>
                      <input
                        id="erp-step1-claim-number"
                        type="text"
                        required
                        autoComplete="off"
                        className="w-full rounded-lg border-[0.5px] border-[#d8d8d8] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                        value={state.claimMeta.claimNumber}
                        onChange={(e) =>
                          patchClaimMeta({ claimNumber: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="erp-step1-date-of-loss"
                        className="mb-2 block text-sm font-medium text-[#4a5a6a]"
                      >
                        Date of loss <span className="text-[#b83030]">*</span>
                        {autoExtractedFields.has("dateOfLoss") && (
                          <span className="ml-2 text-xs font-normal text-[#4a5a6a]">
                            Auto-extracted
                          </span>
                        )}
                      </label>
                      <input
                        id="erp-step1-date-of-loss"
                        type="date"
                        required
                        className="w-full rounded-lg border-[0.5px] border-[#d8d8d8] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                        value={state.claimMeta.dateOfLoss}
                        onChange={(e) =>
                          patchClaimMeta({ dateOfLoss: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="erp-step1-adjuster-name"
                        className="mb-2 block text-sm font-medium text-[#4a5a6a]"
                      >
                        Adjuster name
                        {autoExtractedFields.has("adjusterName") && (
                          <span className="ml-2 text-xs font-normal text-[#4a5a6a]">
                            Auto-extracted
                          </span>
                        )}
                      </label>
                      <input
                        id="erp-step1-adjuster-name"
                        type="text"
                        autoComplete="off"
                        className="w-full rounded-lg border-[0.5px] border-[#d8d8d8] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                        value={state.claimMeta.adjusterName}
                        onChange={(e) =>
                          patchClaimMeta({ adjusterName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="erp-step1-carrier-name"
                        className="mb-2 block text-sm font-medium text-[#4a5a6a]"
                      >
                        Carrier name
                        {autoExtractedFields.has("carrierName") && (
                          <span className="ml-2 text-xs font-normal text-[#4a5a6a]">
                            Auto-extracted
                          </span>
                        )}
                      </label>
                      <input
                        id="erp-step1-carrier-name"
                        type="text"
                        autoComplete="organization"
                        className="w-full rounded-lg border-[0.5px] border-[#d8d8d8] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                        value={state.claimMeta.carrierName}
                        onChange={(e) =>
                          patchClaimMeta({ carrierName: e.target.value })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label
                        htmlFor="erp-step1-response-deadline"
                        className="mb-2 block text-sm font-medium text-[#4a5a6a]"
                      >
                        Response deadline (optional)
                      </label>
                      <input
                        id="erp-step1-response-deadline"
                        type="date"
                        className="w-full max-w-xs rounded-lg border-[0.5px] border-[#d8d8d8] bg-white px-3 py-2 text-sm text-[#2a3a4a] focus:border-[#f0a050] focus:outline-none focus:ring-1 focus:ring-[#f0a050]"
                        value={state.claimMeta.responseDeadline}
                        onChange={(e) =>
                          patchClaimMeta({ responseDeadline: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
                </div>

                {submitError && (
                  <p
                    className="rounded-[10px] border border-[#e4e4e4] bg-[#fce8e8] px-4 py-3 text-sm text-[#8a2020]"
                    role="alert"
                  >
                    {submitError}
                  </p>
                )}

                {isPreviewMode && handlePreviewUnlock && (
                  <PreviewPaywallBlock
                    onUnlock={handlePreviewUnlock}
                    busy={previewUnlockBusy}
                  />
                )}

                <div className="flex flex-wrap items-center gap-4 border-t-[0.5px] border-[#1e3f6e] pt-6">
                  <button
                    id="erp-step1-load-demo"
                    type="button"
                    className="erp-btn-ghost"
                    onClick={onLoadDemo}
                  >
                    Load Demo Estimate
                  </button>
                  <button
                    id="erp-step1-reset"
                    type="button"
                    className="erp-btn-ghost"
                    onClick={onResetStep1}
                  >
                    Clear Step 1
                  </button>
                  <button
                    id="erp-step1-submit"
                    type="submit"
                    disabled={submitLoading || !state.sessionReady}
                    className="erp-btn-cta disabled:cursor-not-allowed"
                  >
                    {submitLoading ? "Analyzing…" : "Continue"}
                  </button>
                </div>
              </div>
            </section>
          </form>

          <section
            id="erp-step2-panel"
            hidden={currentStep !== 2}
            aria-hidden={currentStep !== 2}
            className="rounded-[10px] border-[0.5px] border-[#e4e4e4] bg-white px-[18px] py-4 text-[#2a3a4a] md:px-[18px] md:py-4"
          >
            <Step2AnalysisPanel
              analysis={state.analysis}
              comparison={state.comparison}
              onBack={onStep2Back}
              onNext={onStep2Next}
              announce={announce}
              isPreviewMode={isPreviewMode}
              wizardApiFetch={wizardFetch}
              onPreviewUnlock={handlePreviewUnlock}
              previewUnlockBusy={previewUnlockBusy}
            />
          </section>
          <section
            id="erp-step3-panel"
            hidden={currentStep !== 3}
            aria-hidden={currentStep !== 3}
            className="rounded-[10px] border-[0.5px] border-[#e4e4e4] bg-white px-[18px] py-4 text-[#2a3a4a] md:px-[18px] md:py-4"
          >
            <Step3ComparisonPanel
              comparison={state.comparison}
              claimMeta={{
                insuredName: state.claimMeta.insuredName,
                policyNumber: state.claimMeta.policyNumber,
                claimNumber: state.claimMeta.claimNumber,
                dateOfLoss: state.claimMeta.dateOfLoss,
              }}
              onBack={onStep3Back}
              onNext={onStep3Next}
              announce={announce}
              isPreviewMode={isPreviewMode}
              wizardApiFetch={wizardFetch}
              onPreviewUnlock={handlePreviewUnlock}
              previewUnlockBusy={previewUnlockBusy}
            />
          </section>
          <section
            id="erp-step4-panel"
            hidden={currentStep !== 4}
            aria-hidden={currentStep !== 4}
            className="rounded-[10px] border-[0.5px] border-[#e4e4e4] bg-white px-[18px] py-4 text-[#2a3a4a] md:px-[18px] md:py-4"
          >
            <Step4StrategyPanel
              analysis={state.analysis}
              strategy={state.strategy}
              onStrategyChange={onStrategyChange}
              onBack={onStep4Back}
              onNext={onStep4Next}
              announce={announce}
              isPreviewMode={isPreviewMode}
              onPreviewUnlock={handlePreviewUnlock}
              previewUnlockBusy={previewUnlockBusy}
            />
          </section>
          <section
            id="erp-step5-panel"
            hidden={currentStep !== 5}
            aria-hidden={currentStep !== 5}
            className="rounded-[10px] border-[0.5px] border-[#e4e4e4] bg-white px-[18px] py-4 text-[#2a3a4a] md:px-[18px] md:py-4"
          >
            <Step5SummaryPanel
              analysis={state.analysis}
              comparison={state.comparison}
              strategy={state.strategy}
              claimMeta={state.claimMeta}
              onBack={onStep5Back}
              onGoToLetter={onStep5GoToLetter}
              onStartOver={onWizardStartOver}
              announce={announce}
              isPreviewMode={isPreviewMode}
              wizardApiFetch={wizardFetch}
              onPreviewUnlock={handlePreviewUnlock}
              previewUnlockBusy={previewUnlockBusy}
            />
          </section>
          <section
            id="erp-step6-panel"
            hidden={currentStep !== 6}
            aria-hidden={currentStep !== 6}
            className="rounded-[10px] border-[0.5px] border-[#e4e4e4] bg-white px-[18px] py-4 text-[#2a3a4a] md:px-[18px] md:py-4"
          >
            <Step6LetterPanel
              active={currentStep === 6}
              letterType={state.letterType}
              onLetterTypeChange={onLetterTypeChange}
              letterRaw={state.letterRaw}
              onLetterChange={onLetterChange}
              letterPlaceholders={state.letterPlaceholders}
              onLetterPlaceholdersChange={onLetterPlaceholdersChange}
              showLetterEditor={state.letterRaw !== null}
              generateLoading={step6LetterLoading}
              onGenerate={onStep6GenerateLetter}
              onBack={onStep6Back}
              onStartOver={onWizardStartOver}
              announce={announce}
              isPreviewMode={isPreviewMode}
              wizardApiFetch={wizardFetch}
              onPreviewUnlock={handlePreviewUnlock}
              previewUnlockBusy={previewUnlockBusy}
            />
          </section>
        </div>
      </main>
      )}
    </div>
  );
}
