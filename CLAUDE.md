# LingCarbon Graph Frontend

Obsidian-like force-graph view for visualizing GHG emissions data from the
LingCarbon pipeline. Users drill from company totals down to individual
加油 / 冷媒 / 電費 source documents for audit traceability.

## Commands

- Dev:   `pnpm dev`
- Build: `pnpm build`
- Lint:  `pnpm lint`

## Tech Stack

- Next.js 16 App Router + React 19 + TypeScript strict
- Tailwind v4 (oklch tokens, `@theme inline`)
- `react-force-graph-2d` (Canvas + d3-force)
- Dark mode locked at `<html className="dark">` — do not add theme toggle

## Architecture

Single mega-component `components/ghg-graph.tsx` (~660 lines) owns all
rendering, inspector, filter, and hover logic. The Canvas rendering
requires `dynamic(..., { ssr: false })` — keep this in `app/page.tsx`.

**Data flow (mockup phase):**
`public/mock-data/graph.json` → fetch in effect → `GHGGraphData` → graph

**Data flow (future live API):** either the backend returns
`GHGGraphData` directly, or it returns `DocumentRecord[]` and we call
`buildGraph()` from `lib/build-graph.ts`.

## Integration Contract (locked — do not change without approval)

Graph has 5 hierarchical layers. Node IDs are deterministic:

| Layer              | ID format                                 |
| ------------------ | ----------------------------------------- |
| `company`          | `company-{company_id}`                    |
| `facility`         | `facility-{D-code}`                       |
| `emission_source`  | `es-{facility_id}-{source_code}-{material_code}` |
| `activity_data`    | `activity-{document_id}`                  |
| `source_document`  | `doc-{source_file}`                       |

**Design decisions locked in:**

1. `emission_source` aggregates by **(facility_id, source_code, material_code)** —
   大客車+柴油 and 大客車+尿素 are separate nodes (matches 表5 rows)
2. `activity_data` is **1:1 per DocumentRecord** (per-month granularity —
   not aggregated up to yearly)
3. **Transaction / employee / equipment detail** lives inside
   `node.extraction` + `node.extraction_summary` — shown in inspector
   panel only, NOT as graph nodes
4. `emission_type` (`mobile_combustion` / `fugitive` / `purchased_electricity` /
   `process`) is a node attribute on `emission_source` — to be surfaced
   as a filter dimension alongside existing Scope toggles
5. Emissions **aggregated bottom-up** in React `useMemo` — never
   denormalized / stored on multiple layers

See `docs/integration.md` for the full schema diff from the v0 mock.

## Directory Layout

```
app/                        Next.js pages; page.tsx dynamic-imports the graph
components/
  ghg-graph.tsx             primary working surface — edit freely
  ui/                       57 unused shadcn files from v0 scaffold — DO NOT import
lib/
  types.ts                  extended schema (mirrors backend models/record.py)
  build-graph.ts            DocumentRecord[] → GHGGraphData transform
  ghg-data.ts               legacy v0 mock — being phased out
public/
  mock-data/graph.json      current dev data (50 nodes, 66 links, 28 records)
docs/
  integration.md            full backend↔frontend schema mapping + regen guide
```

## Conventions

- TypeScript strict; no `any`, prefer `unknown` + type guard
- Domain terms stay in Traditional Chinese (設備 / 場站 / 排放源 / 活動數據 / 來源文件);
  code and technical discussion in English
- **Additive over refactoring** — extend existing components rather than
  restructure. Don't split `ghg-graph.tsx` into multiple files unless
  explicitly asked
- **Hard failures over silent fallbacks** — if `graph.json` is missing,
  throw; don't fall back to `GHG_DATA` static import
- **Plan before coding** — for non-trivial changes, propose the approach
  first. Critical design flags go upfront, not mid-implementation
- No generic plugin architectures — 5 node types are concrete and final

## Gotchas

- `react-force-graph-2d` requires `ssr: false` dynamic import — keep it
- Tailwind v4 syntax (`@theme inline`, oklch) — do NOT downgrade to v3
- `next.config.mjs` has `ignoreBuildErrors: true` from v0 scaffold — must
  be removed before production deploy
- Most of `package.json` @radix-ui deps and all 57 `components/ui/` files
  are unused dead code from v0 — candidates for removal, but don't prune
  piecemeal; do the whole tree in one pass or not at all
- `lib/ghg-data.ts`'s `GHGNode` type is narrower than the new
  `lib/types.ts` — migrate usages; don't re-export from both

## Regenerating Mock Data

`graph.json` is generated from the backend's
`lingcarbon-ghg/outputs/*.record.json`:

```
cd <lingcarbon-ghg>
.venv/bin/python process.py        # reprocess inputs if changed
cd <wherever build_graph.py lives>
python3 build_graph.py             # outputs graph.json
cp graph.json <frontend>/public/mock-data/graph.json
```

## Open Work Items

Not started yet — this is where Claude Code picks up:

1. Wire `graph.json` into `components/ghg-graph.tsx` (replace
   `import { GHG_DATA }` with fetch)
2. Migrate types from `lib/ghg-data.ts` to `lib/types.ts`
3. Inspector panel: surface `gas_breakdown` (3-gas table),
   `extraction_summary` (TOU segments / transaction count / equipment list),
   and `status` / `warnings` badges
4. Filter panel: add `emission_type` multi-select next to Scope toggles
5. Source document nodes: visual badge when `status === 'partial'` /
   `'failed'` (currently `GP001_2001_2025_02.pdf` is partial)
6. Year selector (currently hardcoded 2025; wire when backend adds
   cross-year bill splitting per `lingcarbon-ghg/docs/TODO.md`)

@./docs/integration.md
