# LingCarbon Graph Frontend — Project Overview

## What it is

An interactive visualization for the LingCarbon GHG inventory pipeline. A
force-graph canvas paints the macro topology (Company → Facility → Emission
Source); a slide-in 480px analytics panel handles every micro-level
drill-down (records, monthly bars, gas breakdown, source-type detail tabs,
evidence/forensic). Built as the auditor-facing companion to a backend that
produces `DocumentRecord` JSONs from PDF/XLSX evidence.

Currently a **mockup-phase** UI loading a static `public/mock-data/graph.json`
rebuilt from `outputs/json/*.record.json`. Live API integration is a one-line
fetch swap.

## Tech stack

- **Next.js 16.2** App Router + **React 19** + **TypeScript strict**
- **Tailwind v4** with `@theme inline` and oklch tokens, dark-mode locked at
  `<html className="dark">`
- **`react-force-graph-2d`** (Canvas + d3-force), required
  `dynamic(..., { ssr: false })` import
- **No charting library** — `monthly-chart.tsx` and the histogram in
  `detail-work-hours` are hand-rolled SVG/divs
- **No state library** — selection lives in `ghg-graph.tsx` `useState`; PII is
  a small React Context

## Data model

`DocumentRecord` (backend) → `GHGGraphData` (`lib/build-graph.ts` mirrored by
Python `outputs/scripts/build_graph.py`).

Five node types form a strict hierarchy with deterministic IDs:

| Layer              | ID format                                                   |
| ------------------ | ----------------------------------------------------------- |
| `company`          | `company-{company_id}`                                      |
| `facility`         | `facility-{D-code}`                                         |
| `emission_source`  | `es-{facility_id}-{source_code}-{material_code}`            |
| `activity_data`    | `activity-{document_id}` or `activity-{document_id}-y{YYYY}` |
| `source_document`  | `doc-{source_file}`                                         |

Locked invariants:

- `emission_source` aggregates by **(facility_id, source_code,
  material_code)** — `大客車+柴油` and `大客車+尿素` are separate nodes
  (matches 表5 grouping).
- `record.emission` is **always an array** (`EmissionEntry[]`); cross-year
  electricity bills produce length-2 splits with `-yYYYY` suffixes.
- Emissions roll up bottom-up in the build script;
  `monthly_emissions[12]` (Jan-indexed) sit on company / facility /
  emission_source for `meta.primary_year` (2025).
- Sub-record detail (transactions, employees, equipment) lives inside
  `node.extraction` / `node.extraction_summary` — never as graph nodes.

Current corpus: **345 records → 701 nodes / 749 links**, ~57.3k tCO₂e total
(Scope 1: 57.2k, Scope 2: 146).

## Two coordinated surfaces

### 1. `components/ghg-graph.tsx` (~720 lines)

The canvas + filter rail + sticky stats strip. Holds all selection state.

- **Topology mode** toggle (`精簡` macro / `展開` detail). Macro paints only
  company / facility / emission_source (~32 nodes); detail adds activity_data
  + source_document (~700 nodes).
- **Theming** — three theme modes in `lib/themes.ts`: `材質` (material),
  `類別` (emission type), `範疇` (scope). Each maps node → color via a
  per-theme function. Scope theme uses amber/blue.
- **Filters**: search · year · scope (1/2 toggle) · facility (multi-select) ·
  source type (4) · emission type (4)
- **Selection state** — two pieces of state, dual-purpose:
  - `selectedNode` — the breadcrumb anchor (always an ES when an activity is
    drilled)
  - `selectedActivityId` — the drilled-in activity (nullable)
- **Click routing** (`onNodeClick` at line 416): clicking an activity_data
  node on canvas now resolves to its parent ES + sets the activity id, so
  canvas clicks and records-table clicks produce identical panel state.
- **Highlight**: both `selectedNode` and `selectedActivityId` get the same
  solid white ring; the connecting link is repainted white at original
  thickness.

### 2. `components/analytics-panel/` (~2300 lines across 17 files)

A 480px aside that swaps tab bodies based on the selected node type.

```
index.tsx           panel shell · tab strip · Esc handler · breadcrumb
pii-context.tsx     {unlocked, unmasked} React context
pii-toggle.tsx      header button (only enabled if URL contains ?pii=1)
tabs/
  overview.tsx      dispatched by node type — different cards for company /
                    facility / ES / activity
  facilities.tsx    company → facility table
  sources.tsx       facility → emission_source table
  records.tsx       emission_source → activity_data table (sortable,
                    paginated upstream of drill)
  monthly.tsx       12-bar tCO₂e bar chart
  monthly-chart.tsx shared inline chart
  gas-breakdown.tsx full 7-gas table
  detail.tsx        dispatcher by activity.source_type → one of:
  detail-fuel.tsx          transactions table (paginated, expandable rows) +
                           daily aggregation + Top 5 vehicles + 里程跳動
                           outliers
  detail-electricity.tsx   TOU segments + 抽取信心度 badge + cross-year
                           sibling banner
  detail-refrigerant.tsx   equipment list with GWP + evidence_ref + monthly
                           chart
  detail-work-hours.tsx    dept / title rollups + hours histogram + paginated
                           employee table + dept filter
  evidence.tsx     filename / hash / status + 排放係數 / 氣體拆解 / 抽取信心
                   forensic cards
  pagination.tsx   reusable Pagination component + usePagination hook
                   (offset-based, 50/page)
  sort-header.tsx  shared sortable <th>
```

