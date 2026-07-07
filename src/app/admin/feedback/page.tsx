"use client";

import { useEffect, useState } from "react";
import { Check, Inbox, Loader2, Trash2 } from "lucide-react";
import { adminFetch, type AdminFeedbackRow } from "@/lib/admin/client";
import { Button, Card, EmptyState, cn } from "@/components/ui";

const STATUS_STYLE: Record<string, string> = {
  new: "bg-primary-soft text-primary",
  read: "bg-surface-2 text-muted",
  resolved: "bg-accent-soft text-accent",
};

export default function AdminFeedbackPage() {
  const [rows, setRows] = useState<AdminFeedbackRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<{ feedback: AdminFeedbackRow[] }>("/api/admin/feedback")
      .then((d) => setRows(d.feedback))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function setStatus(id: string, status: AdminFeedbackRow["status"]) {
    setRows((r) => r?.map((f) => (f.id === id ? { ...f, status } : f)) ?? null);
    await adminFetch(`/api/admin/feedback/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }).catch(() => {});
  }

  async function remove(id: string) {
    setRows((r) => r?.filter((f) => f.id !== id) ?? null);
    await adminFetch(`/api/admin/feedback/${id}`, { method: "DELETE" }).catch(() => {});
  }

  if (error) {
    return <p className="rounded-2xl bg-destructive/10 p-4 font-bold text-destructive">{error}</p>;
  }
  if (!rows) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-muted" size={28} />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={28} />}
        title="No feedback yet"
        hint="Messages users send from Settings → Send feedback land here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((f) => (
        <Card key={f.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold whitespace-pre-wrap">{f.message}</p>
              <p className="mt-1.5 text-xs font-bold text-muted">
                {f.email ?? "anonymous"} · {new Date(f.created_at).toLocaleString()}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold uppercase",
                STATUS_STYLE[f.status]
              )}
            >
              {f.status}
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            {f.status !== "resolved" && (
              <Button size="sm" variant="secondary" onClick={() => setStatus(f.id, "resolved")}>
                <Check size={15} /> Resolve
              </Button>
            )}
            {f.status === "new" && (
              <Button size="sm" variant="ghost" onClick={() => setStatus(f.id, "read")}>
                Mark read
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => remove(f.id)}>
              <Trash2 size={15} /> Delete
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
