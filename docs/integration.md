# LingCarbon Graph Frontend Integration

Generated from backend records under `outputs/json/` (~345 DocumentRecords
spanning 2024-12 → 2026-01, with 2025 as the primary year).

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Sticky stats strip: company total · scope1 · scope2 · counts │
├────────────┬──────────────────────────┬──────────────────────┤
│ Filters    │                          │  Analytics Panel     │
│ (rail)     │  Force Graph Canvas      │  (480px, slides in   │
│            │  ~32 nodes (macro)       │   on selection)      │
│            │                          │                      │
│ • Search   │  Company                 │  Tabs vary by node:  │
│ • Scope    │   ↓                      │   company:           │
│ • Source   │  Facility (×6)           │     概覽/場站/月度    │
│ • Emission │   ↓                      │   facility:          │
│   Type     │  Emission Source (~25)   │     概覽/排放源/月度  │
│            │                          │   emission_source:   │
│            │  + 🚌 ❄ ⚡ 🏭 glyphs       │     概覽/紀錄/月度/   │
│            │                          │     氣體              │
│            │                          │   activity (drilled):│
│            │                          │     概覽/明細/氣體/   │
│            │                          │     原始檔案          │
└────────────┴──────────────────────────┴──────────────────────┘
```

The graph paints only `company / facility / emission_source`. The
`activity_data` and `source_document` layers ride along in
`GHGGraphData` and are looked up by the panel.

## Files

```
public/mock-data/graph.json    pre-built graph (regenerated from outputs/)
lib/types.ts                   TypeScript schema (mirror of backend models/record.py)
lib/build-graph.ts             pure transform: DocumentRecord[] → GHGGraphData
lib/aggregations.ts            pure rollup helpers used by panel tabs
lib/pii.ts                     PII masking helpers + URL gate
outputs/scripts/build_graph.py Python builder — keep in sync with lib/build-graph.ts
```

## Wiring

The mock JSON is loaded via `fetch('/mock-data/graph.json')` in
`components/ghg-graph.tsx`. To swap to a live backend:

- **Backend returns `GHGGraphData` directly**: change the fetch URL.
- **Backend returns `DocumentRecord[]`**: import `buildGraph()` from
  `lib/build-graph.ts` and call it on the response.

## Schema highlights

| Field | Notes |
|---|---|
| `emission` | **Array** of `EmissionEntry`. Length 1 typical; cross-year electricity bills produce length 2. |
| `monthly_breakdown` | Per-entry `{month, activity_value, emissions_kgco2e, emissions_tco2e}[]` of length 12. Refrigerant entries always carry it (12 equal slices); fuel/electricity/work_hours leave it `null` because each record is one month. |
| `monthly_emissions[12]` | On `company` / `facility` / `emission_source` nodes. Indexed Jan–Dec for `meta.primary_year`. Cross-year emission entries fall in their own accrual year. |
| `monthly_emissions_by_scope` | On `CompanyNode`. `{ '1': number[12], '2': number[12] }`. |
| `record_count` | On `emission_source` and `source_document`. |
| `file_hash` | SHA-256 of the source file. Carried on activity and document nodes for evidence cache lookup. |
| `file_processing_time_ms` | Per-record processing latency. Surfaced in the Evidence tab. |
| `evidence_url` | Stub `null` in v1. Populated when a future `--copy-evidence` flag runs. |
| `emission_type` | `mobile_combustion` / `fugitive` / `purchased_electricity` / `process` — node attribute on `emission_source`, surfaced as canvas glyph and filter dimension. |
| `gas_breakdown` | Per-gas (CO₂ / CH₄ / N₂O / HFCs / PFCs / SF6 / NF3) with `factor_per_unit`, `gwp`, and emission amounts. |
| `extraction_summary` | Source-type-specific summary (TOU segments / transaction stats / equipment list / employee counts). |
| `extraction` | Full backend payload — drives the Detail tabs. |
| `status` / `warnings` | Surfaced as badges in panel header and the Evidence tab. |

## Activity ID convention

```
activity-{document_id}             # length-1 emission[]
activity-{document_id}-y{YYYY}     # length-2+ emission[] split by accrual year
```

Cross-year electricity bills (Dec→Jan) produce two activity nodes
sharing one `source_file` and one `document_id`. The Detail-electricity
tab surfaces the sibling node in a "跨年度帳單" banner.

## Current data summary

```
345 records → 701 nodes / 749 links

