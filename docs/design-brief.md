# LingCarbon Graph — UX/UI Design Brief

## 0. What this document is

A reference spec for generating the ideal UI of the LingCarbon Graph demo. It covers:

1. What already exists in the codebase today (verified against `/Users/wei/Desktop/graph`).
2. What should exist but doesn't — pages/states not yet built but the product needs.
3. The visual language to apply (Claude / Anthropic aesthetic, adapted for a data app).
4. Page-by-page specs with user flows, so each screen can be generated with full context.

> **About Claude Design.** Anthropic launched Claude Design (claude.ai/design) on 2026-04-17 — it reads your codebase/brand and generates polished, ship-ready UI with a persistent design system. The "Claude aesthetic" in this brief means Anthropic's visual DNA: warm peach primary, cream/tan neutrals, serif display type, generous whitespace, deliberate typography hierarchy, no generic-AI purple gradients.

---

## 1. Product context (one paragraph)

LingCarbon Graph turns a company's messy bag of carbon-inventory source files (fuel receipts, electricity bills, refrigerant logs, work-hour sheets) into a traceable, auditable emissions graph — Company → Facility → Emission Source → Activity Data → Source Document. The user lands, creates a project for one reporting year, uploads documents, triggers backend extraction, and explores the resulting graph + analytics. The audience is an ESG / carbon inventory analyst (Taiwan market, Traditional Chinese domain terms).

---

## 2. Visual language — "Claude, for a dark data app"

### Palette (dark-mode locked)

| Role | Token | Value | Use |
|---|---|---|---|
| **Primary / signature** | `--primary` | `#DE7356` (Claude peach) | CTAs, focus rings, selected state, key graph nodes |
| **Primary soft** | `--primary-soft` | `oklch(0.70 0.14 45 / 0.15)` | Hover wash, dashed upload border tint |
| **Background base** | `--background` | `oklch(0.145 0 0)` ≈ `#141414` | Page canvas (current) |
| **Surface / card** | `--surface` | `oklch(0.19 0.005 60)` | Elevated cards, one step up from base |
| **Surface high** | `--surface-2` | `oklch(0.23 0.008 60)` | Hover, tooltips, modals |
| **Border subtle** | `--border` | `oklch(1 0 0 / 0.08)` | Card edges, dividers |
| **Foreground** | `--foreground` | `oklch(0.985 0 0)` | Primary text |
| **Muted** | `--muted-foreground` | `oklch(0.72 0 0)` | Secondary text, captions, table headers |
| **Cream accent** | `--accent-cream` | `#F8EED2` @ 8% alpha | Warm highlight on selected row / banner tint |
| **Scope 1** | `--scope-1` | `#DE7356` (peach) | Scope-1 emissions series |
| **Scope 2** | `--scope-2` | `#6FA4C9` (cool blue) | Scope-2 emissions series — cool counterpart |
| **Success** | `--success` | `oklch(0.72 0.15 155)` | Job succeeded, status pills |
| **Warn** | `--warn` | `#E9B84E` | Partial extraction, warnings |
| **Destructive** | `--destructive` | `oklch(0.62 0.22 25)` | Delete, failed jobs |

Emission-type glyphs (🚌 mobile, ❄ fugitive, ⚡ electricity, 🏭 process) stay as canvas glyphs but get flat-color variants for badges in analytics tables.

### Typography

