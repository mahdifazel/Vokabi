"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, Send } from "lucide-react";
import { adminFetch, type AdminUserRow } from "@/lib/admin/client";
import { Button, Card, Input, Textarea } from "@/components/ui";

export default function AdminEmailPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    adminFetch<{ users: AdminUserRow[] }>("/api/admin/users")
      .then((d) => setUsers(d.users))
      .catch(() => {});
  }, []);

  async function send() {
    if (!subject.trim() || !body.trim() || busy) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const res = await adminFetch<{ sent: number; failures: string[] }>("/api/admin/email", {
        method: "POST",
        body: JSON.stringify({ subject, body }),
      });
      setNotice(
        `Sent to ${res.sent} recipient${res.sent === 1 ? "" : "s"}` +
          (res.failures.length ? ` — ${res.failures.length} batch(es) failed` : "")
      );
      setSubject("");
      setBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyEmails() {
    await navigator.clipboard.writeText(users.map((u) => u.email).join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      <Card className="p-5">
        <p className="mb-3 text-xs font-extrabold tracking-wide text-muted uppercase">
          Email all users ({users.length})
        </p>
        <label className="text-sm font-extrabold">
          Subject
          <Input
            className="mt-1"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What's new in Vokabi"
          />
        </label>
        <label className="mt-3 block text-sm font-extrabold">
          Message
          <Textarea
            className="mt-1"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hallo!\n\nPlain text — blank lines become paragraphs."}
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button disabled={!subject.trim() || !body.trim() || busy} onClick={send}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            Send to everyone
          </Button>
          <Button variant="secondary" onClick={copyEmails} disabled={users.length === 0}>
            <Copy size={16} /> {copied ? "Copied!" : "Copy all addresses"}
          </Button>
        </div>
        {notice && <p className="mt-3 text-sm font-bold text-accent">{notice}</p>}
        {error && (
          <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm font-bold text-destructive">
            {error}
          </p>
        )}
        <p className="mt-4 text-xs font-semibold text-muted">
          Sending uses Resend and requires the RESEND_API_KEY and EMAIL_FROM environment
          variables. Without them you can still copy all addresses and email from your own
          client.
        </p>
      </Card>
    </div>
  );
}
