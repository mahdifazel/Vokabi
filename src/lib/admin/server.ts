import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Server-side admin helpers. These run only in API route handlers and use the
 * Supabase service-role key, which bypasses row-level security — it must never
 * reach the client. Admin access is an email allowlist in ADMIN_EMAILS.
 */

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AdminContext = { svc: SupabaseClient; user: User };

export async function requireAdmin(
  req: Request
): Promise<AdminContext | { error: NextResponse }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error: NextResponse.json(
        { error: "Admin API not configured: set SUPABASE_SERVICE_ROLE_KEY" },
        { status: 501 }
      ),
    };
  }
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (admins.length === 0) {
    return {
      error: NextResponse.json(
        { error: "Admin API not configured: set ADMIN_EMAILS" },
        { status: 501 }
      ),
    };
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }

  const svc = serviceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data.user) {
    return { error: NextResponse.json({ error: "Invalid session" }, { status: 401 }) };
  }
  if (!admins.includes(data.user.email?.toLowerCase() ?? "")) {
    return { error: NextResponse.json({ error: "Not an admin" }, { status: 403 }) };
  }
  return { svc, user: data.user };
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}
