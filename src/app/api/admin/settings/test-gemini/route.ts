import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/admin/server";
import { DEFAULT_GEMINI_MODEL, geminiEnvKey } from "@/app/api/ai/_shared";

/**
 * Verifies a Gemini API key by listing models (a free call) and checks that
 * the chosen model is available. Tests the key from the request body if
 * provided (before saving), otherwise the stored one, otherwise the env var.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => ({}))) as {
    apiKey?: string;
    model?: string;
  };

  let apiKey = body.apiKey?.trim();
  if (!apiKey) {
    const { data, error } = await auth.svc
      .from("app_settings")
      .select("value")
      .eq("key", "gemini_api_key")
      .maybeSingle();
    if (error) return jsonError(error.message);
    apiKey = data?.value ?? geminiEnvKey();
  }
  if (!apiKey) return jsonError("No API key to test: enter one or save one first.", 400);

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
      {
        headers: { "x-goog-api-key": apiKey },
        cache: "no-store",
      }
    );
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return jsonError(`Gemini rejected the key (${res.status}).`, 400);
    }
    if (!res.ok) return jsonError(`Gemini returned an error (${res.status}).`, 502);

    const json = (await res.json()) as { models?: { name: string }[] };
    // names come back as "models/gemini-2.5-flash"
    const models = (json.models ?? []).map((m) => m.name.replace(/^models\//, ""));
    const model = body.model?.trim() || DEFAULT_GEMINI_MODEL;
    return NextResponse.json({
      ok: true,
      modelAvailable: models.includes(model),
      modelCount: models.length,
    });
  } catch {
    return jsonError("Could not reach the Gemini API.", 502);
  }
}
