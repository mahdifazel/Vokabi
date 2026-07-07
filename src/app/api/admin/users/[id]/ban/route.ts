import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/admin/server";

/** Ban (100 years) or unban a user. Body: { banned: boolean } */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (id === auth.user.id) return jsonError("You can't ban your own admin account", 400);

  const { banned } = (await req.json().catch(() => ({}))) as { banned?: boolean };
  if (typeof banned !== "boolean") return jsonError("Body must be { banned: boolean }", 400);

  const { error } = await auth.svc.auth.admin.updateUserById(id, {
    ban_duration: banned ? "876600h" : "none",
  });
  if (error) return jsonError(error.message);
  return NextResponse.json({ ok: true, banned });
}
