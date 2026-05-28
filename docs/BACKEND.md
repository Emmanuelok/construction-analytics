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
| Uploaded file **bytes** | `localStorage` cache | `localStorage` cache today — file *metadata* syncs to Postgres; pushing bytes to the `datasets` Storage bucket is a follow-up |

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
