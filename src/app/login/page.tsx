"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Loader2, LogIn, UserRoundPlus } from "lucide-react";
import { signIn, signInWithGoogle, signUp, useUser } from "@/lib/auth";
import { cloudConfigured } from "@/lib/supabase";
import { Button, Card, Input } from "@/components/ui";
import { VokabiLogo } from "@/components/logo";

/** Google's multicolor "G" mark; lucide has no brand icons. */
function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

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

  async function googleSignIn() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const err = await signInWithGoogle();
    // success redirects the whole page to Google, so only failures land here
    if (err) {
      setMessage(err);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[80dvh] flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
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
              <Button size="lg" variant="secondary" disabled={busy} onClick={googleSignIn}>
                <GoogleLogo /> Continue with Google
              </Button>

              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-bold text-muted">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>

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
          Your words are stored in your account and synced to all your devices.
        </p>
      </div>
    </div>
  );
}
