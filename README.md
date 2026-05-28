# AEC Data & Intelligence Studio

> A unified **data lakehouse**, **data marketplace** and **AI analytics platform** for the
> Architecture, Engineering, Construction & Operations (AEC) industry — designed to be the
> neutral data layer the built environment has never had.

This repository contains the interactive product concept / front-end studio. It demonstrates
how the platform collects, cleans, standardizes, stores, licenses and analyzes data across the
**entire AEC lifecycle**, and how it serves as both a **data source for companies training AI
models** and an **intelligent analytics platform** for every project stakeholder.

## 🌐 View it online

Once GitHub Pages is enabled for this repo (Settings → Pages → Source: **GitHub Actions**), the
studio is published automatically on every push by the workflow in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

**https://emmanuelok.github.io/construction-analytics/**

## 🧭 What's inside

The studio is organized into 14 modules plus a research dossier:

| Area | Modules |
| --- | --- |
| **Core** | Overview · Executive Insights · Ask AEC (natural-language analytics) |
| **Data Platform** | Data Lakehouse · Data Marketplace · AI Training Studio · Governance & Trust |
| **Intelligence Engines** | BIM · Document · Cost & Schedule · Procurement · Construction · Reality Capture · Sustainability & ESG · Digital Twin |
| **Research** | Unsolved Pain Points — the industry gaps we exist to close |

### The problem, in numbers (sourced)

- **$1.85T** lost globally in one year to "bad data" and rework — *Autodesk + FMI, 2020*
- **95.5%** of all captured E&C data is never used again — *FMI Corp*
- **$15.8B/yr** lost to inadequate interoperability in the US alone — *NIST GCR 04-867*
- **$1.6T** annual value opportunity from closing the productivity gap — *McKinsey*
- **~90%** of large infrastructure projects exceed budget — *cost-overrun meta-analyses*

A full, cited breakdown of 15 unsolved pain points lives in the **Unsolved Pain Points** module.

## 🛠️ Tech stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** design system (dark "data studio" aesthetic)
- **Recharts** for data visualization
- **React Router** (SPA, deep-link friendly on GitHub Pages)

## 🚀 Local development

```bash
npm install
npm run dev        # http://localhost:5173/construction-analytics/
npm run build      # production build → dist/
npm run preview    # preview the production build
```

> **Note:** the Vite `base` is set to `/construction-analytics/` for GitHub Pages project hosting,
> so the local dev URL includes that path prefix.

## 📁 Structure

```
src/
  components/    # UI kit, charts, layout (shell, sidebar, topbar)
  data/          # platform mock data + sourced pain-point research
  lib/           # nav config, formatters, hooks, cn()
  pages/         # one file per module route
```

---

*This is a concept studio: figures are illustrative mock data, while the macro statistics and
pain-point research are sourced from public studies (NIST, McKinsey, Autodesk/FMI, Dodge, and others).*
