import type { Page } from "@playwright/test";
import { STUB_SUPABASE_ANON_KEY, STUB_SUPABASE_URL } from "../playwright.config";

/**
 * An in-memory stand-in for the Supabase REST API, good enough to drive the
 * real sync engine end to end: it speaks the slice of PostgREST that
 * `lib/sync.ts` uses (select with `order`/`limit`/`uid=gt.`, upsert on the uid
 * primary key, delete with `uid=in.(…)`) and, crucially, it can misbehave the
 * way a real backend does.
 *
 * `maxRows` is the important one. PostgREST caps every response at the
 * project's max-rows setting and does so silently - 200, no error, just fewer
 * rows than exist - which is what made a large library lose its newest words
 * on every sync. Tests set the cap and assert the client copes.
 */

export interface StubRow {
  uid: string;
  [column: string]: unknown;
}

export interface SupabaseStub {
  words: StubRow[];
  groups: StubRow[];
  presetGroups: StubRow[];
  /** hard row cap applied to every select, like PostgREST's max-rows */
  maxRows: number;
  /** requests the app made, for asserting on batching */
  requests: { method: string; table: string; url: string }[];
}

const ACCOUNT = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "e2e@vokabi.test",
};

function tableOf(url: URL): string {
  return url.pathname.replace(/^.*\/rest\/v1\//, "").split("?")[0];
}

/** `uid=gt.<value>` / `uid=in.(a,b,c)` — the only filters sync.ts sends */
function applyFilters(rows: StubRow[], params: URLSearchParams): StubRow[] {
  const uid = params.get("uid");
  if (!uid) return rows;
  if (uid.startsWith("gt.")) {
    const cursor = uid.slice(3);
    return rows.filter((r) => r.uid > cursor);
  }
  if (uid.startsWith("in.")) {
    const wanted = new Set(uid.slice(3).replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, "")));
    return rows.filter((r) => wanted.has(r.uid));
  }
  return rows;
}

/**
 * Install the stub on a page. Must be called before `page.goto`, since the
 * app syncs as soon as the session is restored.
 */
export async function installSupabaseStub(
  page: Page,
  initial: Partial<Pick<SupabaseStub, "words" | "groups" | "presetGroups" | "maxRows">> = {}
): Promise<SupabaseStub> {
  const stub: SupabaseStub = {
    words: initial.words ?? [],
    groups: initial.groups ?? [],
    presetGroups: initial.presetGroups ?? [],
    maxRows: initial.maxRows ?? 1000,
    requests: [],
  };

  // a session in the exact shape supabase-js persists, expiring far enough in
  // the future that the client never tries to refresh it over the network
  const ref = new URL(STUB_SUPABASE_URL).hostname.split(".")[0];
  const session = {
    access_token: "stub-access-token",
    refresh_token: "stub-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    user: {
      id: ACCOUNT.id,
      aud: "authenticated",
      role: "authenticated",
      email: ACCOUNT.email,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date(0).toISOString(),
    },
  };
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [`sb-${ref}-auth-token`, JSON.stringify(session)] as const
  );

  await page.route(`${STUB_SUPABASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.startsWith("/auth/v1/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: session.user, session }) });
    }

    const table = tableOf(url);
    stub.requests.push({ method, table, url: request.url() });

    const store =
      table === "words" ? stub.words : table === "groups" ? stub.groups : table === "preset_groups" ? stub.presetGroups : null;
    if (!store) {
      return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: `no stub table ${table}` }) });
    }

    const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });

    if (method === "GET" || method === "HEAD") {
      let rows = applyFilters(store, url.searchParams);
      const order = url.searchParams.get("order");
      if (order?.startsWith("uid")) {
        rows = [...rows].sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
        if (order.includes("desc")) rows.reverse();
      }
      const asked = Number(url.searchParams.get("limit") ?? Infinity);
      // the silent truncation: whichever is smaller, the client's limit or the
      // server's cap, and never any indication that rows were left out
      const capped = rows.slice(0, Math.min(asked, stub.maxRows));
      return json(capped, 200, {
        "content-range": `0-${Math.max(capped.length - 1, 0)}/*`,
      });
    }

    if (method === "POST" || method === "PATCH") {
      const body = request.postDataJSON() as StubRow[] | StubRow;
      const incoming = Array.isArray(body) ? body : [body];
      for (const row of incoming) {
        const at = store.findIndex((r) => r.uid === row.uid);
        if (at >= 0) store[at] = { ...store[at], ...row };
        else store.push({ ...row });
      }
      return json([], 201);
    }

    if (method === "DELETE") {
      const doomed = new Set(applyFilters(store, url.searchParams).map((r) => r.uid));
      for (let i = store.length - 1; i >= 0; i--) {
        if (doomed.has(store[i].uid)) store.splice(i, 1);
      }
      return json([], 204);
    }

    return json({ message: `unsupported ${method}` }, 405);
  });

  // keep the run hermetic: dictionary/translation lookups must never go out
  for (const external of ["**://*.wiktionary.org/**", "**://api.mymemory.translated.net/**"]) {
    await page.route(external, (route) => route.abort());
  }

  return stub;
}

export const stubAccount = ACCOUNT;
export const stubAnonKey = STUB_SUPABASE_ANON_KEY;

/** A ready-to-sync remote word row. */
export function remoteWord(n: number, groupUid: string): StubRow {
  return {
    uid: `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`,
    user_id: ACCOUNT.id,
    german: `Wort${n}`,
    article: null,
    english: `word ${n}`,
    plural: null,
    ipa: null,
    pos: "noun",
    // pre-filled so the example/definition backfills stay no-ops in tests
    example: `Das ist Wort${n}.`,
    example_en: `That is word ${n}.`,
    definition_de: `Ein Wort namens Wort${n}.`,
    notes: null,
    favorite: false,
    group_uids: [groupUid],
    status: "ready",
    created_at: 1_700_000_000_000 + n,
    updated_at: 1_700_000_000_000 + n,
  };
}

export function remoteGroup(uid: string, name: string): StubRow {
  return {
    uid,
    user_id: ACCOUNT.id,
    name,
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_000_000,
  };
}
