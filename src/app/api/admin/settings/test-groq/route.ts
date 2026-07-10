import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/admin/server";

/**
 * Verifies a Groq API key by listing models (a free call) and checks that the
 * chosen model is available. Tests the key from the request body if provided
 * (before saving), otherwise the stored one.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => ({}))) as { apiKey?: string; model?: string };

  let apiKey = body.apiKey?.trim();
  if (!apiKey) {
    const { data, error } = await auth.svc
      .from("app_settings")
      .select("value")
      .eq("key", "groq_api_key")
      .maybeSingle();
    if (error) return jsonError(error.message);
    apiKey = data?.value;
  }
  if (!apiKey) return jsonError("No API key to test: enter one or save one first.", 400);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (res.status === 401) return jsonError("Groq rejected the key (401 unauthorized).", 400);
    if (!res.ok) return jsonError(`Groq returned an error (${res.status}).`, 502);

    const json = (await res.json()) as { data?: { id: string }[] };
    const models = (json.data ?? []).map((m) => m.id);
    const model = body.model?.trim() || "llama-3.3-70b-versatile";
    return NextResponse.json({
      ok: true,
      modelAvailable: models.includes(model),
      modelCount: models.length,
    });
  } catch {
    return jsonError("Could not reach the Groq API.", 502);
  }
}
