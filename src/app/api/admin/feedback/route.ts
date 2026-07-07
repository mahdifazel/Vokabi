import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/admin/server";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.svc
    .from("feedback")
    .select("id, email, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return jsonError(error.message);
  return NextResponse.json({ feedback: data });
}
