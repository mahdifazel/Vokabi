import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/admin/server";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { svc } = auth;

  const { data, error } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return jsonError(error.message);

  const [wordsRes, groupsRes] = await Promise.all([
    svc.from("words").select("user_id"),
    svc.from("groups").select("user_id"),
  ]);
  const wordCounts = new Map<string, number>();
  for (const r of wordsRes.data ?? []) {
    wordCounts.set(r.user_id, (wordCounts.get(r.user_id) ?? 0) + 1);
  }
  const groupCounts = new Map<string, number>();
  for (const r of groupsRes.data ?? []) {
    groupCounts.set(r.user_id, (groupCounts.get(r.user_id) ?? 0) + 1);
  }

  const users = data.users.map((u) => {
    const bannedUntil = (u as unknown as { banned_until?: string }).banned_until;
    return {
      id: u.id,
      email: u.email ?? "(no email)",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      banned: !!bannedUntil && new Date(bannedUntil) > new Date(),
      wordCount: wordCounts.get(u.id) ?? 0,
      groupCount: groupCounts.get(u.id) ?? 0,
    };
  });
  users.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return NextResponse.json({ users });
}
