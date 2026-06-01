# AEC Studio — Landing Page

The marketing site for the AEC Data & Intelligence Studio, built with
**Next.js 16 (App Router)**, **Tailwind CSS v4**, and **Framer Motion**. It is a
standalone, statically-exported app — fully isolated from the main studio (the
Vite SPA in the repo root), so it can be built and deployed independently.

## Develop

```bash
cd landing
npm install
npm run dev        # http://localhost:3000
```

## Build (static export)

```bash
npm run build      # emits a static site to ./out
```

`output: 'export'` in `next.config.mjs` produces a static `out/` directory that
deploys anywhere (Vercel, Netlify, S3, GitHub Pages).

## Configuration

| Env var               | Purpose                                                        | Default |
| --------------------- | -------------------------------------------------------------- | ------- |
| `NEXT_PUBLIC_APP_URL` | Where "Enter the studio" / "Launch" link to (the deployed app) | `/`     |
| `BASE_PATH`           | Path prefix when hosted under a sub-route                      | `''`    |

Example — point the CTAs at the deployed studio and host the page at the root:

```bash
NEXT_PUBLIC_APP_URL=https://studio.example.com npm run build
```

## Structure

- `app/` — layout, page, global Tailwind v4 theme (`globals.css`), favicon.
- `components/motion.tsx` — reusable scroll-reveal primitives (Framer Motion).
  Reveals fall back to visible after a short timeout so content is never
  trapped hidden if the IntersectionObserver doesn't fire.
- `components/Hero.tsx`, `Nav.tsx`, `Sections.tsx` — the page sections.

Brand tokens mirror the studio's dark blue→violet palette and Inter/JetBrains
Mono type, so the marketing site and the app read as one product.
