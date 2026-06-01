# Deploying to Vercel

This repo holds **two apps** that deploy as **two separate Vercel projects** from
the same GitHub repository:

| App | Folder (Root Directory) | Framework | What it is |
|---|---|---|---|
| **Landing page** | `landing/` | Next.js (static export) | The marketing front door |
| **Studio** | `/` (repo root) | Vite | The full AEC Data & Intelligence Studio |

> Why two projects: the landing page is Next.js and the studio is Vite — Vercel
> builds each from its own Root Directory. Deploy the studio first so you have
> its URL to point the landing page's CTAs at.

---

## A. Deploy the Studio (the app)

1. Go to **vercel.com → Add New… → Project** and **import this GitHub repo**
   (`emmanuelok/construction-analytics`).
2. **Root Directory:** leave as the repo root (`.`).
3. Framework preset auto-detects **Vite** (config is in `vercel.json`). Build
   command `npm run build`, output `dist` — already set.
4. **Environment Variables** — all optional; the app runs in demo mode without
   them. Add what you want live (see `.env.example` and `docs/BACKEND.md`):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — accounts, cloud sync, license-gated storage
   - `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — payments
   - `ANTHROPIC_API_KEY` (and optional `COPILOT_MODEL`) — the live LLM copilot **and the Flow Studio "Diagram it" planner**
5. **Deploy.** Note the resulting URL, e.g. `https://aec-studio.vercel.app`.

## B. Deploy the Landing page (the front door)

1. **Add New… → Project** and import the **same repo** again.
2. **Root Directory:** set to **`landing`**. (Framework auto-detects Next.js;
   `landing/vercel.json` pins it.)
3. **Environment Variables:**
   - `NEXT_PUBLIC_APP_URL` = the Studio URL from step A.5 (so every "Enter the
     studio" / "Launch" button links to the real app). Defaults to `/` if unset.
4. **Deploy.** This URL — e.g. `https://aec-studio-landing.vercel.app` — is your
   **public landing page**.

---

## Quick checklist (studio)

Tick these top-to-bottom for a clean first deploy:

- [ ] **Import** the repo at vercel.com → Add New… → Project (Root Directory `.`).
- [ ] Confirm preset **Vite**, build `npm run build`, output `dist` (from `vercel.json`).
- [ ] **Deploy** with **no env vars** first — confirm the app loads in demo mode.
- [ ] (Optional) Add Supabase vars → sign-up/sign-in + cloud sync go live.
- [ ] (Optional) Add Stripe vars **and** create a webhook at
      `https://<studio>/api/stripe-webhook` (event `checkout.session.completed`)
      → card payments + license grants go live.
- [ ] (Optional) Add `ANTHROPIC_API_KEY` → the Ask/Workspace copilot + Flow
      "Diagram it" planner answer via Claude.
- [ ] (Optional) Add `API_KEYS` → the public `GET /api/datasets` requires a key.
- [ ] **Redeploy** after adding any env vars (Vercel injects them at build time).

### Verify it's live

```bash
# Public dataset API (open unless API_KEYS is set):
curl "https://<studio>.vercel.app/api/datasets?pageSize=3"

# Copilot probe — returns { "enabled": true } once ANTHROPIC_API_KEY is set:
curl "https://<studio>.vercel.app/api/copilot"
```

In the app: **/developer** runs the same API live; **/welcome** is the landing;
the topbar **bell** shows notifications; every workbench can **Export** a brief.

---

## Result

- **Landing page:** `https://<landing-project>.vercel.app` — share this.
- **Studio app:** `https://<studio-project>.vercel.app` — the CTAs deep-link here.

Both auto-redeploy on every push to the branch you connect.

## Local preview (no deploy)

```bash
# Landing
cd landing && npm install && npm run dev      # http://localhost:3000

# Studio
npm install && npm run dev                    # http://localhost:5173
```

## Notes

- Without any env vars, **everything still works** in demo mode — local accounts,
  in-browser analytics, the deterministic Flow Studio planner. Keys only unlock
  the *live* cloud/LLM/payment paths.
- The studio's `/api/*` serverless functions (copilot, checkout, download,
  stripe-webhook) run automatically on Vercel; they're inert locally under plain
  `vite` (use `vercel dev` to exercise them locally).
