# Backend setup (Supabase)

The app works with **no backend** — it falls back to a local "demo" mode that
stores everything in your browser. To enable **real accounts, shared data, and
server-side uploads**, connect Supabase. This takes ~5 minutes.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In **Project Settings → API**, copy the **Project URL** and the **anon /
   public** key.

## 2. Run the schema

Open **SQL Editor** in the Supabase dashboard, paste the contents of
[`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql),
and run it. This creates the `profiles`, `datasets`, `dataset_files`,
`licenses`, and `downloads` tables (with row-level security) and a private
`datasets` storage bucket.

## 3. Configure auth

In **Authentication → Providers**, keep **Email** enabled. For the smoothest
demo, you can turn **"Confirm email"** off (Authentication → Sign In / Providers
→ Email) so new accounts can sign in immediately. Add your deployed URL under
**Authentication → URL Configuration → Site URL / Redirect URLs**.

## 4. Set environment variables

Copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
```

Add the **same two variables** in Vercel (**Settings → Environment Variables**)
and redeploy. The app auto-detects them: when present it uses Supabase Auth and
the database; when absent it stays in demo mode.

## What runs where

| Concern        | Demo mode (no env)     | Supabase mode                          |
| -------------- | ---------------------- | -------------------------------------- |
| Accounts       | Local fake user        | Real Supabase Auth (email + password)  |
| Listings / library / downloads | `localStorage` (per-user) | Postgres tables with row-level security; hydrated on login |
| Uploaded file **bytes** | `localStorage` cache | Uploaded to the private `datasets` Storage bucket on publish; non-owners download via license-checked signed URLs (`/api/download`) |

When Supabase is configured and you sign in, your published listings, licensed
library, and download history are loaded from Postgres and mirrored on every
change, so they follow your account across devices. The local cache is still
written, so the app keeps working offline.

> Payments (Stripe) are layered on in the next stage. The storage read policy in
> the migration currently allows any signed-in user to read bucket files;
> tighten it to require a matching `licenses` row before production.

## Verifying Supabase mode (quick checklist)

After setting the env vars and running the migration:

1. Click **Sign in → Create account**; confirm a row appears in
   **Authentication → Users** and in `public.profiles`.
2. In **Seller Studio**, publish a listing; confirm rows in `public.datasets`
   and `public.dataset_files`.
3. License/checkout a dataset; confirm a row in `public.licenses`. Download a
   file; confirm a row in `public.downloads`.
4. Sign in from a different browser; your listings, library, and downloads
   should load from the cloud.

## Payments (Stripe)

Card payments are handled by two serverless functions in [`/api`](../api),
deployed automatically by Vercel. With no Stripe keys set, the Library checkout
falls back to **instant licensing** (the verified demo path).

### Setup

1. Create a [Stripe](https://stripe.com) account and grab your **test** keys
   (Developers → API keys).
2. Set environment variables (locally in `.env.local` and in Vercel):

   ```
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   SUPABASE_SERVICE_ROLE_KEY=...        # so the webhook can grant licenses
   ```

3. Add a webhook endpoint in Stripe (Developers → Webhooks) pointing at
   `https://YOUR-DOMAIN/api/stripe-webhook`, subscribe to
   `checkout.session.completed`, and copy its signing secret into
   `STRIPE_WEBHOOK_SECRET`.

### Flow

- The Library "Pay with card" button POSTs the cart to `/api/checkout`, which
  prices each item from a **server-trusted** source (`api/_prices.ts` for the
  seed catalog, Supabase for listings — client amounts are never trusted) and
  returns a Stripe Checkout URL.
- On `checkout.session.completed`, `/api/stripe-webhook` writes a `licenses`
  row per purchased dataset (idempotent). The client also grants optimistically
  on return so it works even before the webhook lands.

> This is wired end-to-end but must be exercised with Stripe **test** keys
> before going live. Local `vite` does not run the `/api` functions — use
> `vercel dev` or a preview deployment to test the full payment flow. Use
> Stripe's [test cards](https://stripe.com/docs/testing) (e.g. `4242 4242 4242
> 4242`).

## Storage & downloads

When a seller publishes a listing while signed in, each file's bytes are
uploaded to the private `datasets` Storage bucket under `{userId}/{datasetId}/`.
Downloads resolve in this order: a generator (seed samples) → cached content
(files you just uploaded this session) → a **signed URL** from `/api/download`.

The Storage SELECT policy is **owner-only**, so other users can't read the
bucket directly. `/api/download` (service role) is the only path for them: it
mints a 60-second signed URL only after confirming the file is a free sample,
the requester owns the dataset, or they hold an active license. In short,
**paid downloads require a license** and free samples stay open. This needs the
same Supabase service-role key as the payments webhook, and only runs on a
Vercel deployment (or `vercel dev`), not under plain `vite`.

## Copilot (LLM-backed Ask & Workspaces)

Ask AEC and the Workspace copilot reason with Claude when a key is configured;
otherwise they use the always-on deterministic engine (`src/lib/intelligence.ts`),
so the app is fully functional with no key.

### Setup

1. Get an API key at [console.anthropic.com](https://console.anthropic.com).
2. Set it as a **server-only** env var in Vercel (and `.env.local` for
   `vercel dev`):

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   COPILOT_MODEL=claude-sonnet-4-6   # optional; e.g. claude-opus-4-8
   ```

3. Redeploy. The client probes `GET /api/copilot`; when it reports `enabled`,
   Ask shows a "Claude-powered" badge and free-text questions are answered by
   the model, and the Workspace copilot shows an "Ask AI" action.

### How it works

- `api/copilot.ts` calls Claude with a **prompt-cached** system persona and
  returns **structured output via forced tool use** (`analyst_answer` for Ask,
  `workspace_plan` for Workspaces) — so responses are reliable JSON the UI
  renders directly.
- The client sends only a **compact, governed data context** (portfolio
  aggregates for Ask; the problem, attached/available datasets and stage for
  Workspaces) — never raw confidential rows.
- The key is **never exposed to the browser**; all model calls go through the
  serverless function. With no key, every feature still works via the
  deterministic fallback. Like the other `/api` functions, the live path runs
  on Vercel (or `vercel dev`), not under plain `vite`.

> **Model note:** default is `claude-sonnet-4-6` (balanced for an interactive
> copilot). Set `COPILOT_MODEL=claude-opus-4-8` for maximum reasoning depth at
> higher cost/latency.
