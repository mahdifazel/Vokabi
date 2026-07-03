"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, FolderOpen, FolderPlus, Heart, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Button, Card, EmptyState, Input, Sheet } from "@/components/ui";

export default function GroupsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");

  const groups = useLiveQuery(() => db.groups.orderBy("name").toArray(), []);
  const counts = useLiveQuery(async () => {
    const map = new Map<number, number>();
    await db.words.each((w) => {
      for (const g of w.groupIds) map.set(g, (map.get(g) ?? 0) + 1);
    });
    return map;
  }, []);
  const favCount = useLiveQuery(() => db.words.where("favorite").equals(1).count(), []);

  async function createGroup() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await db.groups.add({ name: trimmed, createdAt: Date.now() });
    setName("");
    setCreateOpen(false);
  }

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Groups</h1>
          <p className="text-sm font-semibold text-muted">
            Organize your vocabulary into sets
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCreateOpen(true)}>
          <FolderPlus size={16} /> New
        </Button>
      </header>

      <div className="flex flex-col gap-2.5">
        {(favCount ?? 0) > 0 && (
          <Link href="/favorites" className="cursor-pointer">
            <Card className="flex items-center gap-3 p-4 transition-transform active:scale-[0.98]">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400">
                <Heart size={20} fill="currentColor" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">Favorites</p>
                <p className="text-sm font-semibold text-muted">
                  {favCount} word{favCount === 1 ? "" : "s"}
                </p>
              </div>
              <ChevronRight size={18} className="text-muted" />
            </Card>
          </Link>
        )}

        {groups?.map((g) => {
          const n = counts?.get(g.id!) ?? 0;
          return (
            <Link key={g.id} href={`/groups/${g.id}`} className="cursor-pointer">
              <Card className="flex items-center gap-3 p-4 transition-transform active:scale-[0.98]">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <FolderOpen size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{g.name}</p>
                  <p className="text-sm font-semibold text-muted">
                    {n} word{n === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </Card>
            </Link>
          );
        })}
      </div>

      {groups && groups.length === 0 && (favCount ?? 0) === 0 && (
        <EmptyState
          icon={<FolderOpen size={28} />}
          title="No groups yet"
          hint="Create groups like Family, Food, A1 or Verbs, then add words to them."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={18} /> Create a group
            </Button>
          }
        />
      )}

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="New group">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Food, A1, Verbs…"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && createGroup()}
        />
        <Button className="mt-4 w-full" size="lg" disabled={!name.trim()} onClick={createGroup}>
          Create group
        </Button>
      </Sheet>
    </div>
  );
}
