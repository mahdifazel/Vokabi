import { NextResponse } from "next/server";
import { cleanWords, jsonError, requireAdmin } from "@/lib/admin/server";

/** Update a preset group. Body: { name?: string, words?: string[], isDefault?: boolean } */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    words?: unknown;
    isDefault?: unknown;
  };

  const patch: { name?: string; words?: string[]; is_default?: boolean; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (body.name !== undefined) {
    const name = body.name?.trim();
    if (!name) return jsonError("name must not be empty", 400);
    patch.name = name;
  }
  if (body.words !== undefined) {
    const words = cleanWords(body.words);
    if (words === null) return jsonError("words must be an array of strings", 400);
    patch.words = words;
  }
  if (body.isDefault !== undefined) {
    if (typeof body.isDefault !== "boolean") return jsonError("isDefault must be a boolean", 400);
    patch.is_default = body.isDefault;
  }

  const { data, error } = await auth.svc
    .from("preset_groups")
    .update(patch)
    .eq("id", id)
    .select("id, name, words, is_default, created_at")
    .single();
  if (error) return jsonError(error.message);
  return NextResponse.json({ preset: data });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const { error } = await auth.svc.from("preset_groups").delete().eq("id", id);
  if (error) return jsonError(error.message);
  return NextResponse.json({ ok: true });
}
