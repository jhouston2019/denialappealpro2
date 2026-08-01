import { getValue } from "../ledger/builder";
import type { FactLedger, FactValue } from "../ledger/types";
import { lookupCarc } from "../router/carc-table";
import { sanitizeCarcDescription } from "./sanitizeCodes";

/** 22000.00 → "$22,000.00" */
export function formatCurrency(v: string | number): string {
  if (v == null || v === "") return "";
  const n =
    typeof v === "number" ? v : parseFloat(String(v).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

/** 2026-02-28 → "February 28, 2026" */
export function formatLetterDate(iso: string): string {
  const s = String(iso || "").trim();
  if (!s) return "";
  if (/^[A-Za-z]+ \d{1,2}, \d{4}$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "15" or "CO-15" → "CARC CO-15 (description?)" */
export function formatCarc(code: string, desc?: string): string {
  const raw = String(code || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const normalized = digits
    ? `CO-${String(parseInt(digits, 10))}`
    : raw.toUpperCase().startsWith("CO-")
      ? raw.toUpperCase()
      : `CO-${raw}`;
  return desc?.trim()
    ? `CARC ${normalized} (${sanitizeCarcDescription(desc.trim())})`
    : `CARC ${normalized}`;
}

/** "N517" → "RARC N517 (description?)" */
export function formatRarc(code: string, desc?: string): string {
  const raw = String(code || "").trim().toUpperCase();
  if (!raw) return "";
  const clean = desc?.trim() ? sanitizeCarcDescription(desc.trim()) : "";
  return clean ? `RARC ${raw} (${clean})` : `RARC ${raw}`;
}

export function formatNpi(v: string): string {
  const s = String(v || "").replace(/\D/g, "");
  return s || String(v || "").trim();
}

export function formatCodesList(
  codes: string[] | string | number | null | undefined,
  kind: "carc" | "rarc"
): string {
  const arr = Array.isArray(codes)
    ? codes
    : codes
      ? String(codes)
          .split(/[,;\s]+/)
          .filter(Boolean)
      : [];
  if (!arr.length) return "";
  return arr
    .map((c) => (kind === "carc" ? formatCarc(c) : formatRarc(c)))
    .join("; ");
}

function arr(v: FactValue | undefined): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return String(v)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Letter header denial line: CARC/RARC codes with clean official descriptors. */
export function formatLedgerDenialCodes(
  ledger: FactLedger,
  rarcJoin = " / "
): string {
  const carcCodes = arr(getValue(ledger, "claim.carcCodes"));
  const rarcCodes = arr(getValue(ledger, "claim.rarcCodes"));
  const carcParts = carcCodes.map((c) => {
    const entry = lookupCarc(c);
    return entry ? formatCarc(c, entry.descriptor) : formatCarc(c);
  });
  const rarcParts = rarcCodes.map((c) => formatRarc(c));
  const parts = [...carcParts, ...rarcParts].filter(Boolean);
  return parts.join(rarcJoin);
}

/** Primary CARC official descriptor for claim summaries (sanitized). */
export function primaryCarcDescriptor(carcCodes: string[]): string {
  for (const raw of carcCodes) {
    const entry = lookupCarc(raw);
    if (entry?.descriptor) return entry.descriptor;
  }
  return "";
}
