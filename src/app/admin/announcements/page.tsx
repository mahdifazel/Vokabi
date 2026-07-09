"use client";

import { useEffect, useState } from "react";
import { Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import { adminFetch, type AdminAnnouncementRow } from "@/lib/admin/client";
import { Button, Card, EmptyState, Switch, Textarea } from "@/components/ui";

export default function AdminAnnouncementsPage() {
  const [rows, setRows] = useState<AdminAnnouncementRow[] | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminFetch<{ announcements: AdminAnnouncementRow[] }>("/api/admin/announcements")
      .then((d) => setRows(d.announcements))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function create() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const { announcement } = await adminFetch<{ announcement: AdminAnnouncementRow }>(
        "/api/admin/announcements",
        { method: "POST", body: JSON.stringify({ message: draft }) }
      );
      setRows((r) => [announcement, ...(r ?? [])]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    setRows((r) => r?.map((a) => (a.id === id ? { ...a, active } : a)) ?? null);
    await adminFetch(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    }).catch(() => {});
  }

  async function remove(id: string) {
    setRows((r) => r?.filter((a) => a.id !== id) ?? null);
    await adminFetch(`/api/admin/announcements/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div>
      <Card className="mb-4 p-4">
        <p className="mb-2 text-xs font-extrabold tracking-wide text-muted uppercase">
          New announcement
        </p>
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Shown as a banner to every signed-in user…"
        />
        <Button className="mt-3" size="sm" disabled={!draft.trim() || busy} onClick={create}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Publish
        </Button>
        {error && <p className="mt-2 text-sm font-bold text-destructive">{error}</p>}
      </Card>

      {!rows ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-muted" size={28} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={28} />}
          title="No announcements"
          hint="Publish one above. Active announcements appear as a banner in the app."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((a) => (
            <Card key={a.id} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.message}</p>
                <p className="mt-0.5 text-xs font-bold text-muted">
                  {new Date(a.created_at).toLocaleString()} · {a.active ? "live" : "hidden"}
                </p>
              </div>
              <Switch checked={a.active} onCheckedChange={(v) => toggle(a.id, v)} label="Active" />
              <Button size="sm" variant="destructive" onClick={() => remove(a.id)}>
                <Trash2 size={15} />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
