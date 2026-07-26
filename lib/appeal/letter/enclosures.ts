import type { EnclosureItem } from "../ledger/types";

/** Append an Enclosures: block from checked items only. Omit entirely if none. */
export function appendEnclosuresBlock(
  letterBody: string,
  enclosures: EnclosureItem[]
): string {
  const checked = (enclosures || []).filter((e) => e.checked && e.label?.trim());
  const body = String(letterBody || "").replace(/\s+$/, "");
  if (!checked.length) return body;

  const block =
    "Enclosures:\n" + checked.map((e) => `- ${e.label.trim()}`).join("\n");

  return `${body}\n\n${block}`;
}
