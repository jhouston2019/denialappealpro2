"use client";

import React, { useState } from "react";
import type { FieldConfidence } from "@/lib/dap-wizard-snapshot";

function normalizeCodeKey(s: string) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/\s/g, "");
}

type Props = {
  label: string;
  required?: boolean;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  id?: string;
  lowConfidence?: boolean;
  highlightCodes?: string[];
  confidence?: FieldConfidence;
};

export default function CodeMultiInput({
  label,
  required,
  values,
  onChange,
  placeholder = "Type code, press Enter",
  id,
  lowConfidence,
  highlightCodes,
  confidence,
}: Props) {
  const [draft, setDraft] = useState("");
  const vals = Array.isArray(values) ? values : [];

  const add = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (vals.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...vals, t]);
    setDraft("");
  };

  const borderDefault = "1.5px solid #cbd5e1";
  const warnSet = new Set((highlightCodes || []).map(normalizeCodeKey));
  const hasTagWarn =
    vals.some((v) => warnSet.has(normalizeCodeKey(v))) && warnSet.size > 0;

  const isLow =
    lowConfidence || confidence === "low" || hasTagWarn;
  const verifyTitle = isLow ? "Please verify this field" : undefined;
  const confirmedExtracted =
    vals.length > 0 && !isLow && confidence === "high";

  const containerBorder = isLow
    ? "2px solid #f97316"
    : confirmedExtracted
      ? "2px solid #22c55e"
      : borderDefault;

  return (
    <div style={{ marginBottom: 14 }}>
      <label
        htmlFor={id}
        style={{
          fontWeight: 600,
          fontSize: 14,
          color: "#1e293b",
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
        {required ? " *" : ""}
      </label>
      <div
        className="dap-flow-code-input"
        title={verifyTitle}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
          padding: "12px 14px",
          border: containerBorder,
          borderRadius: 8,
          background: isLow ? "#fff7ed" : "#fff",
          minHeight: 48,
          boxSizing: "border-box",
        }}
      >
        {vals.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(vals.filter((x) => x !== v))}
            style={{
              border: warnSet.has(normalizeCodeKey(v))
                ? "2px solid #f97316"
                : "1.5px solid #cbd5e1",
              background: warnSet.has(normalizeCodeKey(v)) ? "#fffbeb" : "#f1f5f9",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {v} ×
          </button>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft.replace(/,/g, ""));
            }
          }}
          placeholder={placeholder}
          style={{
            flex: "1 1 120px",
            border: "none",
            outline: "none",
            fontSize: 16,
            minWidth: 100,
            minHeight: 24,
          }}
        />
      </div>
    </div>
  );
}
