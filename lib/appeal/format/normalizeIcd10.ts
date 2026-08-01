/** Normalize a single ICD-10 code to standard format (e.g. m16-11 → M16.11). */
export function normalizeIcd10(code: string): string {
  const cleaned = code.trim().toUpperCase().replace(/-/g, ".");
  if (!cleaned) return "";
  if (cleaned.length > 3 && !cleaned.includes(".")) {
    return cleaned.slice(0, 3) + "." + cleaned.slice(3);
  }
  return cleaned;
}

export function normalizeIcd10Array(codes: string[] | null | undefined): string[] {
  if (!codes?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of codes) {
    const normalized = normalizeIcd10(String(raw));
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}
