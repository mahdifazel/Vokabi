"use client";

import Link from "next/link";
import { CloudOff, LogIn, LogOut, RefreshCw, UserRound } from "lucide-react";
import { signOut, useUser } from "@/lib/auth";
import { syncNow, useSyncState } from "@/lib/sync";
import { cloudConfigured } from "@/lib/supabase";
import { Button, Card } from "./ui";

export function AccountCard() {
  const user = useUser();
  const sync = useSyncState();

  if (!cloudConfigured()) {
    return (
      <Card className="mb-4 px-4 py-2">
        <p className="pt-3 pb-1 text-xs font-extrabold tracking-wide text-muted uppercase">
          Account
        </p>
        <div className="flex items-center gap-3 py-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-muted">
            <CloudOff size={20} />
          </div>
          <p className="text-sm font-semibold text-muted">
            Cloud sync isn&apos;t configured on this deployment. Your words are stored on this
            device only.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-4 px-4 py-2">
      <p className="pt-3 pb-1 text-xs font-extrabold tracking-wide text-muted uppercase">
        Account
      </p>

      {user ? (
        <>
          <div className="flex items-center gap-3 py-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <UserRound size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">{user.email}</p>
              <p className="text-sm font-semibold text-muted" role="status">
                {sync.status === "syncing"
                  ? "Syncing…"
                  : sync.status === "error"
                    ? `Sync failed: ${sync.error}`
                    : sync.lastSyncAt
                      ? `Synced ${new Date(sync.lastSyncAt).toLocaleString()}`
                      : "Not synced yet"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 pb-4">
            <Button
              variant="secondary"
              size="sm"
              disabled={sync.status === "syncing"}
              onClick={() => void syncNow()}
            >
              <RefreshCw
                size={16}
                className={sync.status === "syncing" ? "animate-spin" : undefined}
              />
              Sync now
            </Button>
            <Button variant="destructive" size="sm" onClick={() => void signOut()}>
              <LogOut size={16} /> Sign out
            </Button>
          </div>
        </>
      ) : (
        <div className="py-3 pb-4">
          <p className="mb-3 text-sm font-semibold text-muted">
            Sign in to add words and use them on any device.
          </p>
          <Link href="/login">
            <Button>
              <LogIn size={18} /> Sign in / Create account
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}
