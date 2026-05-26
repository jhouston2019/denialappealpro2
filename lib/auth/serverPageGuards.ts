import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { isPaymentBypassActive } from "@/lib/billing/devBypass";
import { createSupabaseServerComponentClient } from "@/lib/supabaseServer";

function assertProductionPaymentBypassNotMisconfigured(): void {
  if (
    process.env.NODE_ENV === "production" &&
    (process.env.BYPASS_PAYMENT === "true" || process.env.BYPASS_PAYMENT === "1")
  ) {
    redirect("/");
  }
}

type UsersRow = {
  is_admin: boolean | null;
  plan_type: string | null;
};

/**
 * Resolves a real `public.users` row: maybeSingle, then upsert + re-read if missing.
 * No in-memory “fake” row — access is always based on DB state.
 */
async function getOrCreateUsersRow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerComponentClient>>,
  user: User,
  onReadOrUpsertFailed: string
): Promise<{ is_admin: boolean; plan_type: string | null }> {
  const { data } = await supabase
    .from("users" as any)
    .select("is_admin, plan_type")
    .eq("id", user.id)
    .maybeSingle();

  let row = data as UsersRow | null;

  if (!row) {
    const { error: upErr } = await supabase
      .from("users" as any)
      .upsert(
        {
          id: user.id,
          email: user.email ?? `${user.id}@placeholder.local`,
        } as any,
        { onConflict: "id" }
      );
    if (upErr) {
      console.error("[serverPageGuards] users upsert failed:", upErr.message);
      redirect(onReadOrUpsertFailed);
    }
    const { data: freshData, error: readErr } = await supabase
      .from("users" as any)
      .select("is_admin, plan_type")
      .eq("id", user.id)
      .single();
    if (readErr || !freshData) {
      console.error(
        "[serverPageGuards] users re-read after upsert failed:",
        readErr?.message
      );
      redirect(onReadOrUpsertFailed);
    }
    row = freshData as UsersRow;
  }

  if (!row) {
    redirect(onReadOrUpsertFailed);
  }

  return {
    is_admin: row.is_admin === true,
    plan_type: row.plan_type,
  };
}

/**
 * Auth + product paywall. Entitlement is read only from a real `public.users` row.
 */
export async function requireUserAndPaywall(): Promise<{
  supabase: Awaited<ReturnType<typeof createSupabaseServerComponentClient>>;
  user: User;
}> {
  assertProductionPaymentBypassNotMisconfigured();
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const row = await getOrCreateUsersRow(
    supabase,
    user,
    "/pricing?message=payment_required"
  );

  const isAdmin = row.is_admin === true;

  if (!isPaymentBypassActive() && !isAdmin) {
    const { data: paid, error: paidErr } = await supabase.rpc(
      "user_has_paid_access"
    );
    if (paidErr) {
      console.error("[serverPageGuards] user_has_paid_access error:", paidErr);
      redirect("/pricing?message=payment_required");
    }
    if (paid !== true) {
      redirect("/pricing?message=payment_required");
    }
  }

  return { supabase, user };
}

/**
 * Admin routes (not `/admin/login`). Uses `public.users.is_admin` from a real row.
 */
export async function requireAdminUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createSupabaseServerComponentClient>>;
  user: User;
}> {
  assertProductionPaymentBypassNotMisconfigured();
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/admin/login");
  }

  const row = await getOrCreateUsersRow(supabase, user, "/admin/login");

  if (row.is_admin !== true) {
    redirect("/admin/login");
  }

  return { supabase, user };
}
