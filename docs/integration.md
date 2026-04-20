# LingCarbon Graph Frontend Integration

Generated from `lingcarbon-ghg/outputs/` (28 DocumentRecords).

## Files

```
graph.json                 pre-built mock data — drop into public/mock-data/
lib/types.ts               extended TypeScript schema — replaces types in lib/ghg-data.ts
lib/build-graph.ts         pure transform: DocumentRecord[] → GHGGraphData
build_graph.py             the backend-side equivalent (keep them in sync)
```

## Wiring into the v0 frontend

### 1. Drop the mock data in

```
cp graph.json <frontend>/public/mock-data/graph.json
```

### 2. Replace the schema types

The existing `lib/ghg-data.ts` has a hand-rolled `GHGNode` type and a
hardcoded `GHG_DATA` constant. Replace the type layer with `lib/types.ts`
and delete the mock constant.

### 3. Load the graph data

Instead of the static `import { GHG_DATA } from '@/lib/ghg-data'`, fetch
the mock file at runtime:

```tsx
// In components/ghg-graph.tsx
import { useEffect, useState } from 'react';
import type { GHGGraphData } from '@/lib/types';

const [graph, setGraph] = useState<GHGGraphData | null>(null);

useEffect(() => {
  fetch('/mock-data/graph.json')
    .then((r) => r.json())
    .then(setGraph);
}, []);

if (!graph) return <div>Loading…</div>;

// Use graph.nodes, graph.links, graph.meta instead of GHG_DATA.*
```

### 4. Later — swap in the live backend

When the backend ships a graph endpoint, either:

- **Backend returns `GHGGraphData` directly**: just change the fetch URL.
- **Backend returns `DocumentRecord[]`**: use `buildGraph(records, company)`
  from `lib/build-graph.ts`.

## Schema differences from the v0 mock

| Field | v0 mock | New schema | Why |
|---|---|---|---|
| `emissions` | number on every level | `emissions_tco2e`, computed bottom-up | Avoid drift |
| `emission_type` | — | `'mobile_combustion' \| 'fugitive' \| 'purchased_electricity' \| 'process'` | New filter |
| `scope_category` | — | `'direct' \| 'indirect'` | Regulatory label |
| `material_code` / `material_name` | — | Present on emission_source + activity | B100 大客車 may use 柴油 or 尿素 |
| `gas_breakdown` | — | Per-gas CO₂/CH₄/N₂O/HFCs with factor+GWP | Inspector audit trail |
| `status` / `warnings` | — | Present on activity + document | Surface `partial`/`failed` records |
| `extraction_summary` | — | TOU segments, transaction count, equipment list | Inspector drill-down |
| `extraction` (full) | — | Raw backend payload | Deep forensic inspection |

## Current data summary

```
28 DocumentRecords → 50 nodes / 66 links

Node type distribution:
  activity_data        28
  source_document      11
  emission_source       8
  facility              2
  company               1

Totals:
  1,115.2745 tCO2e  (scope1=1,112.2978, scope2=2.9767)

Facilities:
  D00001 台北車廠                       26 records   1,113.3057 tCO2e
  D00024 和欣汽車客運股份有限公司           2 records         1.9688 tCO2e

Emission sources:
  大客車 · 柴油                          1,104.9355 tCO2e   mobile_combustion
  大客車 · 尿素                              2.7882 tCO2e   mobile_combustion
  小客車 · 車用汽油                           1.7345 tCO2e   mobile_combustion
  小客車 · 柴油                              0.2343 tCO2e   mobile_combustion
  住宅及商業建築空調 · R410a                   2.6035 tCO2e   fugitive
  家用的冷凍、冷藏裝備 · HFC-134a              0.0005 tCO2e   fugitive
  飲水機 · HFC-134a                         0.0013 tCO2e   fugitive
  使用外購電力設備 · 外購台電電力               2.9767 tCO2e   purchased_electricity

One record has partial status: GP001_2001_2025_02.pdf  (electricity — TOU extraction warning)
```

## Regenerating the mock

When you add more files to `lingcarbon-ghg/inputs/` and reprocess:

```
cd lingcarbon-ghg && .venv/bin/python process.py
cd ..
python3 build_graph.py                 # regenerates graph.json
cp graph.json <frontend>/public/mock-data/graph.json
```

## Design decisions baked in

1. **emission_source key** = (facility_id, source_code, material_code) —
   B100+柴油 and B100+尿素 are separate nodes. Matches 表5 grouping.
2. **activity_data granularity** = 1:1 per DocumentRecord (per-month) —
   preserves every bill/file for drill-down.
3. **File sub-items** (2,781 fuel transactions, employees, equipment lists)
   live inside `extraction` / `extraction_summary` on the activity node,
   shown in the inspector panel. Not exposed as graph nodes.
4. **emission_type** surfaced as a filter dimension (new attribute on
   emission_source nodes). No UI wired yet — add a filter block next to the
   existing Scope toggles.
5. **Emissions aggregated bottom-up** (activity → source → facility → company).
   No hand-maintained totals.

## Deferred / future

- **Cross-year bill splitting** (electricity bill spanning Dec–Jan): the backend
  TODO explicitly notes this. When implemented, one record will produce
  per-year sub-records; the transform already keys by `period_start.year`
  so once the backend splits, the graph will show them correctly.
- **Report generation pipeline (表5 Excel workbook)**: independent of the
  graph view — uses the same records but formats differently.
- **Scope 3**: backend `GHGScope` is `1 | 2` only. If Scope 3 is added later,
  extend `Scope` in `types.ts` and add a third color token.
