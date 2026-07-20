import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAccountAfterCheckoutCore } from "@/lib/billing/createAccountAfterCheckoutCore";
import type { Database } from "@/lib/supabase-types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Submit the create-account form." },
    { status: 405 }
  );
}

export async function POST(request: NextRequest) {
  let body: {
    session_id?: string;
    password?: string;
    confirm_password?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await createAccountAfterCheckoutCore({
    sessionId: body.session_id ?? "",
    password: body.password ?? "",
    confirmPassword: body.confirm_password ?? "",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  let response = NextResponse.json({ ok: true, redirectTo: "/app" });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: result.email,
    password: body.password ?? "",
  });

  if (signInErr) {
    return NextResponse.json(
      {
        error:
          signInErr.message ||
          "Password was set but sign-in failed. Try logging in manually.",
      },
      { status: 400 }
    );
  }

  return response;
}
