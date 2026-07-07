import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/admin/server";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.svc
    .from("announcements")
    .select("id, message, active, created_at")
    .order("created_at", { ascending: false });
  if (error) return jsonError(error.message);
  return NextResponse.json({ announcements: data });
}

/** Create an announcement. Body: { message: string } */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { message } = (await req.json().catch(() => ({}))) as { message?: string };
  if (!message?.trim()) return jsonError("message is required", 400);
  const { data, error } = await auth.svc
    .from("announcements")
    .insert({ message: message.trim(), active: true })
    .select()
    .single();
  if (error) return jsonError(error.message);
  return NextResponse.json({ announcement: data });
}
