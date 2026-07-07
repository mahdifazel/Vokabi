"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Search, Users } from "lucide-react";
import { adminFetch, type AdminUserRow } from "@/lib/admin/client";
import { Card, EmptyState, Input, cn } from "@/components/ui";

function fmt(date: string | null) {
  if (!date) return "never";
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    adminFetch<{ users: AdminUserRow[] }>("/api/admin/users")
      .then((d) => setUsers(d.users))
      .catch((e: Error) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users ?? [];
    return (users ?? []).filter((u) => u.email.toLowerCase().includes(q));
  }, [users, query]);

  if (error) {
    return <p className="rounded-2xl bg-destructive/10 p-4 font-bold text-destructive">{error}</p>;
  }
  if (!users) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-muted" size={28} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <Input
            className="h-10 pl-9 text-sm"
            placeholder="Search by email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search users"
          />
        </div>
        <p className="text-sm font-bold text-muted">
          {filtered.length} / {users.length} users
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users size={28} />} title="No users found" />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((u) => (
            <Link key={u.id} href={`/admin/users/${u.id}`}>
              <Card className="flex items-center gap-4 p-4 transition-transform active:scale-[0.99]">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-extrabold">
                    {u.email}
                    {u.banned && (
                      <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-extrabold text-destructive">
                        BANNED
                      </span>
                    )}
                  </p>
                  <p className="text-xs font-semibold text-muted">
                    joined {fmt(u.createdAt)} · last seen {fmt(u.lastSignInAt)}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-extrabold">{u.wordCount}</p>
                  <p className="text-[11px] font-semibold text-muted">words</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-extrabold">{u.groupCount}</p>
                  <p className="text-[11px] font-semibold text-muted">groups</p>
                </div>
                <ChevronRight size={18} className={cn("shrink-0 text-muted")} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
