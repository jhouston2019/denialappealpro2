/**
 * Malformed PDF tolerance — no OPENAI_API_KEY required.
 * Run: npx tsx --test lib/appeal/__tests__/malformed-pdf.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MALFORMED_PDF_MESSAGE,
  MalformedPdfError,
  parsePdfBuffer,
  parsePdfBufferForExtraction,
} from "../extract/parsePdfBuffer";

/** PDF shell with an invalid XRef table — fails both parse attempts. */
function malformedPdfBuffer(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 broken-xref-header-not-valid\n%%EOF",
    "utf8"
  );
}

describe("malformed PDF extraction tolerance", () => {
  it("parsePdfBuffer throws MalformedPdfError for bad XRef PDF", async () => {
    await assert.rejects(
      () => parsePdfBuffer(malformedPdfBuffer()),
      (err: unknown) => {
        assert.ok(err instanceof MalformedPdfError);
        assert.equal(err.message, MALFORMED_PDF_MESSAGE);
        assert.equal(err.status, 422);
        return true;
      }
    );
  });

  it("parsePdfBufferForExtraction returns 422 with user-friendly message", async () => {
    const result = await parsePdfBufferForExtraction(malformedPdfBuffer());
    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error("expected malformed PDF to fail parsing");
    }
    assert.equal(result.status, 422);
    assert.equal(result.error, MALFORMED_PDF_MESSAGE);
  });

  it("does not throw unhandled errors for malformed PDF input", async () => {
    let threw = false;
    try {
      const result = await parsePdfBufferForExtraction(malformedPdfBuffer());
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.status, 422);
      }
    } catch {
      threw = true;
    }
    assert.equal(threw, false, "malformed PDF must not cause unhandled throw");
  });
});