**Tab sets per node type:**

- `company` → 概覽 / 場站 / 月度
- `facility` → 概覽 / 排放源 / 月度
- `emission_source` → 概覽 / 紀錄 / 月度 / 氣體
- `activity_data` (drilled) → 概覽 / 明細 / 氣體 / 原始檔案

## Recent enhancements (April 2026)

The activity-node sidebar started with a thin overview and a 100-row hard cap
on employee tables. Five-phase enrichment shipped:

1. **Pagination primitive** (`tabs/pagination.tsx`) — `共 N 筆 · 1–50` footer
   with `25 / 50 / 100` page-size buttons and `◀ ▶`. `usePagination` hook
   keeps page state local; uses derived-during-render `safePage` instead of a
   state-resetting effect (avoids React 19 cascading-render lint).

2. **Activity 概覽 enrichment** — three new cards joined the existing four:
   檔案資訊 (filename + hash + processing time + status badge), 氣體摘要
   (compact pills per gas), 萃取摘要 (source-type-conditional summary).

3. **Per-source detail upgrades**:
   - **Fuel**: per-row expand reveals driver / odometer / row_index /
     currency; new 里程跳動 (Top 5) odometer-jump outliers card
   - **Electricity**: prominent 抽取信心度 badge (高/中/低 + %);
     customer_number tail-masked unless PII unlocked
   - **Refrigerant**: GWP shown next to refrigerant_type; evidence_ref
     surfaced; per-equipment emission contribution when >1 item
   - **Work-hours**: replaced silent `slice(0, 100)` truncation with full
     pagination; clicking a 部門人時 row toggles a department filter on the
     employee table

4. **Evidence forensic cards** — 排放係數 (with 係數年度), 氣體拆解
   mini-table, 抽取信心 — all conditional on activity being set.

5. **Canvas click → panel parity** — clicking an `activity_data` node
   directly on the canvas now opens the same drilled panel state as clicking
   through a records row (parent ES + activity id both set). Selection ring
   lights both nodes; connecting link goes white.

## PII handling (two layers)

- **Build time** (`build_graph.py --include-pii`): default OFF. Without the
  flag, vehicle plates → `VFH-***`, driver_name / driver_id / employee_name →
  `null`. Equipment IDs, departments, titles are kept (not PII).
- **Runtime** (`?pii=1` URL param): enables the `PiiToggle` button in the
  panel header. Toggling it sets `unmasked: true` in `PiiContext`. Detail
  tabs read `usePii()` and choose raw vs. masked. Without `--include-pii` at
  build time, the toggle has nothing to unmask.

Tail-masking helpers live in `lib/pii.ts`.

## Critical conventions (from CLAUDE.md)

- **Hard failures over silent fallbacks** — missing `graph.json` throws.
- **Domain terms in Traditional Chinese** (設備 / 場站 / 排放源 / 活動數據 /
  來源文件); code in English.
- **No generic plugins** — 5 node types and 4 source types are concrete and
  final.
- **Plan before non-trivial code**.
- New panel tab files split by node type / source type for code isolation.

## Known dead code

- 57 unused `components/ui/*` files from v0 scaffold — to be removed in one
  pass, not piecemeal
- Most `@radix-ui/*` deps in `package.json` — same
- `lib/ghg-data.ts` — narrower legacy `GHGNode` type; migrate callers and
  remove
- `next.config.mjs` carries `ignoreBuildErrors: true` — must be off before
  production

## Open work items

1. **Real evidence preview** — PDF embed for electricity bills, SheetJS
   render for XLSX records. Today the Evidence tab "預覽" body is a
   placeholder.
2. **Multi-year selector** — relevant once 2026 data accumulates beyond the
   current single Jan-2026 record.
3. **Backend API integration** — graph still loads from static
   `/mock-data/graph.json`; switching is a one-line fetch URL change per
   `docs/integration.md`.
4. **Cleanup pass** — drop the unused shadcn tree, remove `lib/ghg-data.ts`,
   flip `ignoreBuildErrors`.

## Verification baseline

`pnpm lint && pnpm build` both clean. End-to-end smoke path validated:

1. Click any emission_source → 紀錄 tab → click a row.
2. Or click an activity_data directly in detail view (same result).
3. 概覽 tab tells you what was measured + factor used + extraction confidence
   in one screen.
4. 明細 tab paginates cleanly to 3,443 transactions across 69 pages.
5. 氣體 tab shows full 7-gas breakdown.
6. 原始檔案 tab confirms file hash, factor year, gas breakdown.
7. Esc closes panel; selection cleared.
