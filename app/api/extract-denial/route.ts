/**
 * extract-denial — Free preview extraction from denial letter PDF or pasted text.
 * POST multipart/form-data (file) OR JSON { text: string }
 * Returns a FactLedger (+ thin legacy shape for existing consumers).
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  ledgerToLegacyShape,
  withDenialReason,
} from "@/lib/appeal/ledger/adapter";
import { buildLedgerFromExtraction } from "@/lib/appeal/ledger/fromExtraction";
import type { FactLedger } from "@/lib/appeal/ledger/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXTRACTION_SYSTEM_PROMPT = `You are a medical billing denial extraction engine.

Extract structured claim data from the input text.

The input may be messy, incomplete, or poorly formatted.

You MUST return a single JSON object with EXACTLY these keys (use null when unknown — never omit a key).
These are the ONLY allowed keys. Do NOT invent clinical facts, diagnoses, indications, urgency, or treatment history.

ALLOWED KEYS (non-clinical only):
- payer_name: insurance payer / plan name
- claim_number
- patient_name: full patient or member name as printed (Patient, Member, Subscriber, Insured, Beneficiary, Pt Name)
- member_id: member / subscriber ID as printed
- group_name
- group_number
- date_of_birth: YYYY-MM-DD when possible
- date_of_service: service or DOS date; YYYY-MM-DD when possible
- date_processed: claim processed / EOB date; YYYY-MM-DD when possible
- cpt_codes: array of procedure codes
- icd10_codes: array of ICD-10 diagnosis codes as printed on the document (e.g. "M16.11")
- modifiers: array
- carc_codes: array of numeric CARC values only (e.g. "50")
- rarc_codes: array (e.g. "N115")
- billed_amount: numeric only
- allowed_amount: numeric only
- paid_amount: numeric only
- denied_amount: numeric only (amount denied / patient responsibility for denied lines if stated)
- timely_filing_days: number of days if stated
- payer_appeal_address: appeal mailing address if present
- appeal_address_block: full appeal address block if present
- denial_reason_text: short exact denial wording from the document (1–2 sentences max)

Do NOT return diagnosis narrative, clinical urgency, treatment history, or other clinical fields beyond icd10_codes.
Do not rename keys. Do not nest patient name under another object.

-----------------------------------
RULES:
-----------------------------------

1. DO NOT GUESS
   - If a value is not literally present in the document, return null for that key
   - Never infer, never substitute a plausible default, never carry a value from a different field

2. HANDLE MULTIPLE VALUES
   - CPT, CARC, RARC, modifiers must be arrays (use [] when none)

3. NORMALIZE DATA:
   - CPT codes: numeric strings (e.g. "99213")
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
  "member_id": null,
  "group_name": null,
  "group_number": null,
  "date_of_birth": null,
  "date_of_service": null,
  "date_processed": null,
  "cpt_codes": [],
  "modifiers": [],
  "carc_codes": [],
  "rarc_codes": [],
  "billed_amount": null,
  "allowed_amount": null,
  "paid_amount": null,
  "denied_amount": null,
  "timely_filing_days": null,
  "payer_appeal_address": null,
  "appeal_address_block": null,
  "denial_reason_text": null
}

Use null for unknown scalars and [] for unknown arrays (not empty string for scalars).`;

type RawExtract = Record<string, unknown>;

async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(pdfBuffer);
  return String(data.text || "").trim();
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

function normalizeAmount(val: unknown): string | null {
  if (val == null || val === "") return null;
  const s = String(val).replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

function normalizeDate(val: unknown): string | null {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const mm = String(parseInt(m[1], 10)).padStart(2, "0");
    const dd = String(parseInt(m[2], 10)).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  return s.slice(0, 10) || null;
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
  if (!d.member_id && d.subscriber_id) d.member_id = d.subscriber_id;
  if (!d.payer_appeal_address && d.appeal_address) {
    d.payer_appeal_address = d.appeal_address;
  }
  if (
    !Array.isArray(d.icd10_codes) &&
    Array.isArray(d.icd_codes) &&
    d.icd_codes.length
  ) {
    d.icd10_codes = d.icd_codes;
  }
  return d;
}

function nullIfEmpty(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t || null;
}

function postProcess(data: RawExtract | null | undefined): Record<string, unknown> {
  const raw = applyAliases(data || {});
  const carc = dedupe(
    (Array.isArray(raw.carc_codes) ? raw.carc_codes : [])
      .map(normalizeCarc)
      .filter(Boolean)
  );
  const rarc = dedupe(
    (Array.isArray(raw.rarc_codes) ? raw.rarc_codes : [])
      .map(normalizeRarc)
      .filter(Boolean)
  );
  const cpt = dedupe(
    Array.isArray(raw.cpt_codes) ? raw.cpt_codes.map(String) : []
  );
  const modifiers = dedupe(
    Array.isArray(raw.modifiers) ? raw.modifiers.map(String) : []
  );

  const icdRaw = Array.isArray(raw.icd10_codes)
    ? raw.icd10_codes
    : Array.isArray(raw.icd_codes)
      ? raw.icd_codes
      : [];
  const icd = dedupe(
    icdRaw.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
  );

  return {
    payer_name: nullIfEmpty(
      raw.payer_name != null ? String(raw.payer_name) : null
    ),
    claim_number: nullIfEmpty(
      raw.claim_number != null ? String(raw.claim_number) : null
    ),
    patient_name: nullIfEmpty(
      raw.patient_name != null ? String(raw.patient_name) : null
    ),
    member_id: nullIfEmpty(
      raw.member_id != null ? String(raw.member_id) : null
    ),
    group_name: nullIfEmpty(
      raw.group_name != null ? String(raw.group_name) : null
    ),
    group_number: nullIfEmpty(
      raw.group_number != null ? String(raw.group_number) : null
    ),
    date_of_birth: normalizeDate(raw.date_of_birth),
    date_of_service: normalizeDate(raw.date_of_service),
    date_processed: normalizeDate(raw.date_processed),
    cpt_codes: cpt.length ? cpt : null,
    icd10_codes: icd.length ? icd : null,
    modifiers: modifiers.length ? modifiers : null,
    carc_codes: carc.length ? carc : null,
    rarc_codes: rarc.length ? rarc : null,
    billed_amount: normalizeAmount(raw.billed_amount),
    allowed_amount: normalizeAmount(raw.allowed_amount),
    paid_amount: normalizeAmount(raw.paid_amount),
    denied_amount: normalizeAmount(raw.denied_amount),
    timely_filing_days:
      raw.timely_filing_days != null && String(raw.timely_filing_days).trim()
        ? String(raw.timely_filing_days).replace(/\D/g, "") || null
        : null,
    payer_appeal_address: nullIfEmpty(
      raw.payer_appeal_address != null
        ? String(raw.payer_appeal_address)
        : null
    ),
    appeal_address_block: nullIfEmpty(
      raw.appeal_address_block != null
        ? String(raw.appeal_address_block)
        : null
    ),
    denial_reason_text: nullIfEmpty(
      raw.denial_reason_text != null ? String(raw.denial_reason_text) : null
    ),
  };
}

function denialReasonConfidence(
  text: string | null,
  rawText: string
): "high" | "low" {
  if (!text) return "low";
  if (rawText.toLowerCase().includes(text.toLowerCase())) return "high";
  if (text.length >= 20) return "high";
  return "low";
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
    let documentId = "upload";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json(
          { success: false, error: "No file found in multipart upload" },
          { status: 400 }
        );
      }
      documentId = file.name || "upload";
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
      documentId = "paste";
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

    if (process.env.NODE_ENV !== "production") {
      console.log("[extract-denial] raw LLM response:", llmRaw);
    }

    const extracted = postProcess(llmRaw);
    const { ledger, denialReasonText } = buildLedgerFromExtraction({
      fields: extracted,
      rawText,
      documentId,
    });

    const legacy = withDenialReason(
      ledgerToLegacyShape(ledger),
      denialReasonText,
      denialReasonConfidence(denialReasonText, rawText)
    );

    const response: Record<string, unknown> = {
      ...legacy,
      success: true,
      ledger: ledger as FactLedger,
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error("[extract-denial]", e);
    const message = e instanceof Error ? e.message : "Extraction failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
