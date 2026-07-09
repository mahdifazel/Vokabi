"use client";

import { useState } from "react";
import { Check, Loader2, MessageSquareHeart, Send } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { Button, Card, Textarea } from "./ui";

export function FeedbackCard() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const supabase = getSupabase();
  const user = getUser();

  if (!supabase || !user) return null;

  async function send() {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase!.from("feedback").insert({
      user_id: user!.id,
      email: user!.email,
      message: message.trim(),
    });
    setBusy(false);
    if (err) {
      setError("Couldn't send right now. Please try again later.");
      return;
    }
    setMessage("");
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  }

  return (
    <Card className="mb-4 px-4 py-2">
      <p className="flex items-center gap-1.5 pt-3 pb-1 text-xs font-extrabold tracking-wide text-muted uppercase">
        <MessageSquareHeart size={14} /> Send feedback
      </p>
      <div className="py-2 pb-4">
        <Textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Found a bug? Missing a feature? Tell me. It lands directly in my inbox."
        />
        <Button
          size="sm"
          className="mt-3"
          disabled={!message.trim() || busy}
          onClick={send}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : done ? (
            <>
              <Check size={16} /> Sent, thank you!
            </>
          ) : (
            <>
              <Send size={16} /> Send
            </>
          )}
        </Button>
        {error && <p className="mt-2 text-sm font-bold text-destructive">{error}</p>}
      </div>
    </Card>
  );
}
