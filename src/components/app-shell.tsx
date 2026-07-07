"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, FolderOpen, Heart, Settings } from "lucide-react";
import { cn } from "./ui";
import { initVoices } from "@/lib/tts";
import { applyTheme, getSettings } from "@/lib/settings";
import { initAuth, useAuthReady, useUser } from "@/lib/auth";
import { cloudConfigured } from "@/lib/supabase";
import { initSync, syncNow } from "@/lib/sync";
import { MiniPlayer } from "./mini-player";
import { VokabiLogo } from "./logo";

const TABS = [
  { href: "/", label: "Words", icon: BookOpen },
  { href: "/groups", label: "Groups", icon: FolderOpen },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser();
  const authReady = useAuthReady();
  // accounts are required whenever cloud sync is configured
  const gated = cloudConfigured();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (gated && authReady && !user && !isLogin) {
      router.replace("/login");
    }
  }, [gated, authReady, user, isLogin, router]);

  useEffect(() => {
    initVoices();
    initSync();
    initAuth((user) => {
      if (user) void syncNow(); // pull the account's words on login / app start
    });
    // keep "system" theme in sync when OS theme changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(getSettings().theme);
    mq.addEventListener("change", onChange);
    // register service worker for offline support
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // login screen stands alone — no bottom nav, no player
  if (isLogin) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">{children}</div>
    );
  }

  // while the session restores (or the redirect above runs), show a splash
  // instead of flashing protected content
  if (gated && (!authReady || !user)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <VokabiLogo size={72} className="rounded-3xl shadow-lg" />
        <p className="text-sm font-bold text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col md:max-w-2xl lg:max-w-3xl">
      <main className="flex-1 pb-40">{children}</main>
      <MiniPlayer />
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex h-16 w-full max-w-lg items-stretch md:max-w-2xl lg:max-w-3xl">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? pathname === "/" || pathname.startsWith("/word")
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 transition-colors duration-150",
                  active ? "text-primary" : "text-muted active:text-foreground"
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                <span className={cn("text-[11px]", active ? "font-extrabold" : "font-semibold")}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
