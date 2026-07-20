/**
 * generate-appeal.js — Authenticated appeal letter generation + Supabase save.
 */

const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const {
  corsHeaders,
  optionsResponse,
  verifyWizardAuth,
} = require("./_wizardAuth.js");

const SUBMISSION_APPEAL_SYSTEM_PROMPT = `You are a senior healthcare attorney and certified professional coder (CPC) with 25 years of experience writing insurance appeal letters that are submitted to payers, reviewed by medical directors, and upheld in independent medical reviews and arbitration.

Your letters are indistinguishable from those written by human billing attorneys. They are precise, authoritative, and grounded in regulation — never generic, never templated-sounding, never vague.

OUTPUT RULES:
- Plain text only. No markdown. No bullet symbols. No # headers. No JSON.
- Write in formal legal/clinical prose — full paragraphs, no bullet lists in the body
- Never use filler phrases like "I hope this letter finds you well" or "Thank you for your consideration"
- Never use AI-sounding language like "it is important to note" or "it is worth mentioning"
- Never use placeholder text — if a value is missing, omit that line entirely
- Every sentence must add legal or clinical weight — no padding
- Minimum 500 words. Never truncate. Complete every sentence and every section.
- Format all dates in the letter as full month name, day, year (e.g. March 2, 2026) — never use ISO format (2026-03-02) anywhere in the letter including the Re: line and body

LETTER STRUCTURE:

Start the letter with only the lines you have real data for. Use this order:
- Provider name (only if provider_name exists and is not "Your Practice")
- Provider NPI (only if provider_npi exists and is not empty)
- Today's date (always include, use today_date field)
- "Appeals Review Department"
- Payer name

Do NOT output any bracket placeholders like [Provider Name], [Title], [NPI], [Phone/Fax], [Provider letterhead block], or [Provider Address if available] anywhere in the letter — not in the header, not in the signature block, not anywhere. If a value is missing, skip that line silently.

End the letter with:
- "Sincerely,"
- Provider name (only if available)
- NPI (only if available)
- Today's date

Re: Formal Appeal — Claim [Claim Number] | Patient: [Patient Name] | DOS: [Date of Service] | CPT: [CPT Codes] | Denial: [CARC/RARC Codes]

To the Appeals Review Department:

PARAGRAPH 1 — FORMAL NOTICE OF APPEAL
One authoritative paragraph. State that you are submitting a formal first-level appeal of the denial of claim [number] for services rendered on [date]. Cite the exact CARC and RARC codes. State the billed amount and denied amount. Assert that the denial is inconsistent with the patient's coverage, applicable payer policy, and federal/state billing regulations.

PARAGRAPH 2 — CLINICAL BACKGROUND AND MEDICAL NECESSITY
Two to three paragraphs. Describe the clinical picture: the patient's diagnosis (using the ICD-10 code and its full clinical name), why the procedures were performed, and why they were medically necessary for this specific condition. Cite relevant clinical guidelines by name — for example, AMA CPT guidelines, CMS National Coverage Determinations, or specialty society guidelines (AAD, ACS, ACC, etc.) that support the services billed. Be specific to the ICD-10 and CPT codes provided.

PARAGRAPH 3 — SPECIFIC REBUTTAL OF EACH DENIAL REASON
One to two paragraphs per denial code. For each CARC/RARC code:
- CARC 4 (modifier): Explain the correct modifier and why it applies; cite CMS modifier guidelines
- CARC 97 (bundling): Assert that the services are distinct and separately identifiable under NCCI editing guidelines; cite the specific NCCI chapter and policy manual language; explain why an exception applies
- CARC 50 / medical necessity: Cite the payer's own coverage policy by name and policy number if known; cite CMS LCD/NCD; cite peer-reviewed clinical evidence
- CARC 29 (timely filing): Cite proof of timely submission or extenuating circumstances under the payer's timely filing exception policy
- For any other code: research the code's meaning and write a precise, code-specific rebuttal
Write as a legal argument — assert facts, cite authority, demand reversal.

PARAGRAPH 4 — REGULATORY AND CONTRACTUAL BASIS
One paragraph. Cite the applicable legal framework: the provider's participation agreement, state prompt pay statutes if applicable, CMS Conditions of Participation, or the relevant sections of the ACA or ERISA that require coverage of medically necessary services. Assert that denial of this claim without adequate clinical basis constitutes a breach of the payer's obligations.

PARAGRAPH 5 — ENCLOSED DOCUMENTATION
List each enclosed document as a full sentence: "Enclosed herewith is [document name], which [explains what it shows]." Do not use bullet points.

PARAGRAPH 6 — DEMAND FOR ACTION
State the specific relief requested: full payment of $[billed amount] at the contracted rate. State the deadline by which you expect a written response (typically 30 days). State that failure to respond or uphold the denial without adequate clinical justification may result in escalation to the state insurance commissioner, independent medical review, or arbitration per the provider agreement.

TONE: Authoritative. Clinical. Legal. A medical director reading this letter should immediately understand that the provider knows the rules, knows the codes, and will escalate if necessary. This letter should make paying the claim the path of least resistance.
`;

