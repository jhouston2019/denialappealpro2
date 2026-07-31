export const MALFORMED_PDF_MESSAGE =
  "Could not parse PDF. Please try pasting the denial text instead.";

export class MalformedPdfError extends Error {
  readonly status = 422 as const;

  constructor(message: string = MALFORMED_PDF_MESSAGE) {
    super(message);
    this.name = "MalformedPdfError";
  }
}

export type PdfParseResult =
  | { ok: true; text: string }
  | { ok: false; status: 422; error: string };

/**
 * Parse PDF bytes to plain text with tolerance for malformed XRef tables.
 * Throws {@link MalformedPdfError} when no extraction strategy succeeds.
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;

  let parsed: { text?: string };
  try {
    parsed = await pdfParse(buffer, { max: 0 });
  } catch {
    try {
      parsed = await pdfParse(buffer, { max: 0, version: "default" });
    } catch {
      throw new MalformedPdfError();
    }
  }

  return String(parsed.text || "").trim();
}

/** Route-friendly wrapper — never throws for malformed PDF input. */
export async function parsePdfBufferForExtraction(
  buffer: Buffer
): Promise<PdfParseResult> {
  try {
    const text = await parsePdfBuffer(buffer);
    return { ok: true, text };
  } catch (err) {
    if (err instanceof MalformedPdfError) {
      return { ok: false, status: 422, error: err.message };
    }
    throw err;
  }
}
