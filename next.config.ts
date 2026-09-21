import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next takes an exclusive lock on the dist dir, so two dev servers can only
  // run side by side out of different ones. The E2E suite needs exactly that:
  // one server in local-only mode and one with cloud sync configured, since
  // NEXT_PUBLIC_* values are baked in at build time and can't be switched per
  // test. Unset everywhere else, so normal dev and the Vercel build are ".next".
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