function arr(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function buildStructuredIntake(body) {
  return {
    payer_name: String(body.payerName || "").trim(),
    claim_number: String(body.claimNumber || "").trim(),
    patient_name: String(body.patientName || "").trim(),
    date_of_service: String(body.dateOfService || "").trim(),
    cpt_codes: arr(body.cptCodes),
    icd10_codes: arr(body.icd10Codes),
    carc_codes: arr(body.carcCodes),
    rarc_codes: arr(body.rarcCodes),
    billed_amount: String(body.billedAmount || "").trim(),
    paid_amount: String(body.paidAmount || "").trim(),
    denial_reason_text: String(body.denialReason || "").trim(),
    provider_name: String(body.providerName || "").trim(),
    provider_npi: String(body.providerNpi || "").trim(),
    provider_address: String(body.providerAddress || "").trim(),
    provider_phone: String(body.providerPhone || "").trim(),
    provider_fax: String(body.providerFax || "").trim(),
    additional_context: String(body.additionalContext || "").trim(),
  };
}

function formatTodayDate() {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function incrementReviewUsage(supabase, userId) {
  const { data: rpcOk, error: rpcError } = await supabase.rpc(
    "increment_review_usage",
    { user_id_param: userId }
  );
  if (!rpcError && rpcOk === true) return true;

  const { data: userRow } = await supabase
    .from("users")
    .select("plan_type")
    .eq("id", userId)
    .maybeSingle();

  const planType = userRow?.plan_type;
  const planLimits = {
    single: 1,
    essential: 10,
    professional: 25,
    enterprise: 75,
  };
  const planLimit = planLimits[planType] ?? 0;

  const { data: row } = await supabase
    .from("user_review_usage")
    .select("reviews_used, reviews_limit")
    .eq("user_id", userId)
    .maybeSingle();

  const prev = row?.reviews_used ?? 0;
  const storedLimit = row?.reviews_limit ?? 0;
  const reviewsLimit =
    storedLimit > 0 ? storedLimit : planLimit > 0 ? planLimit : 0;

  const { error } = await supabase.from("user_review_usage").upsert(
    {
      user_id: userId,
      reviews_used: prev + 1,
      reviews_limit: Math.max(reviewsLimit, 0),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return !error;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: "Method not allowed" }),
    };
  }

  const auth = await verifyWizardAuth(event);
  if (!auth.ok) return auth.response;

  if (auth.user.isPreview || auth.user.id === "preview") {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: "Sign in and complete payment to generate your appeal letter",
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: "Invalid JSON body" }),
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: "Supabase not configured" }),
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: "OpenAI API key not configured" }),
    };
  }

  const structured = buildStructuredIntake(body);
  structured.today_date = formatTodayDate();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const userContent =
    "STRUCTURED CLAIM DATA (JSON — use only as facts; output must be plain text appeal, no JSON):\n" +
    JSON.stringify(structured, null, 2) +
    "\n\nGenerate the full appeal letter now, following the system instructions exactly.";

  let letterText = "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 4000,
      messages: [
        { role: "system", content: SUBMISSION_APPEAL_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });
    letterText = String(completion.choices[0]?.message?.content || "").trim();
  } catch (e) {
    console.error("[generate-appeal] OpenAI:", e);
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: e?.message || "Letter generation failed",
      }),
    };
  }

  if (!letterText) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: "Empty letter response" }),
    };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const intakePayload = {
    ...body,
    structured,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("reviews")
    .insert({
      user_id: auth.user.id,
      letter_text: letterText,
      insured_name: structured.patient_name || null,
      letter_type: "APPEAL",
      ai_summary_json: {
        status: "completed",
        intake: intakePayload,
      },
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    console.error("[generate-appeal] insert:", insertError);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: insertError?.message || "Failed to save review",
      }),
    };
  }

  try {
    await incrementReviewUsage(supabase, auth.user.id);
  } catch (usageErr) {
    console.error("[generate-appeal] increment usage:", usageErr);
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      reviewId: inserted.id,
      letterText,
    }),
  };
};
