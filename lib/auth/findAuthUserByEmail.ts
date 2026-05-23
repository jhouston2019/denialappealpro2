/**
 * Resolve a Supabase Auth user id by email via GoTrue admin filter API.
 */
export async function findAuthUserIdByEmail(
  email: string
): Promise<string | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!baseUrl || !serviceKey) return null;

  const filter = encodeURIComponent(`email.eq.${trimmed}`);
  const url = `${baseUrl}/auth/v1/admin/users?filter=${filter}&per_page=1`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        "[findAuthUserIdByEmail] admin users filter failed:",
        res.status,
        await res.text().catch(() => "")
      );
      return null;
    }

    const json = (await res.json()) as {
      users?: { id: string; email?: string }[];
    };
    return json.users?.[0]?.id ?? null;
  } catch (err) {
    console.error("[findAuthUserIdByEmail] request failed:", err);
    return null;
  }
}
