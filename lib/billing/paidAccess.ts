/**
 * Service-role mirror of `user_has_paid_access()` for post-sync verification.
 */
import { createClient } from "@supabase/supabase-js";

function getSupabaseService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function userHasPaidAccessForUserId(
  userId: string
): Promise<boolean> {
  const supabase = getSupabaseService();
  const { data: usageRows, error: uErr } = await supabase
    .from("user_review_usage")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .gt("billing_period_end", new Date().toISOString())
    .limit(1);

  if (!uErr && usageRows && usageRows.length > 0) return true;

  const { data: row, error: userErr } = await supabase
    .from("users")
    .select("plan_type, team_id")
    .eq("id", userId)
    .maybeSingle();

  if (userErr || !row) return false;

  if (row.plan_type != null && String(row.plan_type).trim() !== "") {
    return true;
  }

  if (!row.team_id) return false;

  const { data: team, error: tErr } = await supabase
    .from("teams")
    .select("id, stripe_subscription_status")
    .eq("id", row.team_id)
    .maybeSingle();

  if (tErr || !team?.id) return false;

  const st = (team.stripe_subscription_status ?? "active").toLowerCase();
  return ["active", "trialing", "past_due"].includes(st);
}
