import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlanReviewLimit } from "@/lib/billing/planLimits";

/**
 * Bump per-user review counter (service-role client; complements team usage).
 */
export async function incrementUserReviewUsage(
  supabase: SupabaseClient,
  userId: string,
  reviewsLimit: number
): Promise<void> {
  const { data: row } = await supabase
    .from("user_review_usage")
    .select("reviews_used")
    .eq("user_id", userId)
    .maybeSingle();

  const prev = (row as { reviews_used?: number } | null)?.reviews_used ?? 0;
  const { error } = await supabase.from("user_review_usage").upsert(
    {
      user_id: userId,
      reviews_used: prev + 1,
      reviews_limit: Math.max(reviewsLimit, 0),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("[incrementUserReviewUsage]", error);
  }
}

/**
 * Increment review usage — tries billing-period RPC first, then upserts on
 * user_review_usage (works with simplified schema rows that lack is_active).
 */
export async function incrementReviewUsageForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: rpcOk, error: rpcError } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        args: { user_id_param: string }
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc("increment_review_usage", { user_id_param: userId });

  if (!rpcError && rpcOk === true) {
    return true;
  }

  if (rpcError) {
    console.warn("[incrementReviewUsageForUser] RPC:", rpcError.message);
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("plan_type")
    .eq("id", userId)
    .maybeSingle();

  const planLimit = getPlanReviewLimit(
    (userRow as { plan_type?: string | null } | null)?.plan_type
  );

  const { data: row } = await supabase
    .from("user_review_usage")
    .select("reviews_used, reviews_limit")
    .eq("user_id", userId)
    .maybeSingle();

  const typed = row as {
    reviews_used?: number | null;
    reviews_limit?: number | null;
  } | null;
  const prev = typed?.reviews_used ?? 0;
  const storedLimit = typed?.reviews_limit ?? 0;
  const reviewsLimit =
    storedLimit > 0 ? storedLimit : planLimit != null ? planLimit : 0;

  const { error } = await supabase.from("user_review_usage").upsert(
    {
      user_id: userId,
      reviews_used: prev + 1,
      reviews_limit: Math.max(reviewsLimit, 0),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("[incrementReviewUsageForUser]", error);
    return false;
  }

  return true;
}
