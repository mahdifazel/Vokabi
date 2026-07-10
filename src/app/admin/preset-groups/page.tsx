"use client";

import { useEffect, useState } from "react";
import { FolderPlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { adminFetch, type AdminPresetGroupRow } from "@/lib/admin/client";
import { Button, Card, EmptyState, Input, Textarea } from "@/components/ui";

function parseWords(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function AdminPresetGroupsPage() {
  const [rows, setRows] = useState<AdminPresetGroupRow[] | null>(null);
  const [error, setError] = useState("");

  // create form
  const [name, setName] = useState("");
  const [wordsText, setWordsText] = useState("");
  const [busy, setBusy] = useState(false);

  // inline editor
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editWords, setEditWords] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // delete confirmation (two-tap)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ presets: AdminPresetGroupRow[] }>("/api/admin/preset-groups")
      .then((d) => setRows(d.presets))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const { preset } = await adminFetch<{ preset: AdminPresetGroupRow }>(
        "/api/admin/preset-groups",
        { method: "POST", body: JSON.stringify({ name, words: parseWords(wordsText) }) }
      );
      setRows((r) => [...(r ?? []), preset].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setWordsText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: AdminPresetGroupRow) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditWords(row.words.join("\n"));
    setConfirmDeleteId(null);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim() || savingEdit) return;
    setSavingEdit(true);
    setError("");
    try {
      const { preset } = await adminFetch<{ preset: AdminPresetGroupRow }>(
        `/api/admin/preset-groups/${editingId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: editName, words: parseWords(editWords) }),
        }
      );
      setRows(
        (r) =>
          r
            ?.map((p) => (p.id === preset.id ? preset : p))
            .sort((a, b) => a.name.localeCompare(b.name)) ?? null
      );
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingEdit(false);
    }
  }

  async function remove(id: string) {
    setRows((r) => r?.filter((p) => p.id !== id) ?? null);
    setConfirmDeleteId(null);
    await adminFetch(`/api/admin/preset-groups/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div>
      <Card className="mb-4 p-4">
        <p className="mb-2 text-xs font-extrabold tracking-wide text-muted uppercase">
          New preset group
        </p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name, e.g. Kitchen, A1 verbs, Numbers…"
        />
        <Textarea
          className="mt-2"
          rows={5}
          value={wordsText}
          onChange={(e) => setWordsText(e.target.value)}
          placeholder={"Words, one per line (optional)\ndas Messer\nder Löffel\ndie Gabel"}
          lang="de"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" disabled={!name.trim() || busy} onClick={create}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create
            preset
          </Button>
          <p className="text-xs font-bold text-muted">
            {parseWords(wordsText).length} word{parseWords(wordsText).length === 1 ? "" : "s"}
          </p>
        </div>
        {error && <p className="mt-2 text-sm font-bold text-destructive">{error}</p>}
      </Card>

      {!rows ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-muted" size={28} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<FolderPlus size={28} />}
          title="No preset groups yet"
          hint="Create one above. Users will see it under “New group” in the app and can add it with one tap."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((p) =>
            editingId === p.id ? (
              <Card key={p.id} className="p-4">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                <Textarea
                  className="mt-2"
                  rows={6}
                  value={editWords}
                  onChange={(e) => setEditWords(e.target.value)}
                  lang="de"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" disabled={!editName.trim() || savingEdit} onClick={saveEdit}>
                    {savingEdit ? <Loader2 size={16} className="animate-spin" /> : null} Save
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <p className="ml-auto text-xs font-bold text-muted">
                    {parseWords(editWords).length} word
                    {parseWords(editWords).length === 1 ? "" : "s"}
                  </p>
                </div>
              </Card>
            ) : (
              <Card key={p.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{p.name}</p>
                  <p className="mt-0.5 truncate text-xs font-bold text-muted">
                    {p.words.length} word{p.words.length === 1 ? "" : "s"}
                    {p.words.length > 0 && <> · {p.words.slice(0, 5).join(", ")}</>}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => startEdit(p)}>
                  <Pencil size={15} /> Edit
                </Button>
                {confirmDeleteId === p.id ? (
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="destructive" onClick={() => remove(p.id)}>
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Cancel delete"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      <X size={15} />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => setConfirmDeleteId(p.id)}
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
