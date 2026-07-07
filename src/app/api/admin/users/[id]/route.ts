import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/admin/server";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { svc } = auth;
  const { id } = await ctx.params;

  const { data, error } = await svc.auth.admin.getUserById(id);
  if (error || !data.user) return jsonError(error?.message ?? "User not found", 404);
  const u = data.user;

  const [wordsRes, groupsRes, recentRes, feedbackRes] = await Promise.all([
    svc.from("words").select("uid", { count: "exact", head: true }).eq("user_id", id),
    svc.from("groups").select("uid", { count: "exact", head: true }).eq("user_id", id),
    svc
      .from("words")
      .select("german, article, english, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    svc
      .from("feedback")
      .select("message, status, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const bannedUntil = (u as unknown as { banned_until?: string }).banned_until;
  return NextResponse.json({
    user: {
      id: u.id,
      email: u.email,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      banned: !!bannedUntil && new Date(bannedUntil) > new Date(),
      wordCount: wordsRes.count ?? 0,
      groupCount: groupsRes.count ?? 0,
    },
    recentWords: recentRes.data ?? [],
    feedback: feedbackRes.data ?? [],
  });
}

/** Delete the user and all their data (words/groups cascade via FK). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (id === auth.user.id) return jsonError("You can't delete your own admin account", 400);

  const { error } = await auth.svc.auth.admin.deleteUser(id);
  if (error) return jsonError(error.message);
  return NextResponse.json({ ok: true });
}
