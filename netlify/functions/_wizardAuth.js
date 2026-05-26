/**
 * Wizard API auth: Supabase JWT or Bearer "bypass" when allowed.
 */

const { createClient } = require("@supabase/supabase-js");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function optionsResponse() {
  return { statusCode: 200, headers: corsHeaders, body: "" };
}

async function verifyWizardAuth(event) {
  const authHeader =
    event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return {
      ok: false,
      response: {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing authorization" }),
      },
    };
  }

  if (token === "preview") {
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, user: { id: "preview", email: null, isPreview: true } };
    }
    return {
      ok: false,
      response: {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Preview auth is not allowed in production",
        }),
      },
    };
  }

  if (token === "bypass") {
    const isProduction =
      process.env.NODE_ENV === "production" ||
      process.env.NETLIFY_CONTEXT === "production" ||
      process.env.CONTEXT === "production";

    const bypassAllowed =
      !isProduction &&
      (process.env.WIZARD_ALLOW_BYPASS === "true" ||
        process.env.WIZARD_ALLOW_BYPASS === "1");

    if (bypassAllowed) {
      return { ok: true, user: { id: "bypass", email: "wizard@local" } };
    }
    return {
      ok: false,
      response: {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: isProduction
            ? "Bypass is not allowed in production"
            : "Bypass disabled: set WIZARD_ALLOW_BYPASS=true or sign in",
        }),
      },
    };
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return {
      ok: false,
      response: {
        statusCode: 503,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Supabase auth not configured" }),
      },
    };
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      ok: false,
      response: {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid or expired session" }),
      },
    };
  }

  return { ok: true, user };
}

module.exports = { corsHeaders, optionsResponse, verifyWizardAuth };
