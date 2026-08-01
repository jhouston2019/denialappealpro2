/** Strip X12/835 EDI infrastructure language from payer remark or CARC text. */
export function sanitizeCarcDescription(text: string): string {
  let s = String(text || "").trim();
  if (!s) return "";

  // "Usage: Refer to the 835..." and everything after
  s = s.replace(/\s*Usage:\s*Refer to the 835[\s\S]*$/i, "");

  s = s.replace(
    /\s*Refer to the 835 Healthcare Policy Identification Segment \(loop 2110 Service Payment Information REF\)/gi,
    ""
  );
  s = s.replace(/\s*\(loop 2110[^)]*\)/gi, "");
  s = s.replace(/\bloops?\s*2110\b[^.,;]*/gi, "");
  s = s.replace(/\b835 Healthcare Policy Identification Segment\b[^.,;]*/gi, "");
  s = s.replace(/\bService Payment Information REF\b[^.,;]*/gi, "");

  s = s.replace(/\s*,?\s*if present\.?\s*$/i, "");

  s = s.replace(/\s{2,}/g, " ").replace(/\.\s*\./g, ".").trim();
  s = s.replace(/[,;\s]+$/, "").trim();

  return s;
}
