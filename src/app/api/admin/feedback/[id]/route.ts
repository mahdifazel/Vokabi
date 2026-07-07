import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/admin/server";

/** Update feedback status. Body: { status: "new" | "read" | "resolved" } */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const { status } = (await req.json().catch(() => ({}))) as { status?: string };
  if (!["new", "read", "resolved"].includes(status ?? "")) {
    return jsonError("status must be new | read | resolved", 400);
  }
  const { error } = await auth.svc.from("feedback").update({ status }).eq("id", id);
  if (error) return jsonError(error.message);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const { error } = await auth.svc.from("feedback").delete().eq("id", id);
  if (error) return jsonError(error.message);
  return NextResponse.json({ ok: true });
}
