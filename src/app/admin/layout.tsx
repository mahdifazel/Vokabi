"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FolderPlus,
  Inbox,
  Loader2,
  Mail,
  Megaphone,
  Moon,
  Settings,
  ShieldX,
  Sun,
  Users,
} from "lucide-react";
import { adminFetch } from "@/lib/admin/client";
import { signOut } from "@/lib/auth";
import { updateSettings, useSettings } from "@/lib/settings";
import { VokabiLogo } from "@/components/logo";
import { Button, cn } from "@/components/ui";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Users;
}

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Manage",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/feedback", label: "Feedback", icon: Inbox },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/preset-groups", label: "Preset groups", icon: FolderPlus },
    ],
  },
  {
    label: "Communication",
    items: [{ href: "/admin/email", label: "Email", icon: Mail }],
  },
  {
    label: "System",
    items: [{ href: "/admin/settings", label: "System settings", icon: Settings }],
  },
];

const PAGE_HEADERS: Record<string, { title: string; description: string }> = {
  "/admin/users": { title: "Users", description: "Accounts, activity and moderation" },
  "/admin/feedback": { title: "Feedback", description: "Messages submitted from the app" },
  "/admin/announcements": {
    title: "Announcements",
    description: "Banners shown to everyone in the app",
  },
  "/admin/preset-groups": {
    title: "Preset groups",
    description: "Ready-made groups users can add from the app",
  },
  "/admin/email": { title: "Email", description: "Broadcast an email to all users" },
  "/admin/settings": {
    title: "System settings",
    description: "Integrations and platform configuration",
  },
};

type GuardState = "checking" | "ok" | "denied" | "unconfigured";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function ThemeToggle() {
  const { theme } = useSettings();
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      onClick={() => updateSettings({ theme: dark ? "light" : "dark" })}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted transition-colors hover:text-foreground active:scale-95"
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<GuardState>("checking");
  const [detail, setDetail] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    adminFetch<{ admin: boolean; email?: string }>("/api/admin/me")
      .then((d) => {
        setEmail(d.email ?? "");
        setState("ok");
      })
      .catch((e: Error & { status?: number }) => {
        if (e.status === 401) {
          // the server rejected the stored session (expired or the Supabase
          // keys were rotated since login); drop it locally, otherwise the
          // login page sees a client-side user and bounces straight back
          void signOut().finally(() => router.replace("/login"));
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
          {state === "denied" ? "Your account doesn't have admin access." : detail}
        </p>
        <Link href="/">
          <Button variant="secondary">Back to the app</Button>
        </Link>
      </div>
    );
  }

  const header = PAGE_HEADERS[pathname];

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <VokabiLogo size={34} />
          <div className="min-w-0">
            <p className="text-base leading-tight font-black tracking-tight">Vokabi</p>
            <p className="text-[11px] font-bold text-muted">Back office</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Admin sections">
          {NAV.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-2 pb-1.5 text-[11px] font-extrabold tracking-wider text-muted uppercase">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm font-bold transition-colors",
                        active
                          ? "bg-primary-soft text-primary"
                          : "text-muted hover:bg-surface-2 hover:text-foreground"
                      )}
                    >
                      <Icon size={17} className="shrink-0" /> {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-border px-5 py-4">
          <p className="truncate text-xs font-bold text-muted" title={email}>
            {email}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-primary"
            >
              <ArrowLeft size={15} /> Back to the app
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar (mobile / tablet) */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
          <div className="flex items-center gap-3 pb-3">
            <VokabiLogo size={30} />
            <p className="flex-1 leading-tight font-black tracking-tight">Back office</p>
            <ThemeToggle />
            <Link
              href="/"
              className="rounded-xl bg-surface-2 px-3 py-1.5 text-sm font-bold text-muted active:scale-95"
            >
              ← App
            </Link>
          </div>
          <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2" aria-label="Admin sections">
            {NAV.flatMap((g) => g.items).map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold whitespace-nowrap transition-colors",
                    active ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted"
                  )}
                >
                  <Icon size={15} /> {label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-4xl px-4 py-6 pb-16 lg:px-8 lg:py-8">
          {header && (
            <div className="mb-6">
              <h1 className="text-2xl font-black tracking-tight">{header.title}</h1>
              <p className="mt-0.5 text-sm font-semibold text-muted">{header.description}</p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
