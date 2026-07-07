"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, KeyRound, Loader2, Trash2, UserRound } from "lucide-react";
import { adminFetch } from "@/lib/admin/client";
import { Button, Card } from "@/components/ui";

interface Detail {
  user: {
    id: string;
    email: string;
    createdAt: string;
    lastSignInAt: string | null;
    banned: boolean;
    wordCount: number;
    groupCount: number;
  };
  recentWords: { german: string; article: string | null; english: string | null; created_at: number }[];
  feedback: { message: string; status: string; created_at: string }[];
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    adminFetch<Detail>(`/api/admin/users/${id}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  async function act(name: string, fn: () => Promise<unknown>, doneMsg: string) {
    setBusy(name);
    setNotice("");
    setError("");
    try {
      await fn();
      setNotice(doneMsg);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy("");
    }
  }

  if (error && !data) {
    return <p className="rounded-2xl bg-destructive/10 p-4 font-bold text-destructive">{error}</p>;
  }
  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-muted" size={28} />
      </div>
    );
  }

  const { user, recentWords, feedback } = data;

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm font-bold text-muted active:text-foreground"
      >
        <ArrowLeft size={16} /> All users
      </button>

      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <UserRound size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate text-lg font-extrabold">
              {user.email}
              {user.banned && (
                <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-extrabold text-destructive">
                  BANNED
                </span>
              )}
            </p>
            <p className="text-sm font-semibold text-muted">
              joined {new Date(user.createdAt).toLocaleDateString()} · last seen{" "}
              {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : "never"}
            </p>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-xl font-black">{user.wordCount}</p>
              <p className="text-[11px] font-semibold text-muted">words</p>
            </div>
            <div>
              <p className="text-xl font-black">{user.groupCount}</p>
              <p className="text-[11px] font-semibold text-muted">groups</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={!!busy}
            onClick={() =>
              act(
                "reset",
                () => adminFetch(`/api/admin/users/${id}/reset-password`, { method: "POST" }),
                "Password-reset email sent"
              )
            }
          >
            {busy === "reset" ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            Send password reset
          </Button>
          <Button
            variant={user.banned ? "accent" : "destructive"}
            size="sm"
            disabled={!!busy}
            onClick={() =>
              act(
                "ban",
                () =>
                  adminFetch(`/api/admin/users/${id}/ban`, {
                    method: "POST",
                    body: JSON.stringify({ banned: !user.banned }),
                  }),
                user.banned ? "User unbanned" : "User banned"
              )
            }
          >
            {busy === "ban" ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
            {user.banned ? "Unban user" : "Ban user"}
          </Button>
          {!confirmDelete ? (
            <Button variant="destructive" size="sm" disabled={!!busy} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Delete user + data
            </Button>
          ) : (
            <span className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3">
              <span className="text-sm font-bold text-destructive">Permanently delete everything?</span>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-destructive text-white"
                disabled={!!busy}
                onClick={() =>
                  act(
                    "delete",
                    async () => {
                      await adminFetch(`/api/admin/users/${id}`, { method: "DELETE" });
                      router.replace("/admin/users");
                    },
                    "User deleted"
                  )
                }
              >
                {busy === "delete" ? <Loader2 size={16} className="animate-spin" /> : "Delete"}
              </Button>
            </span>
          )}
        </div>
        {notice && <p className="mt-3 text-sm font-bold text-accent">{notice}</p>}
        {error && <p className="mt-3 text-sm font-bold text-destructive">{error}</p>}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 text-xs font-extrabold tracking-wide text-muted uppercase">
            Recent words
          </p>
          {recentWords.length === 0 ? (
            <p className="text-sm font-semibold text-muted">No words yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentWords.map((w, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-extrabold">
                    {w.article ? `${w.article} ` : ""}
                    {w.german}
                  </span>
                  <span className="truncate font-semibold text-muted">{w.english ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <p className="mb-3 text-xs font-extrabold tracking-wide text-muted uppercase">
            Feedback from this user
          </p>
          {feedback.length === 0 ? (
            <p className="text-sm font-semibold text-muted">No feedback submitted.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {feedback.map((f, i) => (
                <li key={i} className="rounded-xl bg-surface-2 p-3 text-sm">
                  <p className="font-semibold">{f.message}</p>
                  <p className="mt-1 text-xs font-bold text-muted">
                    {f.status} · {new Date(f.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
