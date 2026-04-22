# LingCarbon Graph Frontend

Hybrid macro-to-micro view of GHG emissions data from the LingCarbon
pipeline. A force graph navigates structure (Company → Facility →
Emission Source); a side analytics panel handles records, time-series,
gas breakdown, and evidence drill-down.

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

Two coordinated surfaces:

- `components/ghg-graph.tsx` — force-graph canvas + filters + sticky
  stats strip + selection state. Canvas requires `dynamic(..., { ssr:
  false })` — keep this in `app/page.tsx`.
- `components/analytics-panel/` — 480px slide-in aside, tab-routed by
  selected node type. Owns record tables, monthly charts, gas breakdown,
  source-type detail tabs, evidence placeholder, and PII unmask.

The graph **only paints** company / facility / emission_source nodes
(`MACRO_TYPES` in `ghg-graph.tsx`). Activity_data and source_document
nodes are loaded from `graph.json` and held in the graph state for the
panel to look up — they don't compete for canvas real estate.

**Data flow (mockup phase):**
`public/mock-data/graph.json` → fetch in effect → `GHGGraphData` → graph

**Data flow (future live API):** either the backend returns
`GHGGraphData` directly, or it returns `DocumentRecord[]` and we call
`buildGraph()` from `lib/build-graph.ts`.

## Integration Contract (locked — do not change without approval)

Graph has 5 hierarchical layers. Node IDs are deterministic:

| Layer              | ID format                                              |
| ------------------ | ------------------------------------------------------ |
| `company`          | `company-{company_id}`                                 |
| `facility`         | `facility-{D-code}`                                    |
| `emission_source`  | `es-{facility_id}-{source_code}-{material_code}`       |
| `activity_data`    | `activity-{document_id}` or `activity-{document_id}-y{YYYY}` |
| `source_document`  | `doc-{source_file}`                                    |

**Cross-year activities**: when one record's `emission[]` array spans
multiple accrual years (e.g., a Dec→Jan electricity bill), each entry
becomes its own activity node with the `-y{YYYY}` suffix. Single-year
records keep the bare `activity-{document_id}` form.

**Design decisions locked in:**

1. `emission_source` aggregates by **(facility_id, source_code, material_code)** —
   大客車+柴油 and 大客車+尿素 are separate nodes (matches 表5 rows)
2. `activity_data` is **1:1 per (DocumentRecord, accrual year)**.
   Refrigerant records that ship per-equipment files become per-equipment
   activities.
3. **Transaction / employee / equipment detail** lives inside
   `node.extraction` + `node.extraction_summary` — shown in the
   analytics panel detail tabs only, NOT as graph nodes.
4. `emission_type` (`mobile_combustion` / `fugitive` /
   `purchased_electricity` / `process`) is a node attribute on
   `emission_source`, surfaced both as a glyph on the canvas
   (🚌 / ❄ / ⚡ / 🏭) and as a filter dimension.
5. Emissions **aggregated bottom-up** in the build script — each
   activity's `emission[]` entries roll up to source / facility /
   company. Monthly arrays (`monthly_emissions[12]`, indexed Jan–Dec)
   sit on company / facility / emission_source nodes.
6. **Year**: `meta.primary_year` (currently 2025) is the window the
   monthly arrays cover. Cross-year emission entries fall in their own
   accrual year and are excluded from primary-year monthly aggregates
   that don't match.

See `docs/integration.md` for the full backend↔frontend schema mapping.

## Directory Layout

