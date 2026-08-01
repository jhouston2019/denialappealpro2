"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DenialDocumentDropZone from "@/components/wizard/DenialDocumentDropZone";
import { PostPaymentSessionRefresh } from "@/components/billing/PostPaymentSessionRefresh";
import { netlifyFunctionUrl } from "@/lib/netlify-function-url";
import {
  clearCompletedReviewSession,
  DELIVERABLES_REVIEW_ID_KEY,
  PAID_RESUME_SESSION_KEY,
  UPLOAD_NEW_REVIEW_HREF,
} from "@/lib/wizard-snapshot";
import {
  DAP_WIZARD_RESUME_KEY,
  DAP_WIZARD_STATE_KEY,
  emptyConfidence,
  readDapWizardResume,
  tryParseDapWizardSnapshot,
  writeDapWizardResume,
  writeDapWizardState,
  type DapConfidenceMap,
  type DapWizardSnapshot,
} from "@/lib/dap-wizard-snapshot";
import { DEFAULT_ENCLOSURES } from "@/lib/appeal/ledger/keys";
import { ensureLedger } from "@/lib/appeal/ledger/intakeToLedger";
import type { EnclosureItem, FactLedger } from "@/lib/appeal/ledger/types";
import { routeDenial } from "@/lib/appeal/router/index";
import { emptyIntake, type DenialIntake } from "@/lib/wizard/denialIntakeEngine";
import {
  mapExtractedToIntake,
  type ExtractDenialResponse,
} from "@/lib/wizard/mapExtractedToIntake";
import {
  createSupabaseBrowserClient,
  wizardFetch,
} from "@/lib/supabaseClient";
import { Step2ExtractionPanel } from "./step2-extraction-panel";
import {
  isValidNpi,
  loadUserProviderProfile,
  mergeProviderProfileIntoIntake,
  saveUserProviderProfile,
} from "@/lib/user-provider-profile";
import { Step3ConfirmPanel } from "./step3-confirm-panel";
import { Step4GeneratePanel } from "./step4-generate-panel";
import { Step1BulkUploadPanel } from "./step1-bulk-upload-panel";
import { Step1RecentAppeals } from "./step1-recent-appeals";
import "./dap-wizard.css";

function defaultEnclosures(): EnclosureItem[] {
  return DEFAULT_ENCLOSURES.map((e) => ({
    id: e.id,
    label: e.label,
    checked: false,
  }));
}

const WIZARD_PANEL =
  "rounded-[10px] border-[0.5px] border-[#e4e4e4] bg-white px-[18px] py-4 text-[#2a3a4a] md:px-[18px] md:py-4";

const STEP_LABELS = ["Upload", "Review", "Confirm", "Generate"];

type UploadWizardClientProps = {
  isPreviewMode?: boolean;
  initialStep?: number;
  initialReviewId?: string;
  startFreshReview?: boolean;
};

function buildSnapshot(
  currentStep: number,
  intake: DenialIntake,
  confidence: DapConfidenceMap,
  uploadedFileName: string | null,
  ledger: FactLedger | null
): DapWizardSnapshot {
  return {
    v: 1,
    currentStep,
    intake,
    confidence,
    ledger,
    uploadedFileName,
  };
}