- **Display / headings**: a warm serif in the spirit of Anthropic's *Copernicus* (the in-house serif used on claude.ai). Acceptable substitutes: **Tiempos Headline**, **Fraunces**, **Source Serif 4**. Use for page H1 (2.25rem / 36px, -0.02em tracking) and section titles.
- **Body / UI**: a geometric humanist sans — **Geist** (already installed) or **Söhne** style. 14–15px base, 1.5 line-height.
- **Mono**: **Geist Mono** for file hashes, IDs, monospace data cells.
- **Banned**: Inter, Roboto, Arial, Space Grotesk (Anthropic's own guidance flags these as overused by AI).

### Density, spacing, motion

- 8-px base grid. Card interior padding 24 px. Table row height 44 px (comfortable for long Chinese+number rows).
- Radius: **12 px** on cards, **8 px** on inputs and buttons, **6 px** on badges. Softer than current 10 px; feels less Bootstrap.
- Shadows: almost none on dark. Use 1-px inner border + a single subtle outer glow on elevated surfaces. Never drop-shadows that "float."
- Motion: 180 ms ease-out on hover; 240 ms spring-ish on panel slide-in. Crossfade on route transitions. No decorative animation — this is an audit tool.
- Iconography: **lucide-react** (already installed). 16 px in UI, 20 px in buttons, 24 px in empty states. Stroke 1.75.

### Tone

Serious, calm, archival. Whitespace-confident. A reader should feel they're in a well-lit library, not a stock-trading terminal.

---

## 3. Sitemap

```
/                                  → redirect → /projects
/projects                          Projects dashboard (list + card toggle)
/projects/new                      Create project form
/projects/[id]                     Project workspace (upload + docs + process)
/projects/[id]/graph               Graph visualization + analytics panel
/projects/[id]/report         [NEW] 表5 / export center
/projects/[id]/evidence/[docId] [NEW] Evidence viewer (PDF / XLSX embed)
/demo                              Read-only mock-data showcase
/settings                     [NEW] Workspace settings (company list, PII, theme)
/help                         [NEW] Quick start + integration guide (inline docs)
/404, /error                  [NEW] Branded empty states
```

"✓ exists" below = implemented in the current repo. "✗ to design" = needs design work.

---

## 4. Page specs

### 4.1 Projects dashboard — `/projects` ✓ exists, needs redesign

**Purpose.** The landing. No auth wall — land straight here. See every project ever created; create a new one; delete old ones.

**Layout.**

- **Top bar** (sticky, 64 px): wordmark left (`LingCarbon Graph` in the display serif), `Projects` / `Demo` / `Help` / `Settings` nav center-right, single gear icon far right. No avatar (no auth yet).
- **Hero row**: H1 `Projects` (serif, 36 px) + subcopy *"GHG inventory projects — upload documents, trigger processing, inspect results."* Right side: a segmented **List / Card** view toggle, and a primary **`+ New Project`** button in Claude peach.
- **Body**:
  - **Card view (default)**: 3-col grid of project cards. Each card ~280 × 180 px. Shows project name (serif, 18 px), company name + reporting year muted below, a sparkline of monthly emissions (if graph has been built), a status chip (`Draft` / `Processing` / `Ready`), and a total tCO₂e in peach. Hover lifts border to peach and surfaces two icon actions: **Open** → graph, **⋯** menu → Rename, Delete.
  - **List view**: dense table — columns: Name, Company, Year, Documents, Last job, Total tCO₂e, Status, Updated, Actions. Sticky header. Sort by any column.
- **Empty state**: large centered serif line *"No projects yet."* with muted subtext and the peach CTA. Warm, not clinical — use a small Claude-style illustration (a minimal line-drawn graph with a sparkle).

**Flows.**
- Click card / row → `/projects/[id]`.
- Click `+ New Project` → `/projects/new`.
- Delete from `⋯` → AlertDialog confirming "Delete {name}? Documents and graphs for this project will be removed." (destructive red).

**States to design.** Empty, 1-card minimum, paginated (after 30), loading (skeleton cards), error (inline alert above grid).

---

### 4.2 New project — `/projects/new` ✓ exists, needs redesign

**Purpose.** One focused form, no distractions.

**Layout.**
- Back link top-left (`← All projects`).
- Centered ~560-px card on a large cream-tinted background (the one place cream shows up warmly — a signature Anthropic move).
- H1 serif `New project`.
- Three fields stacked, with generous label typography:
  1. **Project name** — text input, serif-styled placeholder `e.g. 零碳運輸 2025`.
  2. **Company** — select from the preset `COMPANIES` list (from `lib/domain/ghg.ts`).
  3. **Reporting year** — year picker, default 2025, range 2024–2026.
- Two buttons at the bottom, right-aligned: ghost `Cancel`, peach `Create project`.

**Flow.** Submit → Supabase insert → redirect to `/projects/[id]`.

**States.** Validation errors inline under each field (peach-red text, no red panel), submitting spinner in the button.

---

### 4.3 Project workspace — `/projects/[id]` ✓ exists, needs redesign

This is the core of the "demo user flow" — three stacked sections that correspond to the three verbs: **Upload → Process → View**.

**Layout (single-column, max-w-4xl, centered).**

- **Back link** top-left.
- **Project header**: project name (serif H1), `{company} · Reporting year {year}` muted subtitle, a right-side chip row showing `{n} documents · {n} succeeded · {n} failed`.
- **Section 1 — Upload documents** (Card):
  - Copy: *"Drag & drop or click to pick. Supported: .xlsx .pdf .jpg .png (max 50 MB each). Uploads run 3 at a time."*
  - **Drop zone**: large dashed-border rectangle, 192 px tall, upload icon 32 px muted, label *"Drop files here, or click to pick."* On drag-over: dashed border turns peach, background washes to `--primary-soft`, label becomes *"Drop files to upload"*. Keyboard-focusable.
  - **Upload queue (below zone)**: row per in-flight file with filename, progress bar (peach), byte count, and phase label (`queued` / `uploading` / `done` / `error`). Done rows auto-dismiss after 1.2 s.
- **Section 2 — Documents** (Card):
  - Table of uploaded documents: filename + source-type glyph, size, uploaded-at, status badge (`uploaded` / `processed` / `failed` / `duplicate`), `⋯` actions (Delete). Sort by uploaded-at desc by default.
  - Empty state inside card: *"No documents uploaded yet."*
- **Section 3 — Processing** (Card):
  - Header copy: *"Runs every document in this project through the backend pipeline. Previously processed files are hash-deduped — safe to re-click."*
  - Right side of header: big peach **`Process N files`** button (disabled with tooltip when no docs / active job). Once a job has succeeded, a secondary **`View Graph`** button appears next to it.
  - **Active job card**: progress bar, counter `done / total`, current filename, elapsed time, cancel button.
  - **Recent jobs list**: rows showing status badge, started/finished timestamps, doc count, warnings count.

**Flows (primary happy path).**
1. Land on empty project → upload zone glows as the first-action anchor.
2. Drop files → queue populates → success rows auto-clear into Documents list.
3. Documents list shows the file; once status is `uploaded`, the Process button becomes enabled.
4. Click **Process** → toast *"Job queued — 12 documents"* → active-job card appears with live progress (Supabase realtime).
5. Job finishes → toast *"Processing complete"* → **View Graph** button appears.
6. Click **View Graph** → `/projects/[id]/graph`.

**States to design.** Drop zone idle / drag-over / error. Queue empty / mid-upload / all-done. Documents table empty / populated / mid-delete. Process button disabled (2 reasons) / enabled / submitting / active. Job card queued / running / failed / succeeded.

---

### 4.4 Graph view — `/projects/[id]/graph` ✓ exists, already feature-rich

**Purpose.** The headline surface. Three coordinated regions.

**Layout (full-viewport, 3 columns).**

- **Left rail (280 px)**: filters, sticky.
  - Search input (top).
  - **Year** selector (currently 2025-only).
  - **Scope** toggle group (1 / 2 / All) — Scope 1 peach, Scope 2 cool-blue pills.
  - **Facility** multi-select (checkbox list, 6 facilities).
  - **Source type** multi-select (fuel ⛽ / electricity ⚡ / refrigerant ❄ / work-hours 👷).
  - **Emission type** multi-select (mobile 🚌 / fugitive ❄ / purchased ⚡ / process 🏭).
  - **Topology** toggle: `Macro` / `Expanded` (expanded is diagnostic-only).
  - Clear-all text button at the bottom.
- **Center canvas (flex-1)**:
  - **Sticky stats strip** across the top: 4 big numbers — Total tCO₂e (serif, peach), Scope 1, Scope 2, record count. Underneath, smaller: facilities / sources / documents counts.
  - **Force graph** (react-force-graph-2d). Company center node, facility ring, emission-source leaves. Edge strokes subtle. Glyph emoji on emission-source nodes for emission-type. Node size log-scaled by emissions. Selected node glows peach.
  - Floating zoom controls bottom-right.
  - Bottom-left: small legend card (scope colors + glyph key).
- **Right analytics panel (480 px, slide-in on selection, slide-out on Esc)**:
  - Panel header: breadcrumb (Company / Facility / Source / Activity), close X, **PII toggle** (only visible when URL has `?pii=1`), status/warning badges.
  - Tab strip (different tabs per node type):
    - `company`: 概覽 / 場站 / 月度
    - `facility`: 概覽 / 排放源 / 月度
    - `emission_source`: 概覽 / 紀錄 / 月度 / 氣體
    - `activity_data`: 概覽 / 明細 / 氣體 / 原始檔案
  - Tab contents already implemented — overview stats, child tables, 12-bar monthly chart, 7-gas breakdown, source-type-specific detail tabs (fuel transactions, electricity TOU, refrigerant equipment list, work-hours rollups), evidence metadata.

**Flows.**
- Click node on canvas → panel slides in, tabs reset to default for that type.
- Click row in a child table (e.g. a record in emission_source) → panel drills into that activity, tabs update.
- Esc → panel closes.
- PII toggle (when gated by `?pii=1`) → unmasks vehicle plates / driver names in fuel and work-hours tabs.

**States to design.** No selection (panel hidden, canvas full width). Mid-drill (breadcrumb showing path). Empty filter result (canvas shows muted *"No nodes match these filters — clear filters to reset."*). Loading (skeleton canvas + skeleton stats).

---

### 4.5 Demo page — `/demo` ✓ exists

Identical to the graph view but with a small pinned banner: *"You're viewing read-only mock data (零碳運輸 2025). Create a project to upload your own."* + button to `/projects/new`.

---

### 4.6 [NEW] Report / Export — `/projects/[id]/report`

**Purpose.** Turn the graph into ISO 14064-style deliverables — **表5** (the required Taiwan Scope 1+2 summary), plus raw exports. Today this is a stub / not built.

**Layout.**
- Left rail same filters as graph (so exports respect the current slice).
- Main: three big export cards in a 3-col grid:
  1. **表5 (Scope 1 + 2 summary)** — XLSX. Preview thumbnail on the left (a rendered mini-table). Button: `Download XLSX`.
  2. **Full activity ledger** — CSV of every `activity_data` row with full gas breakdown.
  3. **PDF audit report** — cover page + 表5 + per-facility monthly chart + evidence index. Button: `Generate PDF`.
- Below the cards: **Export history** table — timestamp, kind, who triggered (once auth lands), size, redownload link.

**Flow.** Pick slice on the left → click download on a card → toast `Generating…` → browser download. No intermediate modal.

---

### 4.7 [NEW] Evidence viewer — `/projects/[id]/evidence/[docId]`

Opens in a new tab from the Evidence tab's `下載原始檔案` button. Replaces the current `「PDF 將於後續版本嵌入預覽」` placeholder.

**Layout.** Two columns:
- **Left (60%)**: embedded preview — PDF via `<iframe>` for electricity bills and receipts; XLSX rendered via SheetJS for fuel/refrigerant/work-hours. Toolbar: zoom, page nav, download.
- **Right (40%)**: the same Evidence tab content (file hash, status, warnings, processing time ms, extracted activity summary, sibling cross-year record banner).

**States.** Loading skeleton (rectangular shimmer in the preview area). Unsupported type fallback (*"Preview not available for this format — download to inspect."*).

---

### 4.8 [NEW] Settings — `/settings`

Light page, single column, tabs across the top.

- **General**: display locale (zh-Hant / en), display density (comfortable / compact), date format.
- **Company list**: CRUD the `COMPANIES` array that currently lives in `lib/domain/ghg.ts` — move it to a DB table.
- **PII**: global default (masked / unmasked), toggle for whether `?pii=1` is required.
- **Integrations**: backend API URL (currently `BACKEND_API_URL` env), health-check button, token rotation (when auth lands).
- **Danger zone**: bulk-delete all projects, reset demo data.

---

### 4.9 [NEW] Help — `/help`

Inline markdown of `docs/integration.md` + `CLAUDE.md`, but formatted as reader-friendly docs. Sidebar TOC, serif body, syntax-highlighted code blocks, peach link color. Search across docs (client-side fuse.js is enough).

---

### 4.10 [NEW] Errors, 404, loading skeletons

- **404**: centered serif `404`, muted subcopy *"That project no longer exists, or you don't have access."*, ghost button *"Back to Projects"*. Small hand-drawn Claude-style disconnected-graph illustration.
- **500 / unhandled**: same layout, message *"Something went wrong on our end. The error was reported."* + "Try again" button.
- **Loading skeletons**: every page that fetches should have a shimmer skeleton, not a spinner. Skeleton shapes match the real layout (card rows, table rows, stats strip).

---

## 5. Primary user flow (demo, happy path)

```
Land /
  → redirect /projects
    → Empty state: "No projects yet" + [+ New Project]
      → /projects/new
        → Fill 3 fields → Create
          → /projects/[id] (empty workspace)
            → Drop files into upload zone
              → Queue shows progress
                → Documents list populates
                  → [Process N files] button enables
                    → Click → Job queued → Active job card
                      → Realtime progress via Supabase
                        → Toast "Processing complete"
                          → [View Graph] button appears
                            → /projects/[id]/graph
                              → Stats strip + canvas + filters
                                → Click a facility node
                                  → Analytics panel slides in
                                    → Switch tabs, drill into records
                                      → Click a record row → drill to activity
                                        → Open Evidence tab
                                          → [Download original] → /evidence/[docId]
                                            → Inline PDF / XLSX preview
```

Secondary flows: delete project from dashboard, export 表5 from report page, toggle PII under `?pii=1`, switch List↔Card view, use search+filters on graph, re-process after uploading more files (hash dedup means safe to re-click).

---

## 6. Shared components to design (in this order)

1. **Top bar** — wordmark, primary nav, peach CTA slot.
2. **Project card** — signature surface, sparkline variant.
3. **Stats strip** — big-number row used on graph and report pages.
4. **Upload drop zone** — idle / drag-over / error states.
5. **Upload row** — filename + progress bar + phase chip.
6. **Document row** — with source-type glyph and status badge.
7. **Job card** — active / recent / failed variants.
8. **Analytics panel shell** — header + tab strip + scrollable body.
9. **Monthly 12-bar chart** — reusable on overview / source / facility tabs.
10. **Gas breakdown table** — 7-row layout, GWP badges.
11. **Evidence metadata block** — hash, status, warnings, processing time.
12. **Empty state illustration pattern** — Claude-style line drawings with a single peach accent.
13. **Alert dialog** — delete confirmation.
14. **Toast** — success / error / info.

---

## 7. What to hand to Claude Design

When you open Claude Design for this project, give it:

1. This document (the spec).
2. `app/globals.css` (current Tailwind v4 tokens — it will extend them with the palette above).
3. A screenshot of the current `/demo` page (so it has a visual starting point).
4. The sitemap section as the "pages to design" list.
5. A one-liner for each page: *"Design /projects dashboard: Claude aesthetic, dark mode only, project cards + list view toggle, primary peach CTA, warm serif headings."*

Claude Design reads the codebase to build a persistent design system — so the tokens above will flow automatically into every subsequent screen.

---

## Sources

- [Introducing Claude Design by Anthropic Labs](https://www.anthropic.com/news/claude-design-anthropic-labs)
- [Frontend Design – Claude Plugin](https://claude.com/plugins/frontend-design)
- [Claude Brand Color Codes (brandcolorcode.com)](https://www.brandcolorcode.com/claude) — primary peach `#DE7356`
- [Claude Brand Color Palette (Mobbin)](https://mobbin.com/colors/brand/claude)
- [Awesome Claude Design (GitHub)](https://github.com/VoltAgent/awesome-claude-design) — 68 reference design systems
- [Prompting for frontend aesthetics (Claude Cookbook)](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)
- [Get started with Claude Design](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)
