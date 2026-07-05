"use client";

import { useState } from "react";
import { CloudOff, Loader2, LogIn, LogOut, RefreshCw, UserRound } from "lucide-react";
import { signIn, signOut, signUp, useUser } from "@/lib/auth";
import { syncNow, useSyncState } from "@/lib/sync";
import { cloudConfigured } from "@/lib/supabase";
import { Button, Card, Input, Sheet } from "./ui";

export function AccountCard() {
  const user = useUser();
  const sync = useSyncState();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  async function submit() {
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setMessage(null);
    const err =
      mode === "signin"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    setBusy(false);
    if (err === "confirm") {
      setMessage("Check your email to confirm your account, then sign in.");
      setMode("signin");
      return;
    }
    if (err) {
      setMessage(err);
      return;
    }
    setSheetOpen(false);
    setEmail("");
    setPassword("");
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
            Sign in to back up your words and use them on any device. Words you add before
            signing in are uploaded to your account.
          </p>
          <Button onClick={() => setSheetOpen(true)}>
            <LogIn size={18} /> Sign in / Create account
          </Button>
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={mode === "signin" ? "Sign in" : "Create account"}
      >
        <div className="flex flex-col gap-3 pb-2">
          <label className="text-sm font-extrabold">
            Email
            <Input
              className="mt-1"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="text-sm font-extrabold">
            Password
            <Input
              className="mt-1"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </label>

          {message && (
            <p
              className="rounded-2xl bg-surface-2 p-3 text-sm font-bold text-foreground"
              role="alert"
            >
              {message}
            </p>
          )}

          <Button size="lg" disabled={!email.trim() || password.length < 6 || busy} onClick={submit}>
            {busy ? (
              <Loader2 size={18} className="animate-spin" />
            ) : mode === "signin" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </Button>
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setMessage(null);
            }}
            className="cursor-pointer py-2 text-center text-sm font-bold text-primary active:opacity-70"
          >
            {mode === "signin"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </Sheet>
    </Card>
  );
}
