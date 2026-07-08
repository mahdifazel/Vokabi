"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { BookOpen, FolderOpen, Heart, Settings } from "lucide-react";
import { cn } from "./ui";
import { initVoices } from "@/lib/tts";
import { applyTheme, getSettings } from "@/lib/settings";
import { initAuth, useAuthReady, useUser } from "@/lib/auth";
import { cloudConfigured } from "@/lib/supabase";
import { initSync, syncNow } from "@/lib/sync";
import { MiniPlayer } from "./mini-player";
import { Splash } from "./splash";
import { AnnouncementBanner } from "./announcement-banner";

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

  // cinematic splash: plays a minimum beat on app open, and keeps covering
  // the screen while the session restores / the login redirect is in flight
  const [splashDone, setSplashDone] = useState(false);
  const showSplash =
    !splashDone || (gated && (!authReady || (!user && !isLogin)));

  useEffect(() => {
    // full cinematic intro only once per session; on reloads (e.g. Android
    // restoring the app after a tab/app switch) dismiss almost immediately
    let played = false;
    try {
      played = sessionStorage.getItem("vokabi.splashPlayed") === "1";
    } catch {
      // storage unavailable — treat as first play
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = played ? 150 : reduce ? 700 : 2700;
    const t = setTimeout(() => {
      setSplashDone(true);
      try {
        sessionStorage.setItem("vokabi.splashPlayed", "1");
      } catch {
        // ignore
      }
    }, delay);
    return () => clearTimeout(t);
  }, []);

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

  const splash = (
    <AnimatePresence>{showSplash && <Splash key="splash" />}</AnimatePresence>
  );

  // the back office brings its own layout and guard
  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  // login screen stands alone — no bottom nav, no player
  if (isLogin) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        {children}
        {splash}
      </div>
    );
  }

  // session restoring / redirect in flight — the splash overlay covers this
  if (gated && (!authReady || !user)) {
    return <div className="min-h-dvh">{splash}</div>;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col md:max-w-2xl lg:max-w-3xl">
      <AnnouncementBanner />
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
      {splash}
    </div>
  );
}
