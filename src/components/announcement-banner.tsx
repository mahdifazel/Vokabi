"use client";

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getSupabase } from "@/lib/supabase";
import { useUser } from "@/lib/auth";

const DISMISSED_KEY = "vokabi.dismissedAnnouncements";

interface Announcement {
  id: string;
  message: string;
}

export function AnnouncementBanner() {
  const user = useUser();
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !user) return;
    let dismissed: string[] = [];
    try {
      dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
    } catch {
      // corrupted, treat as none dismissed
    }
    supabase
      .from("announcements")
      .select("id, message")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setItems(data.filter((a) => !dismissed.includes(a.id)));
      });
  }, [user]);

  function dismiss(id: string) {
    setItems((list) => list.filter((a) => a.id !== id));
    try {
      const dismissed: string[] = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed, id].slice(-50)));
    } catch {
      // storage unavailable, banner just reappears next visit
    }
  }

  const current = items[0];

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="mx-4 mt-[max(0.75rem,env(safe-area-inset-top))]"
          role="status"
        >
          <div className="flex items-start gap-3 rounded-2xl bg-primary-soft p-3.5 pl-4">
            <Megaphone size={18} className="mt-0.5 shrink-0 text-primary" />
            <p className="flex-1 text-sm font-bold text-foreground">{current.message}</p>
            <button
              onClick={() => dismiss(current.id)}
              aria-label="Dismiss announcement"
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted active:bg-surface-2"
            >
              <X size={15} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
