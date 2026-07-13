"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, PlugZap, Trash2 } from "lucide-react";
import { adminFetch, type AdminGeminiSettings, type AdminGroqSettings } from "@/lib/admin/client";
import { Button, Card, Input, cn } from "@/components/ui";

interface AiSettingsPayload {
  gemini: AdminGeminiSettings;
  groq: AdminGroqSettings;
}

function StatusChip({ configured }: { configured: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
        configured ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", configured ? "bg-accent" : "bg-muted")} />
      {configured ? "Configured" : "Not configured"}
    </span>
  );
}

function KeyField({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative mt-1">
      <KeyRound size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
      <Input
        className="pr-11 pl-9"
        type={show ? "text" : "password"}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted"
        aria-label={show ? "Hide key" : "Show key"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function GeminiCard({
  gemini,
  onUpdate,
}: {
  gemini: AdminGeminiSettings;
  onUpdate: (d: AiSettingsPayload) => void;
}) {
  const [keyInput, setKeyInput] = useState("");
  const [model, setModel] = useState(gemini.model);
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (busy) return;
    setBusy("save");
    setNotice("");
    setError("");
    try {
      const d = await adminFetch<AiSettingsPayload>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          geminiApiKey: keyInput.trim() || undefined,
          geminiModel: model.trim() || undefined,
        }),
      });
      onUpdate(d);
      setModel(d.gemini.model);
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
      const d = await adminFetch<{ ok: boolean; modelAvailable: boolean; modelCount: number }>(
        "/api/admin/settings/test-gemini",
        {
          method: "POST",
          body: JSON.stringify({
            apiKey: keyInput.trim() || undefined,
            model: model.trim(),
          }),
        }
      );
      setNotice(
        d.modelAvailable
          ? "Connection OK: key is valid and the model is available."
          : `Key is valid, but ${model.trim()} was not in Gemini's model list (${d.modelCount} models). Double-check the model id.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(null);
    }
  }

  async function removeKey() {
    if (busy || !confirm("Remove the stored Gemini API key?")) return;
    setBusy("remove");
    setNotice("");
    setError("");
    try {
      const d = await adminFetch<AiSettingsPayload>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ clearGeminiKey: true }),
      });
      onUpdate(d);
      setNotice("API key removed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold tracking-wide text-muted uppercase">
            AI provider · primary
          </p>
          <p className="mt-1 text-lg font-black tracking-tight">Gemini</p>
        </div>
        <StatusChip configured={gemini.configured} />
      </div>

      <p className="mt-2 text-sm font-semibold text-muted">
        Tried first for every photo scan and OCR cleanup. When Gemini fails or is unavailable,
        Groq takes over; if both fail, the scan falls back to on-device recognition.
      </p>

      <label className="mt-4 block text-sm font-extrabold">
        API key
        <KeyField
          value={keyInput}
          onChange={setKeyInput}
          placeholder={
            gemini.keyHint
              ? `Saved (${gemini.keyHint}) — enter to replace`
              : gemini.envConfigured
                ? "Using the key from the environment — enter to override"
                : "AIza…"
          }
          ariaLabel="Gemini API key"
        />
      </label>
      {gemini.envConfigured && !gemini.keyHint && (
        <p className="mt-1.5 text-xs font-semibold text-muted">
          A key from the GEMINI_API_KEY environment variable is active. Saving a key here
          overrides it without a redeploy.
        </p>
      )}

      <label className="mt-3 block text-sm font-extrabold">
        Model (photo scan + OCR cleanup)
        <Input
          className="mt-1"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="gemini-flash-latest"
          aria-label="Gemini model id"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={busy !== null || (!keyInput.trim() && !model.trim())}>
          {busy === "save" ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
          Save
        </Button>
        <Button
          variant="secondary"
          onClick={testConnection}
          disabled={busy !== null || (!gemini.configured && !keyInput.trim())}
        >
          {busy === "test" ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
          Test connection
        </Button>
        {gemini.keyHint && (
          <Button variant="ghost" onClick={removeKey} disabled={busy !== null}>
            {busy === "remove" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
        Get a key at aistudio.google.com. Keys saved here live in the app_settings table in
        Supabase, readable only by the service role.
      </p>
    </Card>
  );
}

function GroqCard({
  groq,
  onUpdate,
}: {
  groq: AdminGroqSettings;
  onUpdate: (d: AiSettingsPayload) => void;
}) {
  const [keyInput, setKeyInput] = useState("");
  const [model, setModel] = useState(groq.model);
  const [visionModel, setVisionModel] = useState(groq.visionModel);
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (busy) return;
    setBusy("save");
    setNotice("");
    setError("");
    try {
      const d = await adminFetch<AiSettingsPayload>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          groqApiKey: keyInput.trim() || undefined,
          groqModel: model.trim() || undefined,
          groqVisionModel: visionModel.trim() || undefined,
        }),
      });
      onUpdate(d);
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
          ? "Connection OK: key is valid and both models are available."
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
      const d = await adminFetch<AiSettingsPayload>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ clearGroqKey: true }),
      });
      onUpdate(d);
      setNotice("API key removed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold tracking-wide text-muted uppercase">
            AI provider · fallback
          </p>
          <p className="mt-1 text-lg font-black tracking-tight">Groq</p>
        </div>
        <StatusChip configured={groq.configured} />
      </div>

      <p className="mt-2 text-sm font-semibold text-muted">
        Used when Gemini fails or is unavailable. The vision model reads words straight from
        the photo, and the text model cleans up on-device OCR output.
      </p>

      <label className="mt-4 block text-sm font-extrabold">
        API key
        <KeyField
          value={keyInput}
          onChange={setKeyInput}
          placeholder={groq.configured ? `Saved (${groq.keyHint}) — enter to replace` : "gsk_…"}
          ariaLabel="Groq API key"
        />
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
          disabled={busy !== null || (!keyInput.trim() && !model.trim() && !visionModel.trim())}
        >
          {busy === "save" ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
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
            {busy === "remove" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AiSettingsPayload | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    adminFetch<AiSettingsPayload>("/api/admin/settings")
      .then(setSettings)
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  if (loadError) {
    return (
      <p className="rounded-2xl bg-destructive/10 p-4 font-bold text-destructive">{loadError}</p>
    );
  }
  if (!settings) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-muted" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <GeminiCard gemini={settings.gemini} onUpdate={setSettings} />
      <GroqCard groq={settings.groq} onUpdate={setSettings} />
    </div>
  );
}
