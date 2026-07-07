"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CloudOff, Loader2, LogIn, UserRoundPlus } from "lucide-react";
import { signIn, signUp, useUser } from "@/lib/auth";
import { cloudConfigured } from "@/lib/supabase";
import { Button, Card, Input } from "@/components/ui";
import { VokabiLogo } from "@/components/logo";

export default function LoginPage() {
  const router = useRouter();
  const user = useUser();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // already signed in → nothing to do here
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  async function submit() {
    if (!email.trim() || password.length < 6 || busy) return;
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
    router.replace("/"); // sync starts automatically on login
  }

  return (
    <div className="flex min-h-[80dvh] flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-2 flex items-center">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl text-muted active:bg-surface-2"
        >
          <ArrowLeft size={22} />
        </button>
      </header>

      <div className="flex flex-1 flex-col justify-center pb-24">
        {/* Brand */}
        <div className="mb-8 text-center">
          <VokabiLogo size={72} className="mx-auto mb-4 rounded-3xl shadow-lg" />
          <h1 className="text-2xl font-black tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm font-semibold text-muted">
            {mode === "signin"
              ? "Sign in to access your words on any device"
              : "Back up your words and learn on any device"}
          </p>
        </div>

        {!cloudConfigured() ? (
          <Card className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-muted">
              <CloudOff size={20} />
            </div>
            <p className="text-sm font-semibold text-muted">
              Cloud sync isn&apos;t configured on this deployment, so accounts aren&apos;t
              available. Your words are stored on this device.
            </p>
          </Card>
        ) : (
          <Card className="p-5">
            <div className="flex flex-col gap-3">
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
                  autoFocus
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

              <Button
                size="lg"
                disabled={!email.trim() || password.length < 6 || busy}
                onClick={submit}
              >
                {busy ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : mode === "signin" ? (
                  <>
                    <LogIn size={18} /> Sign in
                  </>
                ) : (
                  <>
                    <UserRoundPlus size={18} /> Create account
                  </>
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
          </Card>
        )}

        <p className="mt-6 text-center text-xs font-semibold text-muted">
          Words you add before signing in are uploaded to your account automatically.
        </p>
      </div>
    </div>
  );
}
