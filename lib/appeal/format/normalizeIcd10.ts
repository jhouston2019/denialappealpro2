/** Normalize a single ICD-10 code to standard format (e.g. m16-11 → M16.11). */
export function normalizeIcd10(code: string): string {
  const cleaned = code.trim().toUpperCase().replace(/-/g, ".");
  if (!cleaned) return "";
  if (cleaned.length > 3 && !cleaned.includes(".")) {
    return cleaned.slice(0, 3) + "." + cleaned.slice(3);
  }
  return cleaned;
}

/** True when a code is a placeholder (e.g. XXX.XXX) and must not appear in letters. */
export function isIcd10Placeholder(code: string): boolean {
  const normalized = normalizeIcd10(String(code || ""));
  if (!normalized) return true;
  if (/^X+(\.X+)*$/i.test(normalized)) return true;
  if (/^(UNKNOWN|N\/A|NA|TBD|NONE|PENDING|PLACEHOLDER)$/i.test(normalized)) {
    return true;
  }
  return false;
}

export function normalizeIcd10Array(codes: string[] | null | undefined): string[] {
  if (!codes?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of codes) {
    const normalized = normalizeIcd10(String(raw));
    if (normalized && !isIcd10Placeholder(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

const ICD10_PLACEHOLDER_TEXT_RE = /\bXXX\.XXX\b/gi;

/** Remove placeholder ICD-10 strings from generated letter text. */
export function stripIcd10PlaceholdersFromText(text: string): string {
  let t = String(text || "");
  t = t.replace(/^\s*ICD-10:\s*XXX\.XXX(?:\s*—[^\n]*)?\s*$/gim, "");
  t = t.replace(/\bICD-10[:\s]+XXX\.XXX\b/gi, "");
  t = t.replace(
    /\b(?:associated with|diagnosis(?:\s+was\s+coded as)?|coded as)\s+ICD-10\s+XXX\.XXX\b/gi,
    ""
  );
  t = t.replace(ICD10_PLACEHOLDER_TEXT_RE, "");
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}
