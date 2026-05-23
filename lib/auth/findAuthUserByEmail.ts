import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function serviceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Resolve a Supabase Auth user id by email via GoTrue admin listUsers filter.
 */
export async function findAuthUserIdByEmail(
  email: string
): Promise<string | null> {
  const trimmed = email.trim();
  if (trimmed.length < 3) return null;

  const supabase = serviceSupabase();
  if (!supabase) {
    console.error(
      "[findAuthUserIdByEmail] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
    return null;
  }

  const target = trimmed.toLowerCase();

  const { data: filtered, error: filterErr } =
    await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 50,
      filter: trimmed,
    });

  if (!filterErr && filtered?.users?.length) {
    const exact = filtered.users.find(
      (u) => u.email?.trim().toLowerCase() === target
    );
    if (exact?.id) return exact.id;
  } else if (filterErr) {
    console.warn("[findAuthUserIdByEmail] listUsers filter failed:", filterErr);
  }

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      console.error("[findAuthUserIdByEmail] listUsers page failed:", error);
      break;
    }
    const found = data.users.find(
      (u) => u.email?.trim().toLowerCase() === target
    );
    if (found?.id) return found.id;
    if (data.users.length < 200) break;
  }

  return null;
}
