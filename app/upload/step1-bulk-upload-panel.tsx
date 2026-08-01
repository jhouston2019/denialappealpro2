"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  extractBulkPdf,
  formatCodeList,
  generateBulkAppeal,
  isPdfFile,
  mergeBulkIntake,
} from "@/lib/bulk-upload/bulkUploadApi";
import {
  MAX_BULK_FILES,
  type BulkProviderDefaults,
  type BulkUploadItem,
} from "@/lib/bulk-upload/types";
import { isValidNpi } from "@/lib/user-provider-profile";

type Step1BulkUploadPanelProps = {
  providerDefaults: BulkProviderDefaults;
  isPreviewMode?: boolean;
  isAuthenticated: boolean;
  isPaid: boolean;
  announce: (message: string) => void;
  onPreviewUnlock?: () => void;
  previewUnlockBusy?: boolean;
};

function newBulkItem(file: File): BulkUploadItem {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    extractStatus: "pending",
    generateStatus: "not_started",
  };
}

function StatusDot({
  color,
  pulse,
}: {
  color: "gray" | "green" | "red" | "blue";
  pulse?: boolean;
}) {
  const colors = {
    gray: "bg-[#94a3b8]",
    green: "bg-[#22c55e]",
    red: "bg-[#ef4444]",
    blue: "bg-[#2563EB]",
  };
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${colors[color]} ${
        pulse ? "animate-pulse" : ""
      }`}
      aria-hidden="true"
    />
  );
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`${className} animate-spin text-[#2563EB]`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function Step1BulkUploadPanel({
  providerDefaults,
  isPreviewMode = false,
  isAuthenticated,
  isPaid,
  announce,
  onPreviewUnlock,
  previewUnlockBusy = false,
}: Step1BulkUploadPanelProps) {
  const [items, setItems] = useState<BulkUploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const processedCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.extractStatus === "ready" || item.extractStatus === "failed"
      ).length,
    [items]
  );

  const extractionComplete = useMemo(
    () => items.length > 0 && processedCount === items.length,
    [items.length, processedCount]
  );

  const readyItems = useMemo(
    () => items.filter((item) => item.extractStatus === "ready"),
    [items]
  );

  const canGenerate =
    isValidNpi(providerDefaults.providerNpi) &&
    Boolean(providerDefaults.providerName?.trim()) &&
    Boolean(providerDefaults.providerAddress?.trim()) &&
    Boolean(providerDefaults.providerPhone?.trim()) &&
    Boolean(
      (providerDefaults.signerName || providerDefaults.providerName)?.trim()
    ) &&
    Boolean(providerDefaults.signerTitle?.trim());

  const generationBlocked =
    isPreviewMode || !isAuthenticated || !isPaid;

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList).filter(isPdfFile);
      if (!incoming.length) {
        announce("Only PDF files can be added to bulk upload.");
        return;
      }

      setItems((prev) => {
        const remaining = MAX_BULK_FILES - prev.length;
        if (remaining <= 0) {
          announce(`Bulk upload accepts up to ${MAX_BULK_FILES} PDFs at once.`);
          return prev;
        }
        const toAdd = incoming.slice(0, remaining).map(newBulkItem);
        if (incoming.length > remaining) {
          announce(
            `Added ${toAdd.length} file(s). Maximum ${MAX_BULK_FILES} PDFs per batch.`
          );
        } else {
          announce(`${toAdd.length} file(s) added to bulk queue.`);
        }
        return [...prev, ...toAdd];
      });
    },
    [announce]
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<BulkUploadItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      announce("File removed from bulk queue.");
    },
    [announce]
  );

  const runExtractionQueue = useCallback(async () => {
    if (processingRef.current) return;

    const pending = itemsRef.current.filter(
      (item) => item.extractStatus === "pending"
    );
    if (!pending.length) return;

    processingRef.current = true;
    setExtracting(true);

    for (const item of pending) {
      updateItem(item.id, { extractStatus: "extracting", error: undefined });
      try {
        const payload = await extractBulkPdf(item.file);
        const merged = mergeBulkIntake(payload, providerDefaults);
        updateItem(item.id, {
          extractStatus: "ready",
          intake: merged.intake,
          confidence: merged.confidence,
          ledger: merged.ledger,
          error: undefined,
        });
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Could not extract denial data from this PDF.";
        updateItem(item.id, {
          extractStatus: "failed",
          error: msg,
        });
      }
    }

    processingRef.current = false;
    setExtracting(false);
    announce("Bulk extraction finished.");
  }, [announce, providerDefaults, updateItem]);

  useEffect(() => {
    const hasPending = items.some((item) => item.extractStatus === "pending");
    if (hasPending && !processingRef.current) {
      void runExtractionQueue();
    }
  }, [items, runExtractionQueue]);

  const retryExtraction = useCallback(
    (id: string) => {
      updateItem(id, {
        extractStatus: "pending",
        error: undefined,
        intake: undefined,
        confidence: undefined,
        ledger: undefined,
        generateStatus: "not_started",
        generateError: undefined,
        reviewId: undefined,
      });
    },
    [updateItem]
  );

  const handleGenerateOne = useCallback(
    async (id: string) => {
      const item = items.find((entry) => entry.id === id);
      if (!item || item.extractStatus !== "ready" || !item.intake) return;

      if (generationBlocked) {
        onPreviewUnlock?.();
        return;
      }
      if (!canGenerate) {
        announce(
          "Complete provider name, NPI, address, phone, and signer title in your profile before generating."
        );
        return;
      }

      setGeneratingId(id);
      updateItem(id, {
        generateStatus: "generating",
        generateError: undefined,
      });

      try {
        const { reviewId } = await generateBulkAppeal(item.intake, item.ledger);
        updateItem(id, {
          generateStatus: "generated",
          reviewId,
        });
        announce(`Appeal generated for ${item.file.name}.`);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Appeal generation failed.";
        updateItem(id, {
          generateStatus: "generate_failed",
          generateError: msg,
        });
        announce(msg);
      } finally {
        setGeneratingId(null);
      }
    },
    [
      announce,
      canGenerate,
      generationBlocked,
      items,
      onPreviewUnlock,
      updateItem,
    ]
  );

  const handleGenerateAll = useCallback(async () => {
    if (generationBlocked) {
      onPreviewUnlock?.();
      return;
    }
    if (!canGenerate) {
      announce(
        "Complete provider name, NPI, address, phone, and signer title in your profile before generating."
      );
      return;
    }

    const targets = items.filter(
      (item) =>
        item.extractStatus === "ready" &&
        item.generateStatus !== "generated" &&
        item.generateStatus !== "generating"
    );
    if (!targets.length) return;

    setGeneratingAll(true);
    for (const item of targets) {
      await handleGenerateOne(item.id);
    }
    setGeneratingAll(false);
    announce("Bulk appeal generation finished.");
  }, [
    announce,
    canGenerate,
    generationBlocked,
    handleGenerateOne,
    items,
    onPreviewUnlock,
  ]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (extracting || generatingAll) return;
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  };

  const summaryStatusLabel = (item: BulkUploadItem) => {
    if (item.generateStatus === "generated") return "Generated";
    if (item.generateStatus === "generating") return "Generating…";
    if (item.generateStatus === "generate_failed") return "Generate failed";
    if (item.extractStatus === "ready") return "Ready";
    if (item.extractStatus === "failed") return "Failed";
    if (item.extractStatus === "extracting") return "Extracting…";
    return "Pending";
  };

  const progressPct =
    items.length > 0 ? Math.round((processedCount / items.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div
        role="tabpanel"
        id="denial-input-panel-bulk"
        aria-labelledby="denial-input-tab-bulk"
        onDragEnter={(e) => {
          e.preventDefault();
          if (!extracting && !generatingAll) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-5 transition-colors sm:p-6 ${
          dragOver
            ? "border-[#22c55e] bg-[#f0fdf4]"
            : "border-[#cbd5e1] bg-white"
        } ${extracting || generatingAll ? "opacity-70" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          disabled={extracting || generatingAll || items.length >= MAX_BULK_FILES}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="text-center">
          <p className="text-base font-semibold text-[#0f172a]">
            Drop PDFs here or click to browse
          </p>
          <p className="mt-2 text-sm text-[#64748b]">
            Up to {MAX_BULK_FILES} PDF denial letters — processed one at a time
          </p>
          <button
            type="button"
            className="dap-btn-cta mt-4"
            disabled={
              extracting ||
              generatingAll ||
              items.length >= MAX_BULK_FILES
            }
            onClick={() => inputRef.current?.click()}
          >
            Select PDF files
          </button>
          {items.length > 0 ? (
            <p className="mt-3 text-xs text-[#64748b]">
              {items.length} of {MAX_BULK_FILES} files in queue
            </p>
          ) : null}
        </div>
      </div>

      {items.length > 0 ? (
        <>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-[#1a2a3a]">
                Processing {processedCount} of {items.length} files
              </span>
              <span className="text-[#64748b]">{progressPct}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPct}
              aria-label={`${processedCount} of ${items.length} files processed`}
            >
              <div
                className="h-full rounded-full bg-[#22c55e] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {!extractionComplete ? (
            <ul className="space-y-3" aria-label="Bulk upload queue">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      {item.extractStatus === "pending" ? (
                        <StatusDot color="gray" />
                      ) : null}
                      {item.extractStatus === "extracting" ? (
                        <Spinner className="mt-0.5 h-4 w-4" />
                      ) : null}
                      {item.extractStatus === "ready" ? (
                        <span className="text-[#22c55e]" aria-hidden="true">
                          ✓
                        </span>
                      ) : null}
                      {item.extractStatus === "failed" ? (
                        <span className="text-[#ef4444]" aria-hidden="true">
                          ✕
                        </span>
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1a2a3a]">
                          {item.file.name}
                        </p>
                        <p className="mt-0.5 text-xs text-[#64748b]">
                          {item.extractStatus === "pending" && "Pending"}
                          {item.extractStatus === "extracting" && "Extracting…"}
                          {item.extractStatus === "ready" && "Ready"}
                          {item.extractStatus === "failed" && "Failed"}
                        </p>
                        {item.error ? (
                          <p className="mt-1 text-xs text-[#b45309]" role="alert">
                            {item.error}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.extractStatus === "failed" ? (
                      <button
                        type="button"
                        className="dap-btn-ghost-panel text-xs"
                        disabled={extracting}
                        onClick={() => retryExtraction(item.id)}
                      >
                        Retry
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="dap-btn-ghost-panel text-xs"
                      disabled={extracting || item.extractStatus === "extracting"}
                      onClick={() => removeItem(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold text-[#1a2a3a]">
                  Extraction summary
                </h3>
                <button
                  type="button"
                  className="dap-btn-cta w-full sm:w-auto"
                  disabled={
                    !readyItems.length ||
                    generatingAll ||
                    Boolean(generatingId) ||
                    readyItems.every((item) => item.generateStatus === "generated")
                  }
                  onClick={() => void handleGenerateAll()}
                >
                  {generatingAll
                    ? "Generating appeals…"
                    : generationBlocked
                      ? "Unlock to generate all"
                      : "Generate all appeals"}
                </button>
              </div>

              {!canGenerate && !generationBlocked ? (
                <p className="text-sm text-[#b45309]" role="alert">
                  Add provider name, valid 10-digit NPI, address, phone, and
                  signer title to your profile before generating appeals.
                </p>
              ) : null}

              {generationBlocked ? (
                <p className="text-sm text-[#5a6a7a]">
                  {isPreviewMode
                    ? "Extraction preview is free. Sign in and pay to generate appeal letters."
                    : "Sign in with an active plan to generate appeals."}
                </p>
              ) : null}

              <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
                <table className="min-w-[640px] w-full border-collapse text-left text-sm">
                  <thead className="bg-[#f1f5f9] text-xs uppercase tracking-wide text-[#64748b]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Filename</th>
                      <th className="px-3 py-2 font-semibold">Patient</th>
                      <th className="px-3 py-2 font-semibold">CARC</th>
                      <th className="px-3 py-2 font-semibold">CPT</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const rowBusy =
                        item.generateStatus === "generating" &&
                        generatingId === item.id;
                      return (
                        <tr
                          key={item.id}
                          className="border-t border-[#e2e8f0] align-top"
                        >
                          <td className="max-w-[180px] truncate px-3 py-3 font-medium text-[#1a2a3a]">
                            {item.file.name}
                          </td>
                          <td className="px-3 py-3 text-[#334155]">
                            {item.intake?.patientName?.trim() || "—"}
                          </td>
                          <td className="px-3 py-3 text-[#334155]">
                            {formatCodeList(item.intake?.carcCodes)}
                          </td>
                          <td className="px-3 py-3 text-[#334155]">
                            {formatCodeList(item.intake?.cptCodes)}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                                item.generateStatus === "generated" ||
                                item.extractStatus === "ready"
                                  ? "text-[#15803d]"
                                  : item.extractStatus === "failed" ||
                                      item.generateStatus === "generate_failed"
                                    ? "text-[#b45309]"
                                    : "text-[#64748b]"
                              }`}
                            >
                              {rowBusy ? <Spinner className="h-3.5 w-3.5" /> : null}
                              {summaryStatusLabel(item)}
                            </span>
                            {item.error || item.generateError ? (
                              <p className="mt-1 text-xs text-[#b45309]">
                                {item.generateError || item.error}
                              </p>
                            ) : null}
                            {item.reviewId ? (
                              <Link
                                href={`/deliverables?reviewId=${item.reviewId}`}
                                className="mt-1 block text-xs font-semibold text-[#2563EB] hover:underline"
                              >
                                View appeal
                              </Link>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              {item.extractStatus === "ready" &&
                              item.generateStatus !== "generated" ? (
                                <button
                                  type="button"
                                  className="dap-btn-cta text-xs"
                                  disabled={
                                    rowBusy ||
                                    generatingAll ||
                                    item.generateStatus === "generating"
                                  }
                                  onClick={() => void handleGenerateOne(item.id)}
                                >
                                  {generationBlocked
                                    ? "Unlock"
                                    : item.generateStatus === "generate_failed"
                                      ? "Retry"
                                      : "Generate"}
                                </button>
                              ) : null}
                              {item.extractStatus === "failed" ? (
                                <button
                                  type="button"
                                  className="dap-btn-ghost-panel text-xs"
                                  disabled={extracting}
                                  onClick={() => retryExtraction(item.id)}
                                >
                                  Retry
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="dap-btn-ghost-panel text-xs"
                                disabled={
                                  extracting ||
                                  item.extractStatus === "extracting" ||
                                  rowBusy
                                }
                                onClick={() => removeItem(item.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {items.some((item) => item.generateStatus === "generated") ? (
                <p className="text-sm text-[#5a6a7a]">
                  Generated appeals are saved to your{" "}
                  <Link href="/dashboard" className="font-semibold text-[#2563EB] hover:underline">
                    dashboard
                  </Link>
                  .
                </p>
              ) : null}

              {isPreviewMode && onPreviewUnlock ? (
                <button
                  type="button"
                  className="dap-btn-cta"
                  disabled={previewUnlockBusy}
                  onClick={onPreviewUnlock}
                >
                  {previewUnlockBusy ? "Starting checkout…" : "Unlock full generation"}
                </button>
              ) : null}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
