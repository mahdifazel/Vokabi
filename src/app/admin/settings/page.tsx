"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, PlugZap, Trash2 } from "lucide-react";
import { adminFetch, type AdminGroqSettings } from "@/lib/admin/client";
import { Button, Card, Input, cn } from "@/components/ui";

export default function AdminSettingsPage() {
  const [groq, setGroq] = useState<AdminGroqSettings | null>(null);
  const [loadError, setLoadError] = useState("");

  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState("");
  const [visionModel, setVisionModel] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<{ groq: AdminGroqSettings }>("/api/admin/settings")
      .then((d) => {
        setGroq(d.groq);
        setModel(d.groq.model);
        setVisionModel(d.groq.visionModel);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  async function save() {
    if (busy) return;
    setBusy("save");
    setNotice("");
    setError("");
    try {
      const d = await adminFetch<{ groq: AdminGroqSettings }>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          groqApiKey: keyInput.trim() || undefined,
          groqModel: model.trim() || undefined,
          groqVisionModel: visionModel.trim() || undefined,
        }),
      });
      setGroq(d.groq);
      setModel(d.groq.model);
      setVisionModel(d.groq.visionModel);
      setKeyInput("");
      setNotice("Settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function testConnection() {
    if (busy) return;
    setBusy("test");
    setNotice("");
    setError("");
    try {
      const d = await adminFetch<{
        ok: boolean;
        modelAvailable: boolean;
        visionModelAvailable: boolean;
        modelCount: number;
      }>("/api/admin/settings/test-groq", {
        method: "POST",
        body: JSON.stringify({
          apiKey: keyInput.trim() || undefined,
          model: model.trim(),
          visionModel: visionModel.trim(),
        }),
      });
      const missing = [
        ...(d.modelAvailable ? [] : [model.trim()]),
        ...(d.visionModelAvailable ? [] : [visionModel.trim()]),
      ];
      setNotice(
        missing.length === 0
          ? `Connection OK: key is valid and both models are available.`
          : `Key is valid, but ${missing.join(" and ")} was not in Groq's model list (${d.modelCount} models). Double-check the model id.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(null);
    }
  }

  async function removeKey() {
    if (busy || !confirm("Remove the stored Groq API key?")) return;
    setBusy("remove");
    setNotice("");
    setError("");
    try {
      const d = await adminFetch<{ groq: AdminGroqSettings }>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ clearGroqKey: true }),
      });
      setGroq(d.groq);
      setNotice("API key removed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <p className="rounded-2xl bg-destructive/10 p-4 font-bold text-destructive">{loadError}</p>
    );
  }
  if (!groq) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-muted" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold tracking-wide text-muted uppercase">
              AI provider
            </p>
            <p className="mt-1 text-lg font-black tracking-tight">Groq</p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
              groq.configured ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                groq.configured ? "bg-accent" : "bg-muted"
              )}
            />
            {groq.configured ? "Configured" : "Not configured"}
          </span>
        </div>

        <p className="mt-2 text-sm font-semibold text-muted">
          The key is stored server-side and never reaches the app. It powers the photo scan:
          the vision model reads words straight from the photo, and the text model cleans up
          on-device OCR output as fallback.
        </p>

        <label className="mt-4 block text-sm font-extrabold">
          API key
          <div className="relative mt-1">
            <KeyRound size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
            <Input
              className="pr-11 pl-9"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={groq.configured ? `Saved (${groq.keyHint}) — enter to replace` : "gsk_…"}
              aria-label="Groq API key"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted"
              aria-label={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="mt-3 block text-sm font-extrabold">
          Text model (OCR cleanup)
          <Input
            className="mt-1"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="llama-3.3-70b-versatile"
            aria-label="Groq model id"
          />
        </label>

        <label className="mt-3 block text-sm font-extrabold">
          Vision model (photo scan)
          <Input
            className="mt-1"
            value={visionModel}
            onChange={(e) => setVisionModel(e.target.value)}
            placeholder="qwen/qwen3.6-27b"
            aria-label="Groq vision model id"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            onClick={save}
            disabled={
              busy !== null || (!keyInput.trim() && !model.trim() && !visionModel.trim())
            }
          >
            {busy === "save" ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <CheckCircle2 size={17} />
            )}
            Save
          </Button>
          <Button
            variant="secondary"
            onClick={testConnection}
            disabled={busy !== null || (!groq.configured && !keyInput.trim())}
          >
            {busy === "test" ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
            Test connection
          </Button>
          {groq.configured && (
            <Button variant="ghost" onClick={removeKey} disabled={busy !== null}>
              {busy === "remove" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              Remove key
            </Button>
          )}
        </div>

        {notice && <p className="mt-3 text-sm font-bold text-accent">{notice}</p>}
        {error && (
          <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm font-bold text-destructive">
            {error}
          </p>
        )}

        <p className="mt-4 text-xs font-semibold text-muted">
          Get a free key at console.groq.com. Keys are stored in the app_settings table in
          Supabase, readable only by the service role.
        </p>
      </Card>
    </div>
  );
}
