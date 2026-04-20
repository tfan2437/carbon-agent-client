# GHG Inventory Explorer

A graph-centric web explorer for corporate greenhouse gas (GHG) inventory data. Interactive force-directed graph that lets users navigate the relationships between companies, facilities, emission sources, activity data, and source documents in a Scope 1 / Scope 2 inventory.

Originally scaffolded via [v0.app](https://v0.app).

## Overview

The dataset models a transportation company's annual GHG inventory as a directed graph:

```
Company ─┬─ Facility ─┬─ Emission Source ─── Activity Data ─── Source Document
         │            │
         └─ Facility ─┴─ ...
```

- **Nodes** are sized on a log scale by emissions (kgCO₂e) and colored by scope — orange for **Scope 1** (direct, e.g. diesel/LPG), blue for **Scope 2** (purchased electricity), gray for structural nodes.
- **Activity data** carries its emission factor and the source reference (e.g. `環境部 113年公告`, `台電 112年度電力係數`).
- Interaction: hover highlights neighbors, click selects a node for detail inspection, a filter panel scopes the view by scope / facility / text search.

The current demo dataset is static mock data for *嶺碳運輸股份有限公司 (LingCarbon Transport Co., Ltd.)* — see [lib/ghg-data.ts](lib/ghg-data.ts).

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (app router, Turbopack) |
| UI runtime | React 19 |
| Language | TypeScript 5.7 |
| Styling | Tailwind CSS v4 (PostCSS-only, no `tailwind.config`) |
| Component kit | [shadcn/ui](https://ui.shadcn.com) — `new-york` style, 57 primitives under `components/ui/` |
| Graph | [`react-force-graph-2d`](https://github.com/vasturiano/react-force-graph) (canvas) |
| Forms | `react-hook-form` + `zod` |
| Charts | `recharts` |
| Icons | `lucide-react` |
| Analytics | `@vercel/analytics` (production only) |
| Package manager | pnpm 10 |
| Linter | ESLint 9 (flat config) + `eslint-config-next` |

## Project layout

```
graph/
├── app/
│   ├── layout.tsx          # Root layout, dark-theme shell, metadata, Geist fonts
│   └── page.tsx            # Dynamically imports the graph (SSR-disabled for canvas)
├── components/
│   ├── ghg-graph.tsx       # Main visualization: force graph, filters, hover/select
│   ├── theme-provider.tsx
│   └── ui/                 # 57 shadcn/ui primitives
├── hooks/
│   ├── use-mobile.ts
│   └── use-toast.ts
├── lib/
│   ├── ghg-data.ts         # Types (GHGNode, GHGLink, NodeType, Scope) + mock dataset
│   └── utils.ts            # `cn()` class merger
├── public/                 # Favicons, icons
├── styles/                 # globals.css
├── components.json         # shadcn/ui config
├── next.config.mjs         # `ignoreBuildErrors`, `images.unoptimized`
├── postcss.config.mjs      # Tailwind v4 via @tailwindcss/postcss
├── eslint.config.mjs       # Flat config using eslint-config-next
├── tsconfig.json           # Path alias `@/*` → `./*`
└── package.json
```

## Data model

All types live in [lib/ghg-data.ts](lib/ghg-data.ts):

```ts
type NodeType = 'company' | 'facility' | 'emission_source' | 'activity_data' | 'source_document'
type Scope = 1 | 2 | null

interface GHGNode {
  id: string
  name: string                // 中文
  nameEn?: string              // English
  type: NodeType
  scope: Scope
  emissions?: number           // kgCO₂e
  activityValue?: number
  activityUnit?: string        // e.g. 'L', 'kWh', 'kg'
  emissionFactor?: { value: number; unit: string; source: string }
  facility?: string
  year: number
}

interface GHGLink { source: string; target: string }
```

## Getting started

Requires **Node ≥ 20** and **pnpm 10**.

```bash
pnpm install
pnpm dev           # http://localhost:3000
```

Production:

```bash
pnpm build
pnpm start
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Next dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint across the repo |

## Notes & caveats

- [next.config.mjs](next.config.mjs) sets `typescript.ignoreBuildErrors: true` — production builds tolerate type errors. There is one known `react-force-graph-2d` ref-typing mismatch at [components/ghg-graph.tsx:303](components/ghg-graph.tsx).
- `images.unoptimized: true` is set, so `sharp` is not required at runtime.
- The graph is loaded via `next/dynamic` with `ssr: false` because `react-force-graph-2d` renders to a `<canvas>`.
- Current ESLint run reports a handful of pre-existing issues in scaffolded shadcn/ui files (`components/ui/sidebar.tsx`, `components/ui/use-mobile.tsx`, `hooks/use-mobile.ts`) — not blockers, but worth cleaning up.
- The dataset is **mock data** — swap [lib/ghg-data.ts](lib/ghg-data.ts) for a real source when integrating.

## Roadmap (suggestions)

- Replace mock data with a live source (API, CSV import, database).
- Multi-year comparison (the model already carries `year`).
- Scope 3 support (requires extending `Scope` and adding upstream/downstream node types).
- Export: PNG snapshot of the graph and CSV of the selected subtree.
- Drill-down to `source_document` to render the underlying evidence.
