"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import type { ExtractDenialResponse } from "@/lib/wizard/mapExtractedToIntake";

function fileMatchesAccept(file: File, acceptAttr?: string) {
  if (!acceptAttr?.trim() || !file?.name) return true;
  const lower = file.name.toLowerCase();
  const parts = acceptAttr.split(",").map((p) => p.trim().toLowerCase());
  return parts.some((p) => {
    if (p.startsWith(".")) return lower.endsWith(p);
    if (p === "application/pdf") return lower.endsWith(".pdf");
    if (p.startsWith("image/")) return lower.match(/\.(png|jpe?g|gif|webp)$/) != null;
    return false;
  });
}

function isPdfFile(file: File | null | undefined) {
  if (!file) return false;
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null || Number.isNaN(bytes)) return "";
  const n = Number(bytes);
  if (n === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(n) / Math.log(k)));
  const val = n / k ** i;
  const dec = i > 0 ? 1 : 0;
  return `${parseFloat(val.toFixed(dec))} ${sizes[i]}`;
}

type Props = {
  accept?: string;
  onFile?: (file: File) => void;
  disabled?: boolean;
  inputId?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  extractAfterDrop?: boolean;
  onExtractSuccess?: (payload: ExtractDenialResponse) => void;
  onExtractError?: (err: unknown) => void;
  onParseResult?: (payload: ExtractDenialResponse) => void;
  onUploadingChange?: (uploading: boolean) => void;
  onPasteText?: (text: string) => void;
  confirmedFile?: File | null;
  onRemoveFile?: () => void;
  extracting?: boolean;
};

export default function DenialDocumentDropZone({
  accept,
  onFile,
  disabled = false,
  inputId = "denial-document-file",
  children,
  style: outerStyle,
  extractAfterDrop = false,
  onExtractSuccess,
  onExtractError,
  onParseResult,
  onUploadingChange,
  onPasteText,
  confirmedFile = null,
  onRemoveFile,
  extracting = false,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pasteDetected, setPasteDetected] = useState(false);
  const depth = useRef(0);
  const pasteFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChosenFileRef = useRef<(file: File) => void>(() => {});

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  const resetDepth = useCallback(() => {
    depth.current = 0;
    setDragOver(false);
  }, []);

  const runExtractPipeline = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extract-denial", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as ExtractDenialResponse;
      onParseResult?.(payload);

      if (payload?.success) {
        onFile?.(file);
        onExtractSuccess?.(payload);
      } else {
        throw new Error(payload?.message || payload?.error || "Extraction failed");
      }
    } catch (err) {
      console.error("Denial extract error:", err);
      onExtractError?.(err);
      onFile?.(file);
    } finally {
      setUploading(false);
    }
  };

  const handleChosenFile = (file: File) => {
    if (!file) return;

    if (extractAfterDrop && isPdfFile(file)) {
      void runExtractPipeline(file);
      return;
    }

    onFile?.(file);
  };

  handleChosenFileRef.current = handleChosenFile;

  const flashPasteDetected = useCallback(() => {
    setPasteDetected(true);
    if (pasteFeedbackTimerRef.current) clearTimeout(pasteFeedbackTimerRef.current);
    pasteFeedbackTimerRef.current = setTimeout(() => {
      setPasteDetected(false);
      pasteFeedbackTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(
    () => () => {
      if (pasteFeedbackTimerRef.current) clearTimeout(pasteFeedbackTimerRef.current);
    },
    []
  );

  const busy = disabled || uploading || extracting;

  useEffect(() => {
    if (busy) return undefined;

    const onPaste = (e: ClipboardEvent) => {
      const el = document.activeElement;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (el as HTMLElement | null)?.isContentEditable
      ) {
        return;
      }

      const cd = e.clipboardData;
      if (!cd) return;

      if (cd.files && cd.files.length > 0) {
        const file = cd.files[0];
        if (fileMatchesAccept(file, accept)) {
          e.preventDefault();
          flashPasteDetected();
          handleChosenFileRef.current(file);
        }
        return;
      }

      for (let i = 0; i < cd.items.length; i += 1) {
        const item = cd.items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file && fileMatchesAccept(file, accept)) {
            e.preventDefault();
            flashPasteDetected();
            handleChosenFileRef.current(file);
            return;
          }
        }
      }

      let stringItem: DataTransferItem | null = null;
      for (let i = 0; i < cd.items.length; i += 1) {
        const item = cd.items[i];
        if (item.kind === "string" && item.type === "text/plain") {
          stringItem = item;
          break;
        }
      }
      if (!stringItem) {
        for (let i = 0; i < cd.items.length; i += 1) {
          const item = cd.items[i];
          if (item.kind === "string") {
            stringItem = item;
            break;
          }
        }
      }
      if (stringItem) {
        e.preventDefault();
        stringItem.getAsString((text) => {
          if (!text?.trim()) return;
          flashPasteDetected();
          if (onPasteText) {
            onPasteText(text);
          }
        });
      }
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy, accept, onPasteText, flashPasteDetected]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || uploading || extracting) return;
    depth.current += 1;
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    depth.current -= 1;
    if (depth.current <= 0) {
      depth.current = 0;
      setDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetDepth();
    if (disabled || uploading || extracting) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!fileMatchesAccept(file, accept)) return;
    handleChosenFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleChosenFile(file);
  };

  const confirmed = confirmedFile && confirmedFile.name;
  const baseBorder = confirmed
    ? "2px solid #22c55e"
    : `2px dashed ${dragOver ? "#22c55e" : "#cbd5e1"}`;

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        border: baseBorder,
        borderRadius: 12,
        padding: 20,
        background: confirmed || dragOver ? "#f0fdf4" : "#ffffff",
        transition: "border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease",
        boxSizing: "border-box",
        animation: extracting ? "dapZonePulse 1.2s ease-in-out infinite" : undefined,
        ...outerStyle,
      }}
    >
      <style>{`
        @keyframes dapZonePulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25); }
          50% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.45); }
        }
      `}</style>
      <input
        id={inputId}
        type="file"
        accept={accept}
        disabled={busy}
        onChange={handleInputChange}
        style={{ display: "none" }}
      />
      {confirmed ? (
        <div style={{ textAlign: "center", padding: "8px 4px" }}>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1,
              color: "#22c55e",
              marginBottom: 10,
            }}
            aria-hidden="true"
          >
            ✓
          </div>
          <div
            style={{
              fontWeight: 700,
              color: "#0f172a",
              fontSize: 15,
              wordBreak: "break-word",
            }}
          >
            {confirmedFile.name} · {formatFileSize(confirmedFile.size)}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemoveFile?.();
            }}
            style={{
              marginTop: 14,
              background: "none",
              border: "none",
              cursor: busy ? "not-allowed" : "pointer",
              color: "#64748b",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "underline",
              padding: "8px 12px",
            }}
          >
            × Remove
          </button>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#94a3b8" }}>
            Drop another file or use Remove to start over
          </p>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          style={{
            display: "block",
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.65 : 1,
            margin: 0,
          }}
        >
          {children}
        </label>
      )}
      {pasteDetected ? (
        <div
          style={{
            marginTop: "10px",
            color: "green",
            fontWeight: "500",
            textAlign: "center",
          }}
        >
          ✓ Pasted and extracted
        </div>
      ) : null}
    </div>
  );
}
