import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/admin/server";

/** Send a password-reset email to the user. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const { data, error } = await auth.svc.auth.admin.getUserById(id);
  if (error || !data.user?.email) return jsonError("User not found", 404);

  const { error: resetError } = await auth.svc.auth.resetPasswordForEmail(data.user.email);
  if (resetError) return jsonError(resetError.message);
  return NextResponse.json({ ok: true, email: data.user.email });
}
