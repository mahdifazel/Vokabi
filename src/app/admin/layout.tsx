"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Inbox, Loader2, Mail, Megaphone, ShieldX, Users } from "lucide-react";
import { adminFetch } from "@/lib/admin/client";
import { VokabiLogo } from "@/components/logo";
import { Button, cn } from "@/components/ui";

const TABS = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/feedback", label: "Feedback", icon: Inbox },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/email", label: "Email", icon: Mail },
] as const;

type GuardState = "checking" | "ok" | "denied" | "unconfigured";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<GuardState>("checking");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    adminFetch<{ admin: boolean }>("/api/admin/me")
      .then(() => setState("ok"))
      .catch((e: Error & { status?: number }) => {
        if (e.status === 401) {
          router.replace("/login");
        } else if (e.status === 501) {
          setState("unconfigured");
          setDetail(e.message);
        } else {
          setState("denied");
        }
      });
  }, [router]);

  if (state === "checking") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="animate-spin text-muted" size={28} />
      </div>
    );
  }

  if (state !== "ok") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-destructive/10 text-destructive">
          <ShieldX size={28} />
        </div>
        <p className="text-lg font-extrabold">
          {state === "denied" ? "This area is for administrators" : "Back office not configured"}
        </p>
        <p className="max-w-md text-sm font-semibold text-muted">
          {state === "denied"
            ? "Your account doesn't have admin access."
            : detail}
        </p>
        <Link href="/">
          <Button variant="secondary">Back to the app</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-16">
      <header className="mb-5 flex items-center gap-3">
        <VokabiLogo size={36} />
        <div className="flex-1">
          <h1 className="text-xl font-black tracking-tight">Back office</h1>
          <p className="text-xs font-semibold text-muted">Vokabi administration</p>
        </div>
        <Link
          href="/"
          className="rounded-xl bg-surface-2 px-3 py-2 text-sm font-bold text-muted active:scale-95"
        >
          ← App
        </Link>
      </header>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1" aria-label="Admin sections">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 flex-1 min-w-fit cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold whitespace-nowrap transition-all",
                active ? "bg-surface text-primary shadow-sm" : "text-muted active:text-foreground"
              )}
            >
              <Icon size={16} /> {label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
