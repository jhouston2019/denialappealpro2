/**
 * Creates or resets an admin test user in Supabase Auth + public.users.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   ADMIN_USER_EMAIL    (default: admin@denialappealpro.local)
 *   ADMIN_USER_PASSWORD (default: AdminTestPassword123!)
 *
 * Usage: npm run test:seed-admin
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnvLocal() {
  const envPath = join(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) {
    console.error("❌ Missing .env.local — copy from .env.local.example and add Supabase keys.");
    process.exit(1);
  }
  const envContent = readFileSync(envPath, "utf8");
  const vars = {};
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=#]+)=(.*)$/);
    if (match) {
      vars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return vars;
}

const envVars = loadEnvLocal();
const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const email = envVars.ADMIN_USER_EMAIL || "admin@denialappealpro.local";
const password = envVars.ADMIN_USER_PASSWORD || "AdminTestPassword123!";

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Missing Supabase credentials in .env.local");
  if (!supabaseUrl) {
    console.error("   Set NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceKey) {
    console.error("   Set SUPABASE_SERVICE_ROLE_KEY");
  }
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(targetEmail) {
  const { data: fromPublic, error: pubErr } = await supabase
    .from("users")
    .select("id, email")
    .ilike("email", targetEmail)
    .maybeSingle();

  if (pubErr) {
    throw new Error(`public.users lookup failed: ${pubErr.message}`);
  }
  if (fromPublic?.id) {
    return { id: fromPublic.id, email: fromPublic.email };
  }

  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listErr) {
    throw new Error(`listUsers failed: ${listErr.message}`);
  }

  const found = listData.users.find(
    (u) => (u.email ?? "").toLowerCase() === targetEmail.toLowerCase()
  );
  if (!found) return null;
  return { id: found.id, email: found.email ?? targetEmail };
}

async function ensureAuthUser() {
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!createErr && created?.user) {
    return created.user.id;
  }

  const msg = createErr?.message || "";
  if (!/already|registered|exists/i.test(msg)) {
    throw new Error(`createUser failed: ${createErr?.message}`);
  }

  const existing = await findUserByEmail(email);
  if (!existing) {
    throw new Error("User exists but could not be found by email");
  }

  const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (updErr) {
    throw new Error(`updateUserById failed: ${updErr.message}`);
  }

  return existing.id;
}

async function ensurePublicUserRow(userId) {
  const { error: upsertErr } = await supabase.from("users").upsert(
    { id: userId, email },
    { onConflict: "id" }
  );
  if (upsertErr) {
    throw new Error(`public.users upsert failed: ${upsertErr.message}`);
  }

  const { error: adminErr } = await supabase
    .from("users")
    .update({ is_admin: true })
    .eq("id", userId);
  if (adminErr) {
    throw new Error(`public.users is_admin update failed: ${adminErr.message}`);
  }
}

async function ensureAdminAppMetadata(userId) {
  const { data: existing, error: getErr } = await supabase.auth.admin.getUserById(userId);
  if (getErr || !existing.user) {
    throw new Error(`getUserById failed: ${getErr?.message}`);
  }

  const raw = existing.user.app_metadata;
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
  base.is_admin = true;

  const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: base,
  });
  if (updErr) {
    throw new Error(`app_metadata update failed: ${updErr.message}`);
  }
}

async function main() {
  console.log("Seeding admin user…\n");

  const userId = await ensureAuthUser();
  await ensurePublicUserRow(userId);
  await ensureAdminAppMetadata(userId);

  const appUrl = envVars.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  console.log("✅ Admin user ready\n");
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   User id:  ${userId}`);
  console.log(`\n   Log in at: ${appUrl.replace(/\/$/, "")}/admin/login`);
  console.log("\n   Tip: set BYPASS_PAYMENT=true in .env.local to skip Stripe during local testing.\n");
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
