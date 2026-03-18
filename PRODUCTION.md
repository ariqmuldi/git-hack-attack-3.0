# Queuo — Production Setup

## Access

- **GitHub**: username `queuoapp` — sign in to access Vercel, Supabase, Resend, and Doppler (all linked via GitHub OAuth)
- **Google Account**: `queuoapp@gmail.com` — used only for **Google AI Studio** (Gemini API key)
- **Live URL**: https://queuo.vercel.app

---

## Production Stack

| Service | Purpose | Access |
|---|---|---|
| **Vercel** | Next.js hosting, auto-deploy on push to `main` | via GitHub |
| **Supabase** | Postgres DB, Auth, Realtime | via GitHub |
| **Resend** | Waitlist + table-ready emails | via GitHub |
| **Google AI Studio** | Gemini API key for kiosk voice/NLU flow | via Google account |
| **Doppler** | Secrets management, synced to Vercel | via GitHub |
| **GitHub** | Source control, triggers Vercel deploys | username `queuoapp` |

---

## What Was Set Up

### 1. Supabase

- Created a Supabase project linked to the shared Google account
- Ran [`sql/setup.sql`](sql/setup.sql) in the Supabase SQL Editor — creates all tables (`tables`, `table_zones`, `waitlist`, `profiles`, `reservations`) and RLS policies in one shot
- **Disabled email confirmation**: Supabase Dashboard → Authentication → Sign In / Providers → disable **"Confirm email"** (required so users can sign in immediately after registration)
- **Set production URL**: Supabase Dashboard → Authentication → URL Configuration:
  - Site URL: `https://queuo.vercel.app`
  - Redirect URLs: `https://queuo.vercel.app/**`
- To promote a user to admin, run in the Supabase SQL Editor:
  ```sql
  UPDATE public.profiles SET role = 'admin' WHERE email = 'you@example.com';
  ```

### 2. Resend

- Account created via Google
- Domain `ariqmuldi.com` verified as the sending domain
- Production emails sent from `queuo@ariqmuldi.com`
- Dev emails fall back to `onboarding@resend.dev`
- API key stored in Doppler as `RESEND_API_KEY`

### 3. Google AI Studio (Gemini)

- API key created at [aistudio.google.com](https://aistudio.google.com)
- Stored server-side only as `GEMINI_API_KEY` (never exposed to the browser)
- Used by `/api/gemini` route as a server-side proxy

### 4. Doppler

- Project: `queuo`, environment: `prd`
- Stores all 6 production secrets (see environment variables section below)
- Synced to Vercel via Doppler → Integrations → Vercel (set up after first Vercel deploy)
- Import option: **"Import, Preferring Doppler"**

### 5. Vercel

- Project imported from GitHub repo `queuoapp/git-hack-attack-3.0`
- Framework: Next.js (auto-detected)
- First deploy: env vars added manually via "Import .env"
- Subsequent deploys: secrets managed by Doppler sync
- Auto-deploys on every push to `main`

---

## Environment Variables

All secrets are stored in Doppler (`prd` environment) and synced to Vercel Production:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL (server-side) |
| `SUPABASE_SECRET_KEY` | Supabase `service_role` key — bypasses RLS, never expose to browser |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` — safe for browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase `anon` key — safe for browser |
| `RESEND_API_KEY` | Resend API key for sending emails |
| `GEMINI_API_KEY` | Google AI Studio key — server-side only |

`NODE_ENV` is set automatically by Vercel to `production` — do not add it manually.

---

## Deploying

Every push to the `main` branch on GitHub triggers an automatic Vercel redeploy.

To deploy manually:
```bash
git push origin main
```

To test production mode locally:
```bash
npm run build && npm start
```

---

## Production Behaviour (vs Dev)

| Feature | Dev | Production |
|---|---|---|
| Camera / YOLO vision | Live via `getUserMedia` + vision server | Disabled (`CAMERAS_ENABLED = false`) |
| Kiosk party size | Detected via camera | Random 1–5 (`Math.random`) |
| Table availability | Live from camera zones | Random 60% chance free |
| Sending email | `onboarding@resend.dev` | `queuo@ariqmuldi.com` |
| Gemini API key | Read client-side (`NEXT_PUBLIC_`) | Server-side only via `/api/gemini` proxy |

---

## Notes

- `PRODUCTION-uncensored.md` contains all credentials — it is gitignored and must never be committed
- The Supabase project used in Doppler/Vercel is the **production** project — separate from any local dev project
- Email confirmation is disabled in Supabase; if re-enabled, the register flow will break (users won't be able to sign in immediately)
