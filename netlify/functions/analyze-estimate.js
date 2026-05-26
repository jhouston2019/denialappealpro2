/**
 * analyze-estimate.js — Phase 0 wizard contract
 * POST JSON → structured analysis (no legal citations, no fabricated codes).
 */

const OpenAI = require("openai");
const {
  corsHeaders,
  optionsResponse,
  verifyWizardAuth,
} = require("./_wizardAuth.js");

const CANONICAL_STRATEGIES = [
  "FULL_SUPPLEMENT_DEMAND",
  "PARTIAL_DISPUTE",
  "DEMAND_REINSPECTION",
  "INVOKE_APPRAISAL",
  "OTHER_CUSTOM",
];

const ANALYSIS_SYSTEM_PROMPT = `You analyze property/casualty CARRIER ESTIMATE text (line items, totals, scope).
Return ONE JSON object only (no markdown) with this exact shape and key names:

{
  "trueLossRange": { "low": number, "high": number },
  "riskLevel": "low" | "moderate" | "high",
  "scopeOmissions": string[],
  "pricingFlags": string[],
  "codeUpgradeGaps": string[],
  "opFindings": string[],
  "proceduralDefects": string[],
  "disputeAngles": string[],
  "actionItems": string[],
  "requiredDocuments": string[],
  "escalationOptions": string[],
  "availableStrategies": string[],
  "recommendedStrategy": string
}

Rules:
- Base findings ONLY on the provided estimate text and metadata. Do not invent Xactimate codes, statute numbers, case citations, or policy language not evidenced in the text.
- "trueLossRange" must be a plausible numeric band informed by the estimate content (e.g. line totals, obvious omissions); if uncertain, use a conservative band still tied to described scope — never fabricate external pricing databases.
- "availableStrategies" must be a non-empty subset of these exact strings only:
  FULL_SUPPLEMENT_DEMAND, PARTIAL_DISPUTE, DEMAND_REINSPECTION, INVOKE_APPRAISAL, OTHER_CUSTOM
- "recommendedStrategy" must equal one member of "availableStrategies".
- Arrays may be empty but must be arrays of strings.
- riskLevel must be exactly low, moderate, or high.`;

function extractCarrierAmountFromDocument(documentText) {
  if (!documentText || typeof documentText !== "string") return 0;
  const moneyRe = /\$\s*([\d,]+(?:\.\d{1,2})?)/g;
  const keywords =
    /total|rcv|replacement\s*cost|grand\s*total|amount\s*due|estimate\s*total|subtotal|net\s*claim/i;

  let bestFromKeywordLine = 0;
  for (const line of documentText.split(/\r?\n/)) {
    if (!keywords.test(line)) continue;
    let m;
    const re = new RegExp(moneyRe.source, "gi");
    while ((m = re.exec(line)) !== null) {
      const n = parseFloat(String(m[1]).replace(/,/g, ""));
      if (Number.isFinite(n) && n > bestFromKeywordLine) bestFromKeywordLine = n;
    }
  }

  let bestGlobal = 0;
  let m;
  const globalRe = new RegExp(moneyRe.source, "g");
  while ((m = globalRe.exec(documentText)) !== null) {
    const n = parseFloat(String(m[1]).replace(/,/g, ""));
    if (Number.isFinite(n) && n < 1e9 && n > bestGlobal) bestGlobal = n;
  }

  const v = bestFromKeywordLine > 0 ? bestFromKeywordLine : bestGlobal;
  return Math.round(v * 100) / 100;
}

function clampStrategies(arr) {
  const raw = Array.isArray(arr) ? arr : [];
  const filtered = raw.filter((s) => CANONICAL_STRATEGIES.includes(s));
  const uniq = [...new Set(filtered)];
  if (uniq.length === 0) return [...CANONICAL_STRATEGIES];
  return uniq;
}

function normalizeRisk(r) {
  const x = String(r || "").toLowerCase();
  if (x === "low" || x === "moderate" || x === "high") return x;
  if (x === "medium") return "moderate";
  return "moderate";
}

function ensureStringArray(a) {
  if (!Array.isArray(a)) return [];
  return a.map((x) => String(x)).filter(Boolean);
}

function defaultTrueLossRange(carrierAmount) {
  if (!(carrierAmount > 0)) return { low: 0, high: 0 };
  const low = Math.round(carrierAmount * 0.9 * 100) / 100;
  const high = Math.round(carrierAmount * 1.15 * 100) / 100;
  return { low, high };
}

function mergeTrueLossRange(parsed, carrierAmount) {
  const low = Number(parsed?.trueLossRange?.low);
  const high = Number(parsed?.trueLossRange?.high);
  if (
    Number.isFinite(low) &&
    Number.isFinite(high) &&
    low >= 0 &&
    high >= low
  ) {
    // Model bands are often tight around the extracted carrier total; widen the
    // ceiling so midpoint − carrier reflects plausible supplementation (e.g. RCV
    // vs initial line total) without changing the extracted carrier amount.
    const ceiling = Math.round(carrierAmount * 1.21 * 100) / 100;
    return { low, high: Math.max(high, ceiling) };
  }
  return defaultTrueLossRange(carrierAmount);
}

function pickRecommended(available, raw) {
  const s = String(raw || "").trim();
  if (available.includes(s)) return s;
  return available[0];
}