export default function UploadWizardClient({
  isPreviewMode = false,
  initialStep = 1,
  initialReviewId,
  startFreshReview = false,
}: UploadWizardClientProps = {}) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(() =>
    Math.min(4, Math.max(1, initialStep))
  );
  const [intake, setIntake] = useState<DenialIntake>(() => emptyIntake());
  const [confidence, setConfidence] = useState<DapConfidenceMap>(() =>
    emptyConfidence()
  );
  const [ledger, setLedger] = useState<FactLedger | null>(null);
  const [enclosures, setEnclosures] = useState<EnclosureItem[]>(() =>
    defaultEnclosures()
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [inputTab, setInputTab] = useState<"upload" | "paste" | "bulk">("upload");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [previewUnlockBusy, setPreviewUnlockBusy] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string) => {
    const el = liveRegionRef.current;
    if (!el) return;
    el.textContent = "";
    requestAnimationFrame(() => {
      el.textContent = message;
    });
  }, []);

  const persistState = useCallback(
    (step: number, fileName: string | null = uploadedFile?.name ?? null) => {
      const nextLedger = ledger
        ? { ...ledger, enclosures }
        : ledger;
      writeDapWizardState(
        buildSnapshot(step, intake, confidence, fileName, nextLedger)
      );
    },
    [confidence, enclosures, intake, ledger, uploadedFile]
  );

  useEffect(() => {
    if (startFreshReview && typeof window !== "undefined") {
      clearCompletedReviewSession();
      window.sessionStorage.removeItem(DAP_WIZARD_STATE_KEY);
      window.sessionStorage.removeItem(DAP_WIZARD_RESUME_KEY);
    }
  }, [startFreshReview]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const resume = readDapWizardResume();
    const stored = tryParseDapWizardSnapshot(
      window.sessionStorage.getItem(DAP_WIZARD_STATE_KEY)
    );
    const snap = resume || stored;
    if (!snap) return;
    setIntake(snap.intake);
    setConfidence(snap.confidence);
    if (snap.ledger) {
      setLedger(snap.ledger);
      if (snap.ledger.enclosures?.length) {
        setEnclosures(snap.ledger.enclosures);
      }
    }
    setCurrentStep(Math.min(4, Math.max(1, snap.currentStep)));
  }, []);

  useEffect(() => {
    persistState(currentStep);
  }, [currentStep, intake, confidence, ledger, enclosures, persistState]);

  useEffect(() => {
    let cancelled = false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      setSessionReady(true);
      setIsAuthenticated(false);
      setIsPaid(!isPreviewMode);
      return () => {
        cancelled = true;
      };
    }

    const supabase = createSupabaseBrowserClient();

    const refreshAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const authed = Boolean(data.session?.user?.id);
      setIsAuthenticated(authed);

      if (isPreviewMode) {
        setIsPaid(false);
        setSessionReady(true);
        return;
      }

      if (!authed) {
        setIsPaid(false);
        setSessionReady(true);
        return;
      }

      const userId = data.session!.user!.id;

      try {
        const profile = await loadUserProviderProfile(supabase, userId);
        if (profile) {
          setIntake((prev) => mergeProviderProfileIntoIntake(prev, profile));
        }
      } catch {
        // Provider profile columns may not exist until migration is applied.
      }

      const pendingPostPayment =
        window.sessionStorage.getItem(PAID_RESUME_SESSION_KEY) === "true" ||
        Boolean(initialReviewId?.trim()) ||
        Boolean(window.sessionStorage.getItem(DELIVERABLES_REVIEW_ID_KEY));

      if (pendingPostPayment) {
        setIsPaid(true);
        setSessionReady(true);
        return;
      }

      const { data: userRow } = await supabase
        .from("users")
        .select("plan_type")
        .eq("id", userId)
        .maybeSingle();

      const plan = userRow?.plan_type;
      setIsPaid(Boolean(plan) || !isPreviewMode);
      setSessionReady(true);
    };

    void refreshAuth();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshAuth();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [initialReviewId, isPreviewMode]);

  const applyExtraction = useCallback(
    (payload: ExtractDenialResponse) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[Step 2] extract-denial raw response:", payload);
      }
      const mapped = mapExtractedToIntake(payload);
      setIntake((prev) => ({
        ...mapped.intake,
        providerName: mapped.intake.providerName || prev.providerName,
        providerNpi: mapped.intake.providerNpi || prev.providerNpi,
        providerAddress: mapped.intake.providerAddress || prev.providerAddress,
        providerPhone: mapped.intake.providerPhone || prev.providerPhone,
        providerFax: mapped.intake.providerFax || prev.providerFax,
        signerName: mapped.intake.signerName || prev.signerName,
        signerTitle: mapped.intake.signerTitle || prev.signerTitle,
        signerCredentials:
          mapped.intake.signerCredentials || prev.signerCredentials,
        signerPhone: mapped.intake.signerPhone || prev.signerPhone,
      }));
      setConfidence(mapped.confidence);
      if (mapped.ledger) {
        setLedger(mapped.ledger);
        if (mapped.ledger.enclosures?.length) {
          setEnclosures(mapped.ledger.enclosures);
        }
      }
      setCurrentStep(2);
      announce("Extraction complete. Review the fields below.");
    },
    [announce]
  );

  const runTextExtraction = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setExtracting(true);
      setExtractError(null);
      try {
        const res = await fetch("/api/extract-denial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        });
        const payload = (await res.json()) as ExtractDenialResponse;
        if (!res.ok || !payload.success) {
          throw new Error(payload.error || payload.message || "Extraction failed");
        }
        applyExtraction(payload);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Could not extract denial data.";
        setExtractError(msg);
        announce(msg);
      } finally {
        setExtracting(false);
      }
    },
    [announce, applyExtraction]
  );

  const handlePreviewUnlock = useCallback(async () => {
    if (typeof window === "undefined") return;
    setPreviewUnlockBusy(true);
    try {
      writeDapWizardResume(
        buildSnapshot(
          currentStep,
          intake,
          confidence,
          uploadedFile?.name ?? null,
          ledger ? { ...ledger, enclosures } : ledger
        )
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
  }, [announce, confidence, currentStep, enclosures, intake, ledger, uploadedFile]);

  const handleStep3Continue = useCallback(async () => {
    const nextLedger = ensureLedger(ledger, intake, enclosures);
    const route = routeDenial(nextLedger);
    const signerName =
      intake.signerName?.trim() || intake.providerName?.trim() || "";
    if (route.strategy.id === "authorization" && !intake.authBranch) {
      announce("Select authorization status before continuing.");
      return;
    }
    if (
      !intake.providerName?.trim() ||
      !isValidNpi(intake.providerNpi) ||
      !intake.providerAddress?.trim() ||
      !intake.providerPhone?.trim() ||
      !signerName ||
      !intake.signerTitle?.trim()
    ) {
      const npiEntered = Boolean(intake.providerNpi?.trim());
      announce(
        npiEntered && !isValidNpi(intake.providerNpi)
          ? "Provider NPI must be exactly 10 digits before continuing."
          : "Complete provider name, NPI, address, phone, and signer title before continuing."
      );
      return;
    }
    if (route.strategy.id === "bundling" && !intake.bundlingBranch) {
      announce("Select separate billing basis before continuing.");
      return;
    }
    if (route.strategy.id === "timely-filing" && !intake.timelyFilingBranch) {
      announce("Select timely filing basis before continuing.");
      return;
    }
    if (
      route.strategy.id === "medical-necessity" &&
      !intake.primaryDiagnosis?.trim()
    ) {
      announce("Primary diagnosis is required for medical necessity appeals.");
      return;
    }
    if (intake.planType == null) {
      announce("Select plan type before continuing.");
      return;
    }
    const icdFromDoc =
      ledger?.facts?.["claim.icd10Codes"]?.provenance === "document" &&
      (ledger?.facts?.["claim.icd10Codes"]?.value != null);
    if (!icdFromDoc && !intake.icdCodes.length) {
      announce(
        "Enter ICD-10 diagnosis code(s) before continuing — they were not extracted from the document."
      );
      return;
    }
    setLedger(nextLedger);
    if (isAuthenticated) {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;
        if (userId) {
          await saveUserProviderProfile(supabase, userId, intake);
        }
      } catch {
        // Provider profile columns may not exist until migration is applied.
      }
    }
    if (isPreviewMode || !isAuthenticated || !isPaid) {
      writeDapWizardResume(
        buildSnapshot(
          3,
          intake,
          confidence,
          uploadedFile?.name ?? null,
          nextLedger
        )
      );
      router.push("/pricing");
      return;
    }
    setCurrentStep(4);
  }, [
    confidence,
    enclosures,
    intake,
    isAuthenticated,
    isPaid,
    isPreviewMode,
    ledger,
    router,
    uploadedFile,
  ]);

  const handleGenerate = useCallback(async () => {
    if (!isValidNpi(intake.providerNpi)) {
      announce("Provider NPI must be exactly 10 digits before generating.");
      return;
    }
    setGenerateLoading(true);
    try {
      const factLedger = ensureLedger(ledger, intake, enclosures);
      setLedger(factLedger);

      const body = {
        ledger: factLedger,
        // Legacy fields retained for backward-compatible logging only.
        patientName: intake.patientName,
        providerName: intake.providerName,
        providerNpi: intake.providerNpi,
        payerName: intake.payer,
        claimNumber: intake.claimNumber,
        dateOfService: intake.dateOfService,
        denialReason: intake.denialReason,
        carcCodes: intake.carcCodes,
        rarcCodes: intake.rarcCodes,
        billedAmount: intake.billedAmount,
        paidAmount: intake.paidAmount,
        deniedAmount: intake.deniedAmount,
        icd10Codes: intake.icdCodes,
        cptCodes: intake.cptCodes,
        additionalContext: intake.additionalContext,
        providerAddress: intake.providerAddress,
        providerPhone: intake.providerPhone,
        providerFax: intake.providerFax,
        memberId: intake.memberId,
        signerName: intake.signerName,
        signerTitle: intake.signerTitle,
      };

      const res = await wizardFetch(netlifyFunctionUrl("generate-appeal"), {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        success?: boolean;
        reviewId?: string;
        letterText?: string;
        validationErrors?: Array<{ rule: string; message: string }>;
        error?: string;
      };

      if (!res.ok || !data.success || !data.reviewId) {
        announce(data.error || "Appeal generation failed. Try again.");
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          DELIVERABLES_REVIEW_ID_KEY,
          data.reviewId
        );
      }
      if (data.validationErrors?.length) {
        announce(
          "Letter generated with unresolved gaps — export is blocked until facts are completed."
        );
      } else {
        announce("Appeal letter generated.");
      }
      router.push(`/deliverables?reviewId=${data.reviewId}`);
    } catch (err) {
      announce(
        err instanceof Error ? err.message : "Appeal generation failed."
      );
    } finally {
      setGenerateLoading(false);
    }
  }, [announce, enclosures, intake, ledger, router]);

  const handleLogout = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  const stepLabels = useMemo(() => STEP_LABELS, []);

  const handleInputTabChange = useCallback((tab: "upload" | "paste" | "bulk") => {
    if (tab === inputTab) return;
    setInputTab(tab);
    if (tab === "upload") {
      setPasteText("");
    } else if (tab === "paste") {
      setUploadedFile(null);
      setExtractError(null);
    } else {
      setUploadedFile(null);
      setPasteText("");
      setExtractError(null);
    }
  }, [inputTab]);

  const bulkProviderDefaults = useMemo(
    () => ({
      providerName: intake.providerName,
      providerNpi: intake.providerNpi,
      providerAddress: intake.providerAddress,
      providerPhone: intake.providerPhone,
      providerFax: intake.providerFax,
      signerName: intake.signerName,
      signerTitle: intake.signerTitle,
      signerCredentials: intake.signerCredentials,
      signerPhone: intake.signerPhone,
    }),
    [intake]
  );

  const handlePrefillProviderFromReview = useCallback(
    (patch: Partial<DenialIntake>) => {
      setIntake((prev) => ({
        ...prev,
        ...patch,
      }));
    },
    []
  );

  return (
    <div className="dap-wizard-shell flex min-h-screen flex-col bg-[#0f2744]">
      {!isPreviewMode ? <PostPaymentSessionRefresh /> : null}
      {isPreviewMode ? (
        <div className="border-b border-[#c87830] bg-[#f0a050] px-4 py-2 text-center text-xs font-semibold text-[#091c33] sm:text-sm">
          Free preview — upload and review extraction; unlock to generate your
          appeal letter
        </div>
      ) : null}

      <header className="sticky top-0 z-[100] border-b border-[#1e3f6e] bg-[#091c33] text-white">
        <div className="mx-auto flex min-h-12 max-w-6xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6 sm:py-0">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2"
            aria-label="Denial Appeal Pro home"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f0a050]">
              <span className="text-xs font-black text-white">DAP</span>
            </div>
            <span className="truncate text-xs font-semibold text-[#e8f0f8] sm:text-sm">
              Denial Appeal Pro
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
                  className="shrink-0 rounded-full border border-[#1e3f6e] px-2.5 py-1.5 text-xs font-semibold text-[#e8f0f8] transition hover:border-[#8aacc8] sm:px-4 sm:py-2 sm:text-sm"
                >
                  Dashboard
                </Link>
                <Link
                  href={UPLOAD_NEW_REVIEW_HREF}
                  className="shrink-0 rounded-full bg-[#2563EB] px-2.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-[#2563EB]/40 transition hover:bg-[#1E40AF] sm:px-4 sm:py-2 sm:text-sm"
                >
                  Start New Appeal
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="dap-btn-ghost shrink-0 text-center"
                >
                  Log out
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-3 py-8 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.07em] text-[#8aacc8]">
            Denial appeal wizard
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#e8f0f8]">
            {isPreviewMode ? "Free denial preview" : "Build your appeal"}
          </h1>
        </div>

        <ol className="flex flex-wrap gap-2">
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const active = currentStep === stepNum;
            const done = currentStep > stepNum;
            return (
              <li
                key={label}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  active
                    ? "bg-[#f0a050] text-[#091c33]"
                    : done
                      ? "bg-[#1e3f6e] text-[#e8f0f8]"
                      : "border border-[#1e3f6e] text-[#8aacc8]"
                }`}
              >
                {stepNum}. {label}
              </li>
            );
          })}
        </ol>

        <div ref={liveRegionRef} className="sr-only" role="status" aria-live="polite" />

        {currentStep === 1 ? (
          <section className={WIZARD_PANEL}>
            <h2 className="text-lg font-semibold text-[#1a2a3a]">
              Upload denial letter
            </h2>
            <p className="mt-1 text-sm text-[#5a6a7a]">
              Upload a PDF denial letter or EOB, paste text, or bulk upload up
              to 10 PDFs to extract claim details automatically.
            </p>

            <div className="mt-6">
              <div
                role="tablist"
                aria-label="Denial input method"
                className="dap-input-tabs flex overflow-x-auto border-b border-[#e4e4e4]"
              >
                <button
                  type="button"
                  role="tab"
                  id="denial-input-tab-upload"
                  aria-selected={inputTab === "upload"}
                  aria-controls="denial-input-panel-upload"
                  tabIndex={inputTab === "upload" ? 0 : -1}
                  onClick={() => handleInputTabChange("upload")}
                  className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    inputTab === "upload"
                      ? "border-[#22c55e] text-[#1a2a3a]"
                      : "border-transparent text-[#94a3b8] hover:text-[#5a6a7a]"
                  }`}
                >
                  Upload PDF
                </button>
                <button
                  type="button"
                  role="tab"
                  id="denial-input-tab-paste"
                  aria-selected={inputTab === "paste"}
                  aria-controls="denial-input-panel-paste"
                  tabIndex={inputTab === "paste" ? 0 : -1}
                  onClick={() => handleInputTabChange("paste")}
                  className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    inputTab === "paste"
                      ? "border-[#22c55e] text-[#1a2a3a]"
                      : "border-transparent text-[#94a3b8] hover:text-[#5a6a7a]"
                  }`}
                >
                  Paste Text
                </button>
                <button
                  type="button"
                  role="tab"
                  id="denial-input-tab-bulk"
                  aria-selected={inputTab === "bulk"}
                  aria-controls="denial-input-panel-bulk"
                  tabIndex={inputTab === "bulk" ? 0 : -1}
                  onClick={() => handleInputTabChange("bulk")}
                  className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    inputTab === "bulk"
                      ? "border-[#22c55e] text-[#1a2a3a]"
                      : "border-transparent text-[#94a3b8] hover:text-[#5a6a7a]"
                  }`}
                >
                  Bulk Upload
                </button>
              </div>

              {inputTab === "upload" ? (
                <div
                  role="tabpanel"
                  id="denial-input-panel-upload"
                  aria-labelledby="denial-input-tab-upload"
                  className="mt-6"
                >
                  <DenialDocumentDropZone
                    accept="application/pdf,.pdf"
                    extractAfterDrop
                    enablePageDrop
                    extracting={extracting}
                    confirmedFile={uploadedFile}
                    onRemoveFile={() => {
                      setUploadedFile(null);
                      setExtractError(null);
                    }}
                    onFile={(file) => setUploadedFile(file)}
                    onExtractSuccess={applyExtraction}
                    onExtractError={(err) => {
                      const msg =
                        err instanceof Error
                          ? err.message
                          : "Could not extract from PDF.";
                      setExtractError(msg);
                      announce(msg);
                    }}
                    onPasteText={(text) => {
                      setPasteText(text);
                      void runTextExtraction(text);
                    }}
                  >
                    <div className="text-center">
                      <p className="text-base font-semibold text-[#0f172a]">
                        Drop PDF here or click to browse
                      </p>
                      <p className="mt-2 text-sm text-[#64748b]">
                        PDF files only — extraction starts automatically
                      </p>
                    </div>
                  </DenialDocumentDropZone>
                  <p className="mt-2 text-center text-xs text-[#64748b]">
                    Accepts PDF files · Scanned documents · Up to 10MB
                  </p>
                </div>
              ) : inputTab === "paste" ? (
                <div
                  role="tabpanel"
                  id="denial-input-panel-paste"
                  aria-labelledby="denial-input-tab-paste"
                  className="mt-6"
                >
                  <label
                    htmlFor="denial-paste-text"
                    className="mb-1 block text-sm font-semibold text-[#1a2a3a]"
                  >
                    Paste denial text
                  </label>
                  <textarea
                    id="denial-paste-text"
                    rows={5}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    className="w-full rounded-lg border border-[#cbd5e1] p-3 text-sm"
                    placeholder="Paste EOB or denial letter text…"
                  />
                  <button
                    type="button"
                    className="dap-btn-primary-green mt-3"
                    disabled={extracting || !pasteText.trim()}
                    onClick={() => void runTextExtraction(pasteText)}
                  >
                    {extracting ? "Extracting…" : "Extract from text"}
                  </button>
                </div>
              ) : (
                <div className="mt-6">
                  <Step1BulkUploadPanel
                    providerDefaults={bulkProviderDefaults}
                    isPreviewMode={isPreviewMode}
                    isAuthenticated={isAuthenticated}
                    isPaid={isPaid}
                    announce={announce}
                    onPreviewUnlock={() => void handlePreviewUnlock()}
                    previewUnlockBusy={previewUnlockBusy}
                  />
                </div>
              )}
            </div>

            {inputTab !== "bulk" && extracting ? (
              <p className="mt-4 text-sm font-medium text-[#2563EB]">
                Extracting…
              </p>
            ) : null}
            {inputTab !== "bulk" && extractError ? (
              <p className="mt-4 text-sm text-[#b45309]" role="alert">
                {extractError}
              </p>
            ) : null}

            <Step1RecentAppeals
              isAuthenticated={isAuthenticated}
              sessionReady={sessionReady}
              onPrefillProvider={handlePrefillProviderFromReview}
              announce={announce}
            />
          </section>
        ) : null}

        {currentStep === 2 ? (
          <Step2ExtractionPanel
            intake={intake}
            confidence={confidence}
            onIntakeChange={(patch) =>
              setIntake((prev) => ({ ...prev, ...patch }))
            }
            onBack={() => setCurrentStep(1)}
            onNext={() => setCurrentStep(3)}
            announce={announce}
          />
        ) : null}

        {currentStep === 3 ? (
          <Step3ConfirmPanel
            intake={intake}
            ledger={ledger}
            enclosures={enclosures}
            onIntakeChange={(patch) =>
              setIntake((prev) => ({ ...prev, ...patch }))
            }
            onEnclosuresChange={setEnclosures}
            onBack={() => setCurrentStep(2)}
            onContinue={handleStep3Continue}
            isPreviewMode={isPreviewMode}
            previewUnlockBusy={previewUnlockBusy}
            onPreviewUnlock={handlePreviewUnlock}
            announce={announce}
          />
        ) : null}

        {currentStep === 4 && sessionReady ? (
          <Step4GeneratePanel
            intake={intake}
            generateLoading={generateLoading}
            onBack={() => setCurrentStep(3)}
            onGenerate={() => void handleGenerate()}
            announce={announce}
          />
        ) : null}
      </main>
    </div>
  );
}
