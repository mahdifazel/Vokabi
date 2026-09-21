import { defineConfig, devices } from "@playwright/test";

const LOCAL_PORT = 3100;
const CLOUD_PORT = 3101;
const localURL = `http://localhost:${LOCAL_PORT}`;
const cloudURL = `http://localhost:${CLOUD_PORT}`;

/**
 * The stub Supabase project the cloud-sync tests point the app at. Nothing
 * ever reaches it: `e2e/supabase-stub.ts` intercepts every request to this
 * origin and answers from an in-memory table, so the tests exercise the real
 * sync engine against a server whose behaviour they control (row caps,
 * truncation, concurrent writes) without needing a backend.
 */
export const STUB_SUPABASE_URL = "https://teststub.supabase.co";
export const STUB_SUPABASE_ANON_KEY = "stub-anon-key";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  projects: [
    {
      name: "local-only",
      testIgnore: /\.cloud\.spec\.ts$/,
      use: { ...devices["Pixel 7"], baseURL: localURL },
    },
    {
      name: "cloud-sync",
      testMatch: /\.cloud\.spec\.ts$/,
      use: { ...devices["Pixel 7"], baseURL: cloudURL },
    },
  ],
  webServer: [
    {
      command: `npm run dev -- -p ${LOCAL_PORT}`,
      url: localURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        // Force local-only mode (no login gate, no Supabase calls) regardless
        // of any keys configured in .env.local: these specs cover the
        // IndexedDB-only flows and must never depend on auth/cloud state.
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      },
    },
    {
      command: `npm run dev -- -p ${CLOUD_PORT}`,
      url: cloudURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        // Cloud sync on, pointed at the intercepted stub origin above
        NEXT_PUBLIC_SUPABASE_URL: STUB_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: STUB_SUPABASE_ANON_KEY,
        // its own dist dir, so it doesn't fight the local-only server's lock
        NEXT_DIST_DIR: ".next-e2e-cloud",
      },
    },
  ],
});
