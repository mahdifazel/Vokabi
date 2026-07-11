import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { jsonError, requireAdmin } from "@/lib/admin/server";
import { DEFAULT_GROQ_MODEL, DEFAULT_GROQ_VISION_MODEL } from "@/app/api/ai/_shared";

const GROQ_KEY = "groq_api_key";
const GROQ_MODEL = "groq_model";
const GROQ_VISION_MODEL = "groq_vision_model";

const MISSING_TABLE =
  "Settings storage is missing: run supabase/admin-schema.sql in the Supabase SQL Editor to create the app_settings table.";

async function readSettings(svc: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await svc.from("app_settings").select("key, value");
  if (error) {
    if (error.code === "42P01") throw new Error(MISSING_TABLE);
    throw new Error(error.message);
  }
  return new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
}

function maskKey(value: string) {
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function groqPayload(settings: Map<string, string>) {
  const key = settings.get(GROQ_KEY);
  return {
    configured: Boolean(key),
    keyHint: key ? maskKey(key) : null,
    model: settings.get(GROQ_MODEL) ?? DEFAULT_GROQ_MODEL,
    visionModel: settings.get(GROQ_VISION_MODEL) ?? DEFAULT_GROQ_VISION_MODEL,
  };
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    const settings = await readSettings(auth.svc);
    return NextResponse.json({ groq: groqPayload(settings) });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed to load settings");
  }
}

export async function PUT(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => ({}))) as {
    groqApiKey?: string;
    groqModel?: string;
    groqVisionModel?: string;
    clearGroqKey?: boolean;
  };

  try {
    const now = new Date().toISOString();
    const upserts: { key: string; value: string; updated_at: string }[] = [];

    if (typeof body.groqApiKey === "string" && body.groqApiKey.trim()) {
      upserts.push({ key: GROQ_KEY, value: body.groqApiKey.trim(), updated_at: now });
    }
    if (typeof body.groqModel === "string" && body.groqModel.trim()) {
      upserts.push({ key: GROQ_MODEL, value: body.groqModel.trim(), updated_at: now });
    }
    if (typeof body.groqVisionModel === "string" && body.groqVisionModel.trim()) {
      upserts.push({ key: GROQ_VISION_MODEL, value: body.groqVisionModel.trim(), updated_at: now });
    }

    if (upserts.length > 0) {
      const { error } = await auth.svc.from("app_settings").upsert(upserts);
      if (error) throw new Error(error.code === "42P01" ? MISSING_TABLE : error.message);
    }

    if (body.clearGroqKey) {
      const { error } = await auth.svc.from("app_settings").delete().eq("key", GROQ_KEY);
      if (error) throw new Error(error.code === "42P01" ? MISSING_TABLE : error.message);
    }

    const settings = await readSettings(auth.svc);
    return NextResponse.json({ groq: groqPayload(settings) });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed to save settings");
  }
}
