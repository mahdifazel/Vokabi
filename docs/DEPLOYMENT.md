# Deployment

## Current production setup

| Piece | Where | Notes |
|---|---|---|
| Hosting | Vercel | Project connected to the `mahdifazel/Vokabi` GitHub repo |
| Domain | https://vokabi.app | Custom domain on the Vercel project |
| Database + auth | Supabase (single project) | Also linked via the Vercel↔Supabase integration, which injects the `NEXT_PUBLIC_SUPABASE_*` variables |
| Email (auth mails) | Supabase built-in mailer | ⚠️ Heavily rate-limited (~a few/hour); "Confirm email" is disabled for this reason. Configure custom SMTP before relying on password-reset emails at scale |
| Email (broadcasts) | Resend (optional) | Only used by the admin Email tab |
| AI (photo-scan cleanup) | Groq (optional) | Key is stored in the `app_settings` table and managed at `/admin/settings`, not an env var; scans fall back to heuristics without it |

**Deploy = `git push`.** Every push to `main` triggers a Vercel production build and release. There is no CI gate — run `npm run lint && npm run build` locally before pushing (see `CONTRIBUTING.md`).

**Branch workflow:** day-to-day changes are committed to the `dev` branch (which auto-deploys a preview at vokabi-wied.vercel.app) and reviewed there; `dev` is merged into `main` only after approval, which is what ships to production.

## Staging

⚠️ **There is no dedicated staging environment.** What exists today:

- **Vercel Preview Deployments** — every push to a non-`main` branch (or PR) gets an isolated preview URL automatically. Previews use the same environment variables unless you scope variables to the *Preview* environment in Vercel — note that with the current setup **previews share the production Supabase database**.
- For a true staging setup you would: create a second Supabase project, add its URL/keys as *Preview*-scoped env vars in Vercel, and run both SQL files against it. This is documented as future work, not something that exists.

## Deploying production from scratch

1. **Repo** — fork/clone `mahdifazel/Vokabi`, push to GitHub
2. **Supabase**
   - Create a project ([database.new](https://database.new))
   - SQL Editor → run `supabase/schema.sql`, then `supabase/admin-schema.sql` (both are idempotent)
   - Authentication → URL Configuration: **Site URL** = your domain, add `https://<domain>/**` to Redirect URLs
   - Authentication → Sign In / Providers → Email: disable **Confirm email** (or configure custom SMTP first)
3. **Vercel**
   - Import the GitHub repo (framework auto-detected: Next.js; no build settings to change)
   - Settings → Environment Variables:

     | Variable | Required | Value |
     |---|---|---|
     | `NEXT_PUBLIC_SUPABASE_URL` | for accounts/sync | Supabase → Project Settings → API → Project URL |
     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for accounts/sync | anon / publishable key |
     | `SUPABASE_SERVICE_ROLE_KEY` | for `/admin` | service_role secret key |
     | `ADMIN_EMAILS` | for `/admin` | comma-separated admin login emails |
     | `RESEND_API_KEY` | optional | Resend API key (admin email tab) |
     | `EMAIL_FROM` | optional | e.g. `Vokabi <hello@yourdomain.com>` (domain verified in Resend) |

   - Alternatively, install the **Vercel↔Supabase integration** ("Link existing Supabase account") which injects the two `NEXT_PUBLIC_*` variables automatically (keep the default `NEXT_PUBLIC_` prefix)
   - Deploy; attach the custom domain under Settings → Domains
4. **Groq (optional, AI photo-scan cleanup)** — sign in as an admin, open **Back office → System settings**, paste a Groq API key ([console.groq.com](https://console.groq.com)) and use *Test connection*. The key lives in the `app_settings` table, so no env var or redeploy is involved; without it photo scans use the heuristic fallback
5. **Verify** — open the site: you should land on `/login`; create the admin account (email from `ADMIN_EMAILS`); Settings should show sync status and the **Back office** button; add a word and confirm it appears in Supabase → Table Editor → `words`

## Operational gotchas

- **Env var changes require a redeploy** — `NEXT_PUBLIC_*` values are inlined at build time. Vercel: Deployments → ⋯ → Redeploy
- **Clients cache aggressively** — the service worker updates on a two-visit cycle: users may need to fully close and reopen the app twice after a release. If you change cached static assets or SW logic, bump `CACHE` in `public/sw.js` (currently `vokabi-v13`)
- **Database schema changes** are applied manually: re-run the updated SQL file in the Supabase SQL Editor. The files are written idempotently; there is no migration tooling or history table
- **Local production test**: `npm run build && npm start` (the SW only registers in production mode)
- **Rollback**: Vercel → Deployments → pick a previous deployment → *Promote to Production*. Note this does not roll back Supabase schema changes

## Local development against production data

Not recommended, but possible: put the production Supabase URL/keys in `.env.local`. Anything you do locally then affects real user data — prefer a second Supabase project for development.