```
app/                            Next.js pages; page.tsx dynamic-imports the graph
components/
  ghg-graph.tsx                 force graph + filters + selection state
  analytics-panel/
    index.tsx                   panel shell + tab strip + Esc handler
    pii-context.tsx             {unlocked, unmasked} React context
    pii-toggle.tsx              header button (gated by ?pii=1)
    tabs/
      overview.tsx              dispatched by node type
      facilities.tsx            company → facility table
      sources.tsx               facility → emission_source table
      records.tsx               emission_source → activity_data table
      monthly.tsx               12-bar tCO₂e bar chart (uses monthly-chart)
      monthly-chart.tsx         shared inline 12-bar bar chart (no Recharts dep)
      gas-breakdown.tsx         shared 7-gas table
      detail.tsx                dispatcher by activity.source_type
      detail-fuel.tsx           transactions table + daily aggregation + top vehicles
      detail-electricity.tsx    TOU segments + cross-year sibling banner
      detail-refrigerant.tsx    equipment list + monthly chart from monthly_breakdown
      detail-work-hours.tsx     dept / title rollups + hours histogram
      evidence.tsx              filename / hash / status / preview placeholder
      sort-header.tsx           shared sortable <th> (declared at module scope)
  ui/                           57 unused shadcn files from v0 scaffold — DO NOT import
lib/
  types.ts                      extended schema (mirrors backend models/record.py)
  build-graph.ts                DocumentRecord[] → GHGGraphData transform (TS)
  aggregations.ts               pure rollup helpers used by panel tabs
  pii.ts                        masking helpers + URL gate read
  ghg-data.ts                   legacy v0 mock — being phased out
public/
  mock-data/graph.json          current dev data (regenerated from outputs/)
outputs/
  json/                         backend record JSONs (~349 records)
  scripts/build_graph.py        Python builder (mirror of lib/build-graph.ts)
docs/
  integration.md                full schema mapping + regen guide
```

## Conventions

- TypeScript strict; no `any`, prefer `unknown` + type guard
- Domain terms stay in Traditional Chinese (設備 / 場站 / 排放源 / 活動數據 / 來源文件);
  code and technical discussion in English
- **Hard failures over silent fallbacks** — if `graph.json` is missing,
  throw; don't fall back to `GHG_DATA` static import
- **Plan before coding** — for non-trivial changes, propose the approach
  first. Critical design flags go upfront, not mid-implementation
- No generic plugin architectures — 5 node types and 4 source types are
  concrete and final
- New panel tab files are split by node type / source type for code
  isolation. Inside a single tab file, prefer adding helpers locally
  over creating new files.

## PII handling

- **Build-time** (`build_graph.py --include-pii`): default OFF. With
  flag off, vehicle plates are masked (`VFH-***`), driver names/IDs
  blanked, employee names blanked. Equipment IDs, departments, and
  titles are never PII and are kept.
- **Runtime** (`?pii=1` URL param): when present, the panel header shows
  an unmask toggle (`PiiToggle`). Toggle ON only matters if the build
  was run with `--include-pii`; otherwise data is already masked at the
  source.
- `usePii()` returns `{ unlocked, unmasked }`. Components that show PII
  read this and choose between raw and masked values.

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
- `record.emission` is an **array** (`EmissionEntry[]`) — never a
  single object. Always iterate. Length 1 is the common case;
  cross-year electricity is the length-2 case.
- `EmissionSourceNode.scope` carries the scope of its child activities;
  `FacilityNode.scope` and `CompanyNode.scope` are `null` because they
  span scopes.

## Regenerating Mock Data

`graph.json` is generated from the backend records under `outputs/json/`:

```
cd /Users/wei/Desktop/graph
python3 outputs/scripts/build_graph.py public/mock-data/graph.json
# add --include-pii to keep raw plates / names (off by default)
```

The script reads `outputs/json/*.record.json`, builds the graph, and
writes the JSON. `lib/build-graph.ts` is a TypeScript mirror of the
same logic — keep them in sync if you change one.

## Open Work Items

1. Real evidence file preview (PDF embed for electricity bills, SheetJS
   render for XLSX fuel/refrigerant/work_hours). Today the Evidence tab
   is a placeholder card with a disabled download button.
2. Multi-year selector UI — only relevant once 2026 data accumulates.
3. Backend API integration — graph still loads from static
   `/mock-data/graph.json`; switching is a one-line fetch URL change per
   `docs/integration.md`.
4. Remove the 57 unused shadcn `components/ui/` files in one pass.
5. Remove `lib/ghg-data.ts` once no callers remain (separate cleanup).
6. Drop `ignoreBuildErrors: true` in `next.config.mjs` before production.

@./docs/integration.md