Node type distribution:
  source_document      306
  activity_data        ~355  (one per record + cross-year splits)
  emission_source       33
  facility               6
  company                1

Totals:
  57,331.6941 tCO2e
    scope 1 = 57,185.8165
    scope 2 =    145.8776

Source type counts:
  fuel          204
  electricity    64
  refrigerant    53
  work_hours     24

Years covered: 2024, 2025, 2026 — primary year 2025
PII included: false (default — masked at build time)
```

Facility map:

| Group | facility_id | facility_name | Source codes present |
|---|---|---|---|
| GP000 | D00024 | 和欣汽車客運 | 0500 0600 1800 1900 |
| GP001 | D00001 | 台北車廠 | 0200 0300 0700 1100 1300 1500 2001 2002 |
| GP002 | D00002 | (TBD) | 0200 0300 0700 1100 1300 1500 2001 |
| GP003 | D00003 | (TBD) | 0200 0300 0700 1100 1300 1500 2001 |
| GP004 | D00004 | (TBD) | 0200 0300 0700 1100 1300 1500 2001 |
| GP005 | D00005 | (TBD) | 0200 0300 0700 1100 1300 1500 2001 |

## Regenerating the mock

```
cd /Users/wei/Desktop/graph
python3 outputs/scripts/build_graph.py public/mock-data/graph.json
# add --include-pii to keep raw plates / driver names / employee names
```

The script reads `outputs/json/*.record.json`, builds the graph
bottom-up, and writes the JSON. With `--include-pii` omitted (the
default), it masks:
- `extraction.transactions[].vehicle_plate` → first 3 chars + `-***`
- `extraction.transactions[].driver_name` / `driver_id` → `null`
- `extraction.employees[].employee_name` → `null`

Equipment IDs, employee departments, and titles are kept (not PII).

## PII unmask flow at runtime

1. URL must contain `?pii=1` (read by `lib/pii.ts`).
2. The `PiiToggle` button in the panel header becomes enabled.
3. Toggling it sets `unmasked: true` in `PiiContext`.
4. Detail tabs (fuel transaction table, work_hours employee table)
   then render raw values **if** the build was also run with
   `--include-pii`. Without that, the data is already masked at the
   source — runtime toggle has nothing to unmask.

## Design decisions baked in

1. **emission_source key** = (facility_id, source_code, material_code) —
   B100+柴油 and B100+尿素 are separate nodes. Matches 表5 grouping.
2. **activity_data granularity** = 1:1 per (DocumentRecord, accrual
   year). Refrigerant per-equipment files become per-equipment activities.
3. **File sub-items** (transactions, employees, equipment lists) live
   inside `extraction` / `extraction_summary` on the activity node and
   are rendered by Detail tabs. Not exposed as graph nodes.
4. **Emissions aggregated bottom-up** in `build_graph.py` (and mirrored
   in `lib/build-graph.ts`). No hand-maintained totals.
5. **Macro topology** — only company / facility / emission_source paint
   on the canvas. Activity / document data lives in panel.

## Deferred / future

- **Real evidence preview**: PDF embed for electricity bills, SheetJS
  render for XLSX records. Today the Evidence tab is a placeholder.
- **Multi-year selector**: relevant once 2026 data accumulates beyond
  the existing single Jan-2026 record.
- **Report generation pipeline (表5 Excel workbook)**: independent of
  the graph view — uses the same records but formats differently.
- **Scope 3**: backend `GHGScope` is `1 | 2` only. Adding Scope 3 means
  extending `Scope` in `types.ts` and adding a third color token.
