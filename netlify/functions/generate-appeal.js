/**
 * generate-appeal.js — Authenticated appeal letter generation + Supabase save.
 * Phase 1: prompts are built from a FactLedger only (no raw OCR/PDF text).
 */

const { createClient } = require("@supabase/supabase-js");
const {
  corsHeaders,
  optionsResponse,
  verifyWizardAuth,
} = require("./_wizardAuth.js");
const {
  generateAppealLetter,
  validateLetter,
  isFactLedger,
} = require("../../lib/appeal/netlify-entry.ts");

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

function patientNameFromLedger(ledger) {
  const v = ledger?.facts?.["patient.name"]?.value;
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] || null;
  const s = String(v).trim();
  return s || null;
}

function captureSentryException(error, context) {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = require("@sentry/node");
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
    if (context) {
      Sentry.withScope((scope) => {
        scope.setContext("generate-appeal", context);
        Sentry.captureException(error);
      });
      return;
    }
    Sentry.captureException(error);
  } catch {
    /* Sentry optional */
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();

  try {

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

  const ledger = body.ledger;
  if (!isFactLedger(ledger)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: "Fact ledger is required for appeal generation",
      }),
    };
  }

  // Never accept raw document / OCR text into generation.
  if (body.rawText || body.documentText || body.ocrText || body.pdfText) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: "Raw document text is not accepted; use the fact ledger only",
      }),
    };
  }

  let generation;
  try {
    generation = await generateAppealLetter(ledger, {
      allowDeterministicFallback: false,
      model: "gpt-4o",
    });
  } catch (e) {
    captureSentryException(e, { route: "generate-appeal" });
    console.error("[generate-appeal] generate:", e);
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: e?.message || "Letter generation failed",
      }),
    };
  }

  const letterText = generation.text;
  const generatorPath = generation.generatorPath;
  const validationErrors = validateLetter(letterText, ledger);
  const exportAllowed = validationErrors.length === 0;

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const intakePayload = {
    ...body,
    ledger,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("reviews")
    .insert({
      user_id: auth.user.id,
      letter_text: letterText,
      insured_name: patientNameFromLedger(ledger),
      letter_type: "APPEAL",
      ai_summary_json: {
        status: "completed",
        intake: intakePayload,
        ledger,
        validationErrors,
        exportAllowed,
        generatorPath,
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
      validationErrors,
      exportAllowed,
      generatorPath,
    }),
  };
  } catch (err) {
    captureSentryException(err, { route: "generate-appeal", stage: "handler" });
    console.error("[generate-appeal] unhandled:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: err?.message || "Internal server error",
      }),
    };
  }
};
