import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/server";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ admin: true, email: auth.user.email });
}
