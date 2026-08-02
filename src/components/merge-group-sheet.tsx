"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { FolderOpen } from "lucide-react";
import { db } from "@/lib/db";
import { mergeGroupInto } from "@/lib/words";
import { GROUP_TILES, type Group } from "@/lib/types";
import { Sheet, cn } from "./ui";

/**
 * Target picker for merging a group: its words move into the chosen group
 * (keeping any other memberships) and the source group is deleted.
 */
export function MergeGroupSheet({
  group,
  open,
  onClose,
  onMerged,
}: {
  group: Group | null;
  open: boolean;
  onClose: () => void;
  onMerged?: () => void;
}) {
  const groups = useLiveQuery(() => db.groups.orderBy("name").toArray(), []);
  const targets = (groups ?? []).filter((g) => g.id !== group?.id);

  async function merge(targetGroupId: number) {
    if (group?.id == null) return;
    await mergeGroupInto(group.id, targetGroupId);
    onClose();
    onMerged?.();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Merge “${group?.name ?? ""}”`}>
      {targets.length === 0 ? (
        <p className="pb-4 text-sm font-semibold text-muted">
          There&apos;s no other group to merge into yet. Create another group first.
        </p>
      ) : (
        <div className="flex flex-col gap-2 pb-2">
          <p className="mb-1 text-sm font-semibold text-muted">
            Its words move into the group you pick, then “{group?.name}” is deleted.
          </p>
          {targets.map((g) => (
            <button
              key={g.id}
              onClick={() => g.id != null && merge(g.id)}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface p-3 pl-4 text-left transition-colors active:bg-surface-2"
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                  GROUP_TILES[(g.id ?? 0) % GROUP_TILES.length]
                )}
              >
                <FolderOpen size={18} />
              </div>
              <span className="min-w-0 flex-1 truncate font-extrabold">{g.name}</span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