function buildUserPayload(body, carrierAmount) {
  const contractor =
    body.contractorText == null ? null : String(body.contractorText);
  return `CARRIER ESTIMATE TEXT (primary source for findings):
${String(body.documentText || "")}

OPTIONAL CONTRACTOR / INDEPENDENT ESTIMATE TEXT (may be null):
${contractor == null ? "null" : contractor}

EXTRACTED_CARRIER_AMOUNT_FROM_DOCUMENT (numeric, authoritative for carrier total line — use only as context, do not contradict with a different "carrier" field in JSON): ${carrierAmount}

METADATA (context only — do not invent dollar totals from claim type alone):
insuredName: ${body.insuredName || ""}
claimType: ${body.claimType || ""}
state: ${body.state || ""}
policyNumber: ${body.policyNumber || ""}
claimNumber: ${body.claimNumber || ""}
dateOfLoss: ${body.dateOfLoss || ""}
adjusterName: ${body.adjusterName || ""}
disputedAmount (user-normalized string): ${body.disputedAmount || ""}
responseDeadline: ${body.responseDeadline || ""}`;
}

function buildAnalysisSystemPrompt(categoryRaw) {
  const c = String(categoryRaw || "").trim().toUpperCase();
  if (!c) return ANALYSIS_SYSTEM_PROMPT;
  const allowed = new Set([
    "BUILDING",
    "CONTENTS",
    "ALE",
    "MITIGATION",
    "OTHER",
  ]);
  const scope = allowed.has(c) ? c : "OTHER";
  return `This estimate covers ${scope} scope.\n\n${ANALYSIS_SYSTEM_PROMPT}`;
}

function emptyResult(carrierAmount, note) {
  const available = [...CANONICAL_STRATEGIES];
  return {
    carrierAmount,
    trueLossRange: defaultTrueLossRange(carrierAmount),
    riskLevel: "moderate",
    scopeOmissions: note ? [note] : [],
    pricingFlags: [],
    codeUpgradeGaps: [],
    opFindings: [],
    proceduralDefects: [],
    disputeAngles: [],
    actionItems: [
      "Verify all line items and totals against field scope and photos.",
    ],
    requiredDocuments: ["Complete carrier estimate", "Policy declarations"],
    escalationOptions: [
      "Written supplement request to carrier",
      "Appraisal (if policy permits)",
      "Department of insurance inquiry (as applicable)",
    ],
    availableStrategies: available,
    recommendedStrategy: "FULL_SUPPLEMENT_DEMAND",
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed", code: "METHOD" }),
    };
  }

  const auth = await verifyWizardAuth(event);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Invalid JSON body",
        code: "JSON_PARSE",
      }),
    };
  }

  // OCR branch — handles scanned PDF pages sent as base64 images
  if (body.mode === "extract_only") {
    const { images, fileName } = body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "No images provided", code: "NO_IMAGES" }),
      };
    }
    console.log(
      "OCR ENV CHECK:",
      !!process.env.OPENAI_API_KEY,
      Object.keys(process.env).filter((k) => k.includes("OPENAI"))
    );
    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "OpenAI API key not configured",
          code: "NO_OPENAI",
        }),
      };
    }
    const content = [
      {
        type: "text",
        text: "Extract all text from this insurance estimate document. Return the complete text including all line items, quantities, unit prices, totals, header information (insured name, policy number, claim number, date of loss, adjuster name, carrier name), and any other visible text. Preserve structure as much as possible. Return plain text only.",
      },
      ...images.map((base64) => ({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" },
      })),
    ];
    try {
      console.log("OCR INPUT:", {
        imageCount: images.length,
        firstImageSize: images[0]?.length,
      });
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 4000,
        messages: [{ role: "user", content }],
      });
      const extractedText = response.choices[0]?.message?.content ?? "";
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          text: extractedText,
          pages: images.length,
          fileName: fileName ?? null,
        }),
      };
    } catch (err) {
      console.error("OCR ERROR:", err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: err.message || String(err),
          stack: err.stack || null,
          code: "OCR_FAILED",
        }),
      };
    }
  }

  const documentText = String(body.documentText || "").trim();
  if (!documentText) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "documentText is required",
        code: "MISSING_DOCUMENT",
      }),
    };
  }

  const carrierAmount = extractCarrierAmountFromDocument(documentText);

  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "OpenAI API key not configured",
        code: "NO_OPENAI",
      }),
    };
  }

  const userMessage = buildUserPayload(body, carrierAmount);
  const systemPrompt = buildAnalysisSystemPrompt(body.category);

  let parsed;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("analyze-estimate OpenAI:", e);
    const out = emptyResult(
      carrierAmount,
      "Automated analysis failed — review estimate manually."
    );
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(out),
    };
  }

  const availableStrategies = clampStrategies(parsed.availableStrategies);
  const recommendedStrategy = pickRecommended(
    availableStrategies,
    parsed.recommendedStrategy
  );

  const out = {
    carrierAmount,
    trueLossRange: mergeTrueLossRange(parsed, carrierAmount),
    riskLevel: normalizeRisk(parsed.riskLevel),
    scopeOmissions: ensureStringArray(parsed.scopeOmissions),
    pricingFlags: ensureStringArray(parsed.pricingFlags),
    codeUpgradeGaps: ensureStringArray(parsed.codeUpgradeGaps),
    opFindings: ensureStringArray(parsed.opFindings),
    proceduralDefects: ensureStringArray(parsed.proceduralDefects),
    disputeAngles: ensureStringArray(parsed.disputeAngles),
    actionItems: ensureStringArray(parsed.actionItems),
    requiredDocuments: ensureStringArray(parsed.requiredDocuments),
    escalationOptions: ensureStringArray(parsed.escalationOptions),
    availableStrategies,
    recommendedStrategy,
  };

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(out),
  };
};
