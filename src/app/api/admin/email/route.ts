import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/admin/server";

/**
 * Send an email to all users (or a selection) via Resend.
 * Body: { subject: string, body: string, userIds?: string[] }
 * Requires RESEND_API_KEY and EMAIL_FROM env vars; returns 501 otherwise.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return jsonError(
      "Email sending not configured: set RESEND_API_KEY and EMAIL_FROM (e.g. \"Vokabi <hello@yourdomain.com>\")",
      501
    );
  }

  const { subject, body, userIds } = (await req.json().catch(() => ({}))) as {
    subject?: string;
    body?: string;
    userIds?: string[];
  };
  if (!subject?.trim() || !body?.trim()) {
    return jsonError("subject and body are required", 400);
  }

  const { data, error } = await auth.svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return jsonError(error.message);
  let recipients = data.users.map((u) => u.email).filter((e): e is string => !!e);
  if (userIds && userIds.length > 0) {
    const wanted = new Set(userIds);
    recipients = data.users
      .filter((u) => wanted.has(u.id))
      .map((u) => u.email)
      .filter((e): e is string => !!e);
  }
  if (recipients.length === 0) return jsonError("No recipients", 400);

  const html = body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  // Resend batch endpoint accepts up to 100 emails per call
  let sent = 0;
  const failures: string[] = [];
  for (let i = 0; i < recipients.length; i += 100) {
    const batch = recipients.slice(i, i + 100).map((to) => ({
      from,
      to: [to],
      subject: subject.trim(),
      html,
    }));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });
    if (res.ok) {
      sent += batch.length;
    } else {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      failures.push(err.message ?? `batch ${i / 100 + 1} failed (${res.status})`);
    }
  }

  if (sent === 0) return jsonError(failures.join("; ") || "All sends failed");
  return NextResponse.json({ ok: true, sent, failures });
}
