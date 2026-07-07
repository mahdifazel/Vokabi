import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/admin/server";

/** Toggle an announcement. Body: { active: boolean } */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const { active } = (await req.json().catch(() => ({}))) as { active?: boolean };
  if (typeof active !== "boolean") return jsonError("Body must be { active: boolean }", 400);
  const { error } = await auth.svc.from("announcements").update({ active }).eq("id", id);
  if (error) return jsonError(error.message);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const { error } = await auth.svc.from("announcements").delete().eq("id", id);
  if (error) return jsonError(error.message);
  return NextResponse.json({ ok: true });
}
