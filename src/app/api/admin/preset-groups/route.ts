import { NextResponse } from "next/server";
import { cleanWords, jsonError, requireAdmin } from "@/lib/admin/server";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.svc
    .from("preset_groups")
    .select("id, name, words, is_default, created_at")
    .order("name");
  if (error) return jsonError(error.message);
  return NextResponse.json({ presets: data });
}

/** Create a preset group. Body: { name: string, words?: string[], isDefault?: boolean } */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    words?: unknown;
    isDefault?: unknown;
  };
  const name = body.name?.trim();
  if (!name) return jsonError("name is required", 400);
  const words = cleanWords(body.words ?? []);
  if (words === null) return jsonError("words must be an array of strings", 400);
  const { data, error } = await auth.svc
    .from("preset_groups")
    .insert({ name, words, is_default: body.isDefault === true })
    .select("id, name, words, is_default, created_at")
    .single();
  if (error) return jsonError(error.message);
  return NextResponse.json({ preset: data });
}
