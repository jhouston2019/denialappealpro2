/**
 * extract-denial — Free preview extraction from denial letter PDF or pasted text.
 * POST multipart/form-data (file) OR JSON { text: string }
 * Ported from netlify/functions/extract-denial.js
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXTRACTION_SYSTEM_PROMPT = `You are a medical billing denial extraction engine.

Extract structured claim data from the input text.

The input may be messy, incomplete, or poorly formatted.

You MUST return a single JSON object with EXACTLY these keys (use null when unknown — never omit a key):

- payer_name: insurance payer / plan name (same as "payer" on forms)
- claim_number
- patient_name: full patient or member name as printed (look for labels: Patient, Member, Subscriber, Insured, Beneficiary, Pt Name). This is required as its own string field whenever any patient/member name appears in the document.
- date_of_service: service or DOS date; YYYY-MM-DD when possible
- cpt_codes: array of procedure codes
- icd10_codes: array of diagnosis codes (ICD-10); same as icd_codes
- modifiers: array
- carc_codes: array of numeric CARC values only (e.g. "50")
- rarc_codes: array (e.g. "N115")
- billed_amount: numeric only
- paid_amount: numeric only
- denial_reason_text: short exact denial wording from the document (1–2 sentences max)

Do not rename keys. Do not nest patient name under another object. Put the member/patient string only in patient_name.

-----------------------------------
RULES:
-----------------------------------

1. DO NOT GUESS
   - If a value is not clearly present, return null for that key

2. HANDLE MULTIPLE VALUES
   - CPT, ICD-10, CARC, RARC, modifiers must be arrays (use [] when none)

3. NORMALIZE DATA:
   - CPT codes: numeric strings (e.g. "99213")
   - ICD-10: keep formatting (e.g. "M54.5")
   - CARC: numbers only (e.g. "50")
   - RARC: codes (e.g. "N115")

4. AMOUNTS:
   - Extract numeric values only
   - Remove $, commas

5. DATES:
   - Convert to YYYY-MM-DD if possible

6. DENIAL TEXT:
   - Extract exact denial explanation (1–2 sentences max)

7. PRIORITIZE ACCURACY OVER COMPLETENESS

-----------------------------------
OUTPUT FORMAT (STRICT JSON):
-----------------------------------

{
  "payer_name": null,
  "claim_number": null,
  "patient_name": null,
  "date_of_service": null,
  "cpt_codes": [],
  "icd10_codes": [],
  "modifiers": [],
  "carc_codes": [],
  "rarc_codes": [],
  "billed_amount": null,
  "paid_amount": null,
  "denial_reason_text": null
}

Use null for unknown scalars and [] for unknown arrays (not empty string for scalars).`;

type RawExtract = Record<string, unknown> & {
  payer_name?: unknown;
  payer?: unknown;
  claim_number?: unknown;
  patient_name?: unknown;
  patient?: unknown;
  member_name?: unknown;
  member?: unknown;
  insured_name?: unknown;
  subscriber_name?: unknown;
  date_of_service?: unknown;
  cpt_codes?: unknown;
  icd10_codes?: unknown;
  icd_codes?: unknown;
  carc_codes?: unknown;
  rarc_codes?: unknown;
  billed_amount?: unknown;
  paid_amount?: unknown;
  denial_reason_text?: unknown;
  provider_name?: unknown;
  provider_npi?: unknown;
};

async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
  try {
    const data = await parser.getText();
    return String(data?.text || "").trim();
  } finally {
    await parser.destroy();
  }
}

function dedupe(arr: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr || []) {
    const s = String(x).trim();
    if (!s) continue;
    const k = s.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function normalizeAmount(val: unknown): string {
  if (val == null || val === "") return "";
  const s = String(val).replace(/[$,\s]/g, "");
  if (!s) return "";
  const n = parseFloat(s);
  return Number.isFinite(n) ? n.toFixed(2) : "";
}

function normalizeDate(val: unknown): string {
  if (val == null || val === "") return "";
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const mm = String(parseInt(m[1], 10)).padStart(2, "0");
    const dd = String(parseInt(m[2], 10)).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  return s.slice(0, 10);
}

function normalizeCarc(c: unknown): string {
  const digits = String(c).replace(/\D/g, "");
  if (!digits) return "";
  return String(parseInt(digits, 10));
}

function normalizeRarc(c: unknown): string {
  return String(c).trim().toUpperCase();
}

function applyAliases(data: RawExtract): RawExtract {
  const d: RawExtract = { ...data };
  if (!d.payer_name && d.payer) d.payer_name = d.payer;
  if (!d.patient_name) {
    for (const alt of [
      "patient",
      "member_name",
      "member",
      "insured_name",
      "subscriber_name",
    ] as const) {
      if (d[alt]) {
        d.patient_name = d[alt];
        break;
      }
    }
  }
  const icd10 = d.icd10_codes;
  const icd = d.icd_codes;
  if (
    (!Array.isArray(icd10) || !icd10.length) &&
    Array.isArray(icd) &&
    icd.length
  ) {
    d.icd10_codes = icd;
  }
  return d;
}

function postProcess(data: RawExtract | null | undefined) {
  const raw = applyAliases(data || {});
  return {
    payer_name: raw.payer_name ? String(raw.payer_name).trim() : "",
    claim_number: raw.claim_number ? String(raw.claim_number).trim() : "",
    patient_name: raw.patient_name ? String(raw.patient_name).trim() : "",
    date_of_service: normalizeDate(raw.date_of_service),
    cpt_codes: dedupe(
      Array.isArray(raw.cpt_codes) ? raw.cpt_codes.map(String) : []
    ),
    icd10_codes: dedupe(
      Array.isArray(raw.icd10_codes) ? raw.icd10_codes.map(String) : []
    ),
    carc_codes: dedupe(
      (Array.isArray(raw.carc_codes) ? raw.carc_codes : [])
        .map(normalizeCarc)
        .filter(Boolean)
    ),
    rarc_codes: dedupe(
      (Array.isArray(raw.rarc_codes) ? raw.rarc_codes : [])
        .map(normalizeRarc)
        .filter(Boolean)
    ),
    billed_amount: normalizeAmount(raw.billed_amount),
    paid_amount: normalizeAmount(raw.paid_amount),
    denial_reason_text: raw.denial_reason_text
      ? String(raw.denial_reason_text).trim()
      : "",
    provider_name: raw.provider_name ? String(raw.provider_name).trim() : "",
    provider_npi: raw.provider_npi ? String(raw.provider_npi).trim() : "",
  };
}

function verbatimInRaw(val: unknown, raw: string): boolean {
  if (!val || !raw) return false;
  return raw.toLowerCase().includes(String(val).toLowerCase());
}

function fieldConfidence(
  field: string,
  val: unknown,
  raw: string
): "high" | "low" {
  if (val == null || val === "" || (Array.isArray(val) && !val.length)) {
    return "low";
  }
  if (Array.isArray(val)) {
    const hits = val.filter((x) => verbatimInRaw(x, raw)).length;
    const ratio = hits / val.length;
    return ratio >= 0.5 ? "high" : "low";
  }
  if (verbatimInRaw(val, raw)) return "high";
  if (field === "denial_reason_text" && String(val).length >= 20) return "high";
  return "low";
}

function toApiResponse(
  extracted: ReturnType<typeof postProcess>,
  rawText: string
) {
  const fc = {
    patientName: fieldConfidence(
      "patient_name",
      extracted.patient_name,
      rawText
    ),
    providerName: fieldConfidence(
      "provider_name",
      extracted.provider_name,
      rawText
    ),
    providerNpi: fieldConfidence(
      "provider_npi",
      extracted.provider_npi,
      rawText
    ),
    payerName: fieldConfidence("payer_name", extracted.payer_name, rawText),
    claimNumber: fieldConfidence(
      "claim_number",
      extracted.claim_number,
      rawText
    ),
    dateOfService: fieldConfidence(
      "date_of_service",
      extracted.date_of_service,
      rawText
    ),
    denialReason: fieldConfidence(
      "denial_reason_text",
      extracted.denial_reason_text,
      rawText
    ),
    carcCodes: fieldConfidence("carc_codes", extracted.carc_codes, rawText),
    rarcCodes: fieldConfidence("rarc_codes", extracted.rarc_codes, rawText),
    billedAmount: fieldConfidence(
      "billed_amount",
      extracted.billed_amount,
      rawText
    ),
    paidAmount: fieldConfidence("paid_amount", extracted.paid_amount, rawText),
    cptCodes: fieldConfidence("cpt_codes", extracted.cpt_codes, rawText),
    icd10Codes: fieldConfidence("icd10_codes", extracted.icd10_codes, rawText),
  };

  return {
    success: true,
    patientName: extracted.patient_name || "",
    patientNameConfidence: fc.patientName,
    providerName: extracted.provider_name || "",
    providerNameConfidence: fc.providerName,
    providerNpi: extracted.provider_npi || "",
    providerNpiConfidence: fc.providerNpi,
    payerName: extracted.payer_name || "",
    payerNameConfidence: fc.payerName,
    claimNumber: extracted.claim_number || "",
    claimNumberConfidence: fc.claimNumber,
    dateOfService: extracted.date_of_service || "",
    dateOfServiceConfidence: fc.dateOfService,
    denialReason: extracted.denial_reason_text || "",
    denialReasonConfidence: fc.denialReason,
    carcCodes: extracted.carc_codes || [],
    carcCodesConfidence: fc.carcCodes,
    rarcCodes: extracted.rarc_codes || [],
    rarcCodesConfidence: fc.rarcCodes,
    billedAmount: extracted.billed_amount || "",
    billedAmountConfidence: fc.billedAmount,
    paidAmount: extracted.paid_amount || "",
    paidAmountConfidence: fc.paidAmount,
    cptCodes: extracted.cpt_codes || [],
    cptCodesConfidence: fc.cptCodes,
    icd10Codes: extracted.icd10_codes || [],
    icd10CodesConfidence: fc.icd10Codes,
  };
}

async function extractWithOpenAI(rawText: string): Promise<RawExtract> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extract structured denial data from this document text:\n\n${rawText.slice(0, 120000)}`,
      },
    ],
  });
  const content = completion.choices[0]?.message?.content || "{}";
  return JSON.parse(content) as RawExtract;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let rawText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json(
          { success: false, error: "No file found in multipart upload" },
          { status: 400 }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      rawText = await extractTextFromPDF(Buffer.from(arrayBuffer));
    } else {
      let body: { text?: string } = {};
      try {
        body = (await request.json()) as { text?: string };
      } catch {
        return NextResponse.json(
          { success: false, error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      rawText = String(body.text || "").trim();
    }

    if (!rawText || rawText.length < 15) {
      return NextResponse.json(
        {
          success: false,
          error: "Text too short or could not extract text from PDF",
        },
        { status: 400 }
      );
    }

    const llmRaw = await extractWithOpenAI(rawText);
    const extracted = postProcess(llmRaw);
    const response = toApiResponse(extracted, rawText);

    return NextResponse.json(response);
  } catch (e) {
    console.error("[extract-denial]", e);
    const message =
      e instanceof Error ? e.message : "Extraction failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
