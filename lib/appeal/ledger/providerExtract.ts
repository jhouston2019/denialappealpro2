/** Regex fallback: treating / rendering provider from raw denial text. */
export function extractProviderNameFromRaw(rawText: string): string | null {
  const text = String(rawText || "");
  if (!text.trim()) return null;

  const patterns = [
    /(?:^|\n)\s*(?:Rendering|Treating|Billing|Servicing)\s+Provider(?:\/Practice)?(?:\s+Name)?:\s*(.+?)(?:\n|$)/i,
    /(?:^|\n)\s*Provider(?:\/Practice)?(?:\s+Name)?:\s*(.+?)(?:\n|$)/i,
    /(?:^|\n)\s*Physician(?:\/Provider)?:\s*(.+?)(?:\n|$)/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const name = m[1].trim().replace(/\s{2,}/g, " ");
    if (name.length >= 2 && name.length <= 120 && !looksLikePayerName(name)) {
      return name;
    }
  }
  return null;
}

/** True when a string looks like an insurance payer, not a treating provider. */
export function looksLikePayerName(name: string): boolean {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return false;
  if (
    /^(cigna|aetna|humana|united\s*healthcare|uhc|anthem|bcbs|blue\s*cross|medicare|medicaid|tricare|kaiser|optum|elevance)\b/.test(
      n
    )
  ) {
    return true;
  }
  return (
    n.includes("insurance") ||
    n.includes("health plan") ||
    n.includes("managed care") ||
    n.includes("payer")
  );
}

/** Reject provider values that duplicate payer or look like payer names. */
export function sanitizeProviderName(
  provider: string | null | undefined,
  payer: string | null | undefined
): string | null {
  const p = String(provider ?? "").trim();
  if (!p) return null;
  const pay = String(payer ?? "").trim();
  if (pay && p.toLowerCase() === pay.toLowerCase()) return null;
  if (looksLikePayerName(p)) return null;
  return p;
}
