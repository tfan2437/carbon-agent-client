# LingCarbon Engram — Styling Guide (As-Built Reference)

This document is the **as-built** visual reference for the four surfaces the
project has finished styling: `/projects`, `/projects/new`, `/projects/[id]`,
and the application Sidebar/Shell. It catalogs the exact tokens, classes, and
recipes in use so a future implementer can extend the same aesthetic without
re-reading source.

> Companion doc: [`docs/design-brief.md`](./design-brief.md) is the
> *aspirational* spec — it captures the original design intent (e.g. "warm
> serif in spirit of Copernicus", "banned: Inter"). Reality has drifted: the
> shipped UI uses Inter, has its own `.lc`-scoped token system, and includes
> recipes the brief never described. This document is the source of truth for
> what is actually shipped today; do not treat the brief as authoritative for
> existing UI.

---

## Table of Contents

1.  [Overview & Design Philosophy](#1-overview--design-philosophy)
2.  [Where Tokens Live (file map)](#2-where-tokens-live-file-map)
3.  [The `.lc` Scope vs. Tailwind defaults](#3-the-lc-scope-vs-tailwind-defaults)
4.  [Color Tokens](#4-color-tokens)
5.  [Typography](#5-typography)
6.  [Sizing & Spacing](#6-sizing--spacing)
7.  [Component Recipes](#7-component-recipes)
8.  [Layout Patterns](#8-layout-patterns)
9.  [Sidebar](#9-sidebar)
10. [Form Patterns](#10-form-patterns)
11. [Status & Indicator Components](#11-status--indicator-components)
12. [Animations & Transitions](#12-animations--transitions)
13. [Page-Specific Recipes](#13-page-specific-recipes)
14. [Iconography](#14-iconography)
15. [Accessibility Patterns](#15-accessibility-patterns)
16. [Do's and Don'ts](#16-dos-and-donts)
17. [Quick Reference Tables](#17-quick-reference-tables)
18. [Appendix: Applying this to `/projects/[id]/graph`](#18-appendix-applying-this-to-projectsidgraph)

---

## 1. Overview & Design Philosophy

The aesthetic is **"Claude, for a dark data app"**:

- **Warm Claude-peach (`#DE7356`) over a dark warm-cool neutral canvas
  (`oklch(0.145 0.004 60)`)** — never pure black, never pure gray.
- **Linear-density.** Whisper-thin borders (`oklch(1 0 0 / 0.07)`), card
  backgrounds at 1.5% white, generous-but-not-roomy padding, 13–14 px body
  text, weight-510 headings with negative tracking.
- **Inter for everything** (display + body), Geist Mono for numerics, hashes,
  IDs, timestamps. (See §3 — root layout still wires Geist for the body, but
  every shipped page is inside the `.lc` scope which overrides to Inter.)
- **Single brand accent.** Peach is the only saturated brand color. Status
  uses a small set of muted blue/gold/green/red. Cream (`#F8EED2`) is reserved
  for the one "warm moment" — info callouts.
- **Calm motion.** All transitions 150–200 ms `ease-out`, no springs, no
  decorative animation.
- **Dark-mode locked.** `<html className="dark">` is hard-coded
  (`app/layout.tsx:39`) — there is no light mode and no theme toggle.

---

## 2. Where Tokens Live (file map)

| File | Purpose |
|---|---|
| [`app/globals.css`](../app/globals.css) | Tailwind v4 `@theme inline` tokens, light/dark color sets (shadcn lineage), base layer |
| [`components/engram/tokens.css`](../components/engram/tokens.css) | The Engram design system — `.lc` scoped colors, typography, component classes (`.btn`, `.card`, `.input`, `.pill`, `.nav-item`, `.stat-num`…) |
| [`app/layout.tsx`](../app/layout.tsx) | Root: `<html className="dark">`, Geist Google Font wiring, `bg #0B0E14` inline fallback, Sonner Toaster |
| [`app/projects/layout.tsx`](../app/projects/layout.tsx) | Imports `@fontsource-variable/inter`, `@fontsource/geist-mono`, then `tokens.css`. Every `/projects/*` page transitively gets these. |
| [`components/engram/Shell.tsx`](../components/engram/Shell.tsx) | `<Shell>`, `<PageHeader>` |
| [`components/engram/Sidebar.tsx`](../components/engram/Sidebar.tsx) | `<Sidebar>`, `<SidebarBrand>`, `<SidebarSection>`, `<SidebarNavItem>`, `<HexLogo>` |
| [`components/engram/Primitives.tsx`](../components/engram/Primitives.tsx) | `<Icon>` (1.75 stroke, ~50 names), `<Glyph>`, `<Sparkline>` |
| [`components/projects/v6-status-pill.tsx`](../components/projects/v6-status-pill.tsx) | `StatusPill` (5-status pill) + `V6_STATUS_TONES` palette |
| [`components/projects/v6-progress.tsx`](../components/projects/v6-progress.tsx) | `Progress` bar |
| [`components/projects/v6-status-filter.tsx`](../components/projects/v6-status-filter.tsx) | `StatusFilterButtons` (segmented filter rail) |
| [`components/projects/v6-pager.tsx`](../components/projects/v6-pager.tsx) | `Pager` |
| [`components/projects/project-delete-button.tsx`](../components/projects/project-delete-button.tsx) | Destructive `AlertDialog` pattern |
| [`components/projects/projects-dashboard-client.tsx`](../components/projects/projects-dashboard-client.tsx) | List/card views, bulk action bar, project StatusPill, CompletionRing |
| [`app/projects/new/page.tsx`](../app/projects/new/page.tsx) | Form recipes, `YearPicker`, cream callout |
| [`components/projects/project-detail-client.tsx`](../components/projects/project-detail-client.tsx) | Drop zone, documents table, processing footer, full-screen drag overlay |

Note: `components/ui/*` (57 files) is mostly v0-scaffold dead code. Only
`Checkbox`, `Button`, and the `AlertDialog` family are actually used. Do not
import anything else from `components/ui/` without checking it's referenced
elsewhere first.

---

## 3. The `.lc` Scope vs. Tailwind defaults

Two parallel CSS systems coexist:

1. **Tailwind v4** (`app/globals.css`) — drives anything written with Tailwind
   utility classes (`bg-background`, `text-foreground`, `rounded-lg`, etc.).
   `--font-sans` is `Geist`. Used for: shadcn primitives like `AlertDialog`
   and a few stragglers.
2. **Engram** (`components/engram/tokens.css`) — drives every page rendered
   under the `<Shell>` wrapper, scoped to the `.lc` class which `<Shell>`
   applies at the root. `--font-sans` is `Inter` here.

**Precedence rule:** inside `.lc` (which wraps every `/projects/*` page via
the `<Shell>` component), Inter + Engram tokens win. Outside `.lc`, the
root Tailwind tokens apply.

**Practical implication:** every recipe in this doc assumes the surface is
inside `<Shell>`. If you build a page that doesn't use `<Shell>`, none of the
component classes (`.btn`, `.card`, `.input`, etc.) will resolve correctly —
the selectors are scoped to `.lc *`.

---

## 4. Color Tokens

All values come from [`components/engram/tokens.css:5-67`](../components/engram/tokens.css).
Reference these via `var(--token-name)` in inline styles or className overrides.

### 4.1 Surfaces (warm-cool neutral, never pure gray)

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.145 0.004 60)` ≈ `#131211` | Page canvas (under `<Shell>`) |
| `--bg-deep` | `oklch(0.115 0.004 60)` ≈ `#0F0D0B` | Sidebar background — one step deeper than canvas |
| `--surface` | `oklch(0.19 0.005 60)` | Card-elevated surfaces (rarely used directly; cards prefer the 1.5% white overlay below) |
| `--surface-2` | `oklch(0.23 0.008 60)` | Hover / popover |
| `--surface-3` | `oklch(0.28 0.010 60)` | Active row highlight |

Cards in practice use a transparent white overlay rather than `--surface` so
they tint correctly against any future canvas color: `background: rgba(255,255,255,0.015)`.

### 4.2 Foregrounds (4-step warm near-white hierarchy)

| Token | Value | Use |
|---|---|---|
| `--fg`   | `oklch(0.985 0.003 60)` | Headings, primary text, current breadcrumb |
| `--fg-2` | `oklch(0.86 0.004 60)`  | Body, table cells, ghost button text |
| `--fg-3` | `oklch(0.66 0.006 60)`  | Muted labels, status pill text, helper text inside controls |
| `--fg-4` | `oklch(0.48 0.006 60)`  | Placeholders, timestamps, field hint text, count badges |

There is no fifth tier. If something needs to be even more muted, dim it via
opacity (e.g. disabled controls = `opacity: 0.5`).

### 4.3 Borders (3-step opacity ladder, warm-tinted)

| Token | Value | Use |
|---|---|---|
| `--border`   | `oklch(1 0 0 / 0.07)` | Standard dividers, card edges, table row separators, page-header underline |
| `--border-2` | `oklch(1 0 0 / 0.11)` | Slightly stronger — inputs, buttons (default) |
| `--border-3` | `oklch(1 0 0 / 0.16)` | Emphasized — button hover, drop-zone idle border |

### 4.4 Brand peach (Claude signature)

| Token | Value | Use |
|---|---|---|
| `--primary`       | `#DE7356` | Primary buttons, focus rings, completion ring, sparkline, processing status |
| `--primary-hover` | `#E58971` | `.btn-primary:hover` |
| `--primary-ink`   | `#1a0f0a` | Text/icon color on top of `--primary` (high contrast dark) |
| `--primary-soft`  | `oklch(0.70 0.14 45 / 0.15)` | Tinted background for selected year, active state, drop zone active fill |
| `--primary-line`  | `oklch(0.70 0.14 45 / 0.35)` | Selected card border, focus ring color |

**Selection convention** (used everywhere — list rows, cards, year picker):
- Background: `rgba(222,115,86,0.06)` (very subtle, lighter than `--primary-soft`)
- OR `rgba(222,115,86,0.08)` for stronger emphasis (selected list row)
- Border: `var(--primary-line)`
- Inner content: keep neutral colors — only the surround changes.

### 4.5 Cream accent — the "warm moment"

| Token | Value | Use |
|---|---|---|
| `--cream`      | `#F8EED2` | Auto-setup callout label, sparkles icon |
| `--cream-soft` | `oklch(0.95 0.04 85 / 0.08)` | Auto-setup callout background |

Cream is reserved for ONE thing only: positive informational callouts
("Auto-setup: we'll create…"). Never use it for warning, error, or
decorative. The matching border is `oklch(0.95 0.04 85 / 0.14)`.

### 4.6 Status colors (with `*-soft` variants for backgrounds)

| Token | Value | Use |
|---|---|---|
| `--success`      | `oklch(0.72 0.14 155)` | Processed status, success toasts |
| `--success-soft` | `oklch(0.72 0.14 155 / 0.14)` | Processed pill background |
| `--warn`         | `#E9B84E` | Processing (legacy), partial extraction |
| `--warn-soft`    | `oklch(0.80 0.13 85 / 0.14)` | |
| `--danger`       | `oklch(0.65 0.22 25)` | Error pill |
| `--danger-soft`  | `oklch(0.65 0.22 25 / 0.14)` | |
| `--info`         | `#6FA4C9` | Uploaded, scope-2 |
| `--info-soft`    | `oklch(0.70 0.07 240 / 0.15)` | |

A pill/chip's stroke is the same hue at 35% alpha (e.g.
`oklch(0.72 0.14 155 / 0.35)` for success), regardless of token.

### 4.7 Scope colors (graph series)

| Token | Value | Use |
|---|---|---|
| `--scope-1` | `#DE7356` (peach — same hue as primary) | Scope 1 emissions series |
| `--scope-2` | `#6FA4C9` (cool blue — same hue as info) | Scope 2 emissions series |

Scope 3 doesn't have a token because the backend `Scope` type is `1 | 2` only.

---

## 5. Typography

### 5.1 Font stack

Inter is loaded by [`app/projects/layout.tsx:2`](../app/projects/layout.tsx)
via `@fontsource-variable/inter` (variable axis), and Geist Mono via
`@fontsource/geist-mono/400.css` and `/500.css`.

Inside `.lc` ([`tokens.css:52-54`](../components/engram/tokens.css)):
```css
--font-serif: "Inter", "Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", ui-sans-serif, sans-serif;
--font-sans:  "Inter", "Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", ui-sans-serif, sans-serif;
--font-mono:  "Geist Mono", "Berkeley Mono", ui-monospace, "SF Mono", Menlo, monospace;
```

`--font-serif` is a legacy alias — historically pointed at a serif, now
points at Inter so existing `.serif` class usage still works.

### 5.2 Headings (`.lc h1, h2, h3, h4`)

[`tokens.css:82-93`](../components/engram/tokens.css):
```css
.lc h1, .lc h2, .lc h3, .lc h4 {
  color: var(--fg);
  font-family: var(--font-sans);
  font-weight: 510;          /* not 500 — variable axis sweet spot */
  letter-spacing: -0.022em;
  line-height: 1.05;
  margin: 0;
  font-feature-settings: "cv01", "ss03";
}
.lc h1 { font-size: 36px; }
.lc h2 { font-size: 24px; }
.lc h3 { font-size: 20px; }
```

In practice headings rarely use these defaults — pages override `font-size`
inline (e.g. page title is 30 px on `/projects`, 28 px on `/projects/new`).
The defaults exist as a safety net.

### 5.3 Body (`.lc`)

[`tokens.css:71-81`](../components/engram/tokens.css):
```css
.lc {
  color: var(--fg-2);
  background: var(--bg);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  font-feature-settings: "cv01", "ss03", "ss01";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  letter-spacing: -0.005em;        /* global subtle tightening */
}
```

Note: every `.lc`-scoped element inherits a global `letter-spacing: -0.005em`.
This is intentional — Inter at small sizes needs slight tightening to feel
sharp.

### 5.4 `.serif` class — display heading

[`tokens.css:98`](../components/engram/tokens.css):
```css
.lc .serif {
  font-family: var(--font-sans);   /* still Inter */
  font-weight: 510;
  letter-spacing: -0.024em;        /* tighter than headings (-0.022em) */
  font-feature-settings: "cv01", "ss03";
}
```

Use `.serif` (not the `<h1>` tag's defaults) when you want display-weight
typography on any element. Page titles use this:

```jsx
<h1 className="serif" style={{ fontSize: 30, marginBottom: 6 }}>Projects</h1>
<h1 className="serif" style={{ fontSize: 28, marginBottom: 6 }}>New project</h1>
<h2 className="serif" style={{ fontSize: 30 }}>Drop documents anywhere</h2>
<h3 className="serif" style={{ fontSize: 20 }}>{/* section title */}</h3>
<h3 className="serif" style={{ fontSize: 17 }}>{/* drop-zone heading */}</h3>
<h3 className="serif" style={{ fontSize: 16 }}>Documents</h3>
```

The `.serif` class is named `serif` purely for backwards compat — it does
NOT render a serif face.

### 5.5 `.mono` class — monospace

[`tokens.css:96`](../components/engram/tokens.css):
```css
.lc .mono {
  font-family: var(--font-mono);
  font-feature-settings: normal;   /* override the global cv01/ss03 */
}
```

Used for: file sizes, hashes, IDs, timestamps, count badges, pagination
labels, page-header metadata ("{company} · {year}"). Always pair with
`fontVariantNumeric: "tabular-nums"` when the digits should column-align.

### 5.6 Letter-spacing scale

| Use | Value | Where |
|---|---|---|
| Global body | `-0.005em` | `.lc` (everything inherits this) |
| Card title (project) | `-0.01em` | `projects-dashboard-client.tsx:245` |
| Wordmark (Engram logo) | `-0.02em` | `Sidebar.tsx:126` |
| Heading (h1–h4) | `-0.022em` | `tokens.css:86` |
| `.serif` display | `-0.024em` | `tokens.css:98` |
| `.stat-num` (32 px stat) | `-0.028em` | `tokens.css:218` |
| Stat label, section header (uppercase) | `+0.06–0.08em` | various |

**Rule of thumb:** larger type → tighter tracking (negative); small uppercase
labels → wider tracking (positive).

---

## 6. Sizing & Spacing

### 6.1 Radius scale

[`tokens.css:56-62`](../components/engram/tokens.css):
```css
--r-xs:   4px
--r-sm:   6px      /* nav items, focus ring corner, small inputs */
--r-md:   8px      /* default button, default input */
--r-lg:  12px      /* cards, drop zone */
--r-xl:  16px      /* rarely used */
--r-pill: 9999px   /* status pills, bulk action bar */
```

There is also a Tailwind `--radius: 0.625rem` (10 px) scale in `globals.css`
for shadcn primitives. AlertDialog uses that scale (`rounded-lg` = 10 px).
Don't mix — if you're inside `.lc`, use the Engram radii.

### 6.2 Page padding rhythm

| Region | Padding | Source |
|---|---|---|
| Page title section | `28px 20px 18px` | `projects-dashboard-client.tsx:509` |
| Stats strip vertical | `16px 0` | `projects-dashboard-client.tsx:521` |
| Stats strip cell horizontal | `0 20px` | `projects-dashboard-client.tsx:532` |
| Filter/control row | `0 20px` (margin-bottom 6px) | `projects-dashboard-client.tsx:543` |
| Card grid container | `8px 20px 32px` | `projects-dashboard-client.tsx:196` |
| List container | `0 20px` | `projects-dashboard-client.tsx:88` |
| Project detail body grid | `16px 20px 0` | `project-detail-client.tsx:696` |
| Project detail footer | `12px 20px` | `project-detail-client.tsx:785` |
| Form card interior | `36px` | `app/projects/new/page.tsx:86` |
| New page outer | `40px 20px` | `app/projects/new/page.tsx:83` |
| Page header | `0 16px` | `Shell.tsx:56` |

The gospel is **20 px horizontal page padding** (16 px in the page header
itself). Vertical varies by section.

### 6.3 Gap conventions

| Gap | Use |
|---|---|
| 2px  | Pager buttons, view-toggle pill internal |
| 4px  | Status filter tabs (loose), stats grid items |
| 6px  | Button icon→text gap, focus chip internal |
| 7px  | StatusPill icon→text |
| 8px  | Icon button row in `<PageHeader>`, card stats row, segmented year picker |
| 10px | List row name + checkbox, Sidebar nav-item icon→label, `<PageHeader>` overall |
| 12px | Detail row file icon→name, card column gap |
| 16px | Two-pane content grid gap, footer button group |
| 18px | Form-fields stack |

### 6.4 Standard heights

| Element | Height | Source |
|---|---|---|
| `<PageHeader>` | 44 px | `Shell.tsx:54` |
| Sidebar (expanded) | 100 vh | `Shell.tsx:20` |
| Sidebar width (expanded) | 220 px | `Sidebar.tsx:168` |
| `.nav-item` (sidebar row) | 28 px | `tokens.css:204` |
| `.btn` (default) | 32 px | `tokens.css:103` |
| `.btn-sm` | 26 px | `tokens.css:124` |
| `.btn-lg` | 38 px | `tokens.css:125` |
| `.btn-icon` (square) | 28 × 28 | `tokens.css:126` |
| `.input` / `.select` | 36 px | `tokens.css:153` |
| Input-shaped read-only field | 38 px | `app/projects/new/page.tsx:128` |
| `YearPicker` button | 38 px | `app/projects/new/page.tsx:29` |
| Status pill | 22 (default) / 20 (small) | `v6-status-pill.tsx:69` |
| Progress bar | 4 px | `v6-progress.tsx:9` |
| Status filter tab | 28 px | `v6-status-filter.tsx:58` |
| Pager button | 26 × 26 | `v6-pager.tsx:9-10` |
| `CompletionRing` | 18 × 18 | `projects-dashboard-client.tsx:59` |
| `Glyph` (default) | 22 px | `Primitives.tsx:99` |
| `HexLogo` | 22 px | `Sidebar.tsx:15` |
| Doc-row file icon | 20 px | `project-detail-client.tsx:1197` |
| Drop-zone container | width 360 / height 100% | `project-detail-client.tsx:997-998` |
| Drop-zone icon tile | 54 × 54 | `project-detail-client.tsx:1042-1043` |
| Full-screen drop overlay icon tile | 88 × 88 | `project-detail-client.tsx:929-930` |

---

## 7. Component Recipes

All recipes below are scoped to `.lc *` — they work as long as the page is
inside `<Shell>`.

### 7.1 Buttons (`.btn`)

[`tokens.css:101-126`](../components/engram/tokens.css):

```css
.lc .btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 12px;
  border-radius: var(--r-md);            /* 8px */
  font-size: 13px; font-weight: 500;
  border: 1px solid var(--border-2);
  background: rgba(255,255,255,0.02);
  color: var(--fg);
  cursor: pointer;
  transition: background 180ms ease-out, border-color 180ms ease-out, color 180ms ease-out;
  font-family: inherit;
  letter-spacing: -0.005em;
}
.lc .btn:hover { background: rgba(255,255,255,0.05); border-color: var(--border-3); }

.lc .btn-primary {
  background: var(--primary);              /* #DE7356 */
  color: var(--primary-ink);               /* #1a0f0a — dark on peach */
  border-color: transparent;
  font-weight: 600;                         /* heavier than default 500 */
}
.lc .btn-primary:hover { background: var(--primary-hover); /* #E58971 */ }

.lc .btn-ghost { background: transparent; border-color: transparent; color: var(--fg-2); }
.lc .btn-ghost:hover { background: rgba(255,255,255,0.04); color: var(--fg); }

.lc .btn-sm  { height: 26px; padding: 0 8px;  font-size: 12px; }
.lc .btn-lg  { height: 38px; padding: 0 16px; font-size: 14px; }
.lc .btn-icon { width: 28px; height: 28px; padding: 0; justify-content: center; }
```

**Variant matrix**

| Class | Use |
|---|---|
| `.btn` | Default — neutral chrome with subtle border (e.g. "View Graph") |
| `.btn.btn-primary` | Primary CTA — peach with dark ink (e.g. "Create project", "Process N file(s)") |
| `.btn.btn-ghost` | Secondary/tertiary — invisible until hover (e.g. "Cancel", icon buttons in page header) |
| `.btn.btn-ghost.btn-icon` | 28×28 icon-only (e.g. filter, sort, more) |
| `.btn.btn-sm` | Compact — pair with primary or ghost |
| `.btn.btn-lg` | Footer CTA — pair with primary (e.g. "Process N file(s)") |

**Disabled state pattern** (apply inline, no class):
```js
style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
disabled={disabled}
```

**Destructive button** has no class — it's an inline-style override on a `.btn-sm`:
```jsx
<button className="btn btn-sm" style={{
  background: "rgba(139, 0, 0, 0.5)",     /* dark maroon, 50% */
  color: "#fff",
  border: "none",
}}>
  <Icon name="trash" size={13} color="#fff" /> Delete
</button>
```
([`projects-dashboard-client.tsx:317-327`](../components/projects/projects-dashboard-client.tsx))
The dialog's **AlertDialogAction** is the other destructive treatment — it
uses Tailwind classes since AlertDialog is shadcn:
`className="bg-destructive text-destructive-foreground hover:bg-destructive/90"`.

### 7.2 Cards (`.card`)

[`tokens.css:145-149`](../components/engram/tokens.css):
```css
.lc .card {
  background: rgba(255,255,255,0.015);     /* 1.5% white — barely visible */
  border: 1px solid var(--border);
  border-radius: var(--r-lg);              /* 12px */
}
```

That's the entire `.card` definition. Padding, layout, and any
peach-tinted state are added inline per use:

- **Project card (selectable)**: `padding: 16px`, hover/selected swap to
  `border-color: var(--primary-line)` and
  `background: rgba(222,115,86,0.06)` ([`projects-dashboard-client.tsx:202-213`](../components/projects/projects-dashboard-client.tsx)).
- **Documents container card**: `flex: 1; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column;` so the table inside can scroll
  ([`project-detail-client.tsx:738-747`](../components/projects/project-detail-client.tsx)).
- **New-project form card**: `padding: 36px; position: relative;` plus a
  cream gradient overlay (see §10.5).

### 7.3 Inputs (`.input` / `.select`)

[`tokens.css:152-164`](../components/engram/tokens.css):
```css
.lc .input, .lc .select {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border-2);
  border-radius: var(--r-md);               /* 8px */
  color: var(--fg);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  transition: border-color 180ms ease-out, box-shadow 180ms ease-out;
}
.lc .input::placeholder { color: var(--fg-4); }
.lc .input:focus,
.lc .select:focus {
  border-color: var(--primary-line);
  box-shadow: var(--ring-focus);            /* 2px peach ring at 0.35 alpha */
}
```

### 7.4 Pills (`.pill`)

[`tokens.css:128-142`](../components/engram/tokens.css):
```css
.lc .pill {
  display: inline-flex; align-items: center; gap: 6px;
  height: 22px; padding: 0 8px;
  border-radius: var(--r-pill);            /* 9999px */
  font-size: 11.5px; font-weight: 500;
  border: 1px solid var(--border-2);
  color: var(--fg-2);
  background: transparent;
  white-space: nowrap;
}
.lc .pill-primary { color: var(--primary); border-color: var(--primary-line); background: var(--primary-soft); }
.lc .pill-success { color: var(--success); border-color: oklch(0.72 0.14 155 / 0.35); background: var(--success-soft); }
.lc .pill-warn    { color: var(--warn);    border-color: oklch(0.80 0.13 85 / 0.35); background: var(--warn-soft); }
.lc .pill-danger  { color: var(--danger);  border-color: oklch(0.65 0.22 25 / 0.35); background: var(--danger-soft); }
```

The base `.pill` class is rarely used — components like `StatusPill` (see
§11.1) inline their own styles for full control over animation. Use `.pill`
only for static badges where no behavior is needed.

### 7.5 Sidebar nav item (`.nav-item`)

[`tokens.css:202-213`](../components/engram/tokens.css):
```css
.lc .nav-item {
  display: flex; align-items: center; gap: 10px;
  height: 28px; padding: 0 8px;
  border-radius: var(--r-sm);              /* 6px */
  color: var(--fg-3);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: background 150ms ease-out, color 150ms ease-out;
}
.lc .nav-item:hover  { background: rgba(255,255,255,0.04); color: var(--fg); }
.lc .nav-item.active { background: rgba(255,255,255,0.06); color: var(--fg); }
.lc .nav-item.active .nav-icon { color: var(--primary); }

.lc .nav-icon { width: 16px; height: 16px; display: inline-flex; color: var(--fg-4); flex: 0 0 16px; }
.lc .nav-item:hover .nav-icon { color: var(--fg-2); }
```

The icon turning **peach** when the item is active is the only hint — there
is no left-rail bar, no underline, no text-weight change.

### 7.6 Stat number / label (`.stat-num`, `.stat-label`)

[`tokens.css:216-222`](../components/engram/tokens.css):
```css
.lc .stat-num {
  font-family: var(--font-sans);
  font-weight: 510;
  font-size: 32px;
  letter-spacing: -0.028em;
  color: var(--fg);
  line-height: 1;
}
.lc .stat-num.peach { color: var(--primary); }

.lc .stat-label {
  font-size: 11.5px;
  color: var(--fg-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
```

Used in:
- Dashboard stats strip — 4 columns, last value (tCO₂e) gets `.peach`
- Card stats — `style={{ fontSize: 24 }}` (smaller than 32 default), and
  label `style={{ fontSize: 10 }}` (smaller than 11.5 default).

### 7.7 Tables (`.t` class — but see notes)

[`tokens.css:170-185`](../components/engram/tokens.css):
```css
.lc table.t { width: 100%; border-collapse: collapse; }
.lc table.t th {
  text-align: left;
  font-weight: 500;
  font-size: 12px;
  color: var(--fg-3);
  letter-spacing: 0.02em;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}
.lc table.t td {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  font-size: 13.5px;
  color: var(--fg-2);
  vertical-align: middle;
}
.lc table.t tr:hover td { background: rgba(255,255,255,0.015); }
.lc table.t tr:last-child td { border-bottom: 0; }
```

In practice, the codebase **does not use `<table className="t">`** —
`projects-dashboard-client.tsx` and `project-detail-client.tsx` both define
their own header-cell and body-cell style objects inline so they can vary
per-route. The `.t` class is the default if you don't need customization;
otherwise copy the inline pattern from those two files (see §13.1, §13.3).

The two inline conventions in shipped code:

| | Project list | Documents table |
|---|---|---|
| Header font-size | 11.5 px | 12 px |
| Header letter-spacing | 0.06em | 0.02em |
| Header transform | uppercase | (lowercase) |
| Header padding | 10px 12px | 8px 12px |
| Body padding | 11px 12px | 12px |
| Body font-size | 13.5 px | 13.5 px |
| Row hover bg | `rgba(255,255,255,0.02)` | `rgba(255,255,255,0.015)` |

If creating a new table, follow the documents-table convention (12 px lower-case
small caps) — it's the more recent pattern.

### 7.8 Custom scrollbar (`.scroll`)

[`tokens.css:197-199`](../components/engram/tokens.css):
```css
.lc .scroll::-webkit-scrollbar { width: 10px; height: 10px; }
.lc .scroll::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.06);
  border-radius: 10px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.lc .scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.1);
  background-clip: padding-box;
  border: 2px solid transparent;
}
```

Apply `className="scroll"` to any container that needs `overflow: auto`. Track
is invisible; thumb is 6 px (10 px width minus 2 px transparent border each
side) and slightly inset, fading darker on hover.

### 7.9 Breadcrumb link (`.crumb-link`)

[`tokens.css:234-240`](../components/engram/tokens.css):
```css
.lc .crumb-link {
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  transition: color 150ms ease-out;
}
.lc .crumb-link:hover { color: var(--fg); }
```

Wrap parent crumbs in `<Link className="crumb-link">` so they're clickable;
the `<PageHeader>` component already greys parent crumbs to `--fg-3` (see §8.2).
The current crumb is plain text.

### 7.10 Keyboard chip (`kbd`)

[`tokens.css:188-194`](../components/engram/tokens.css):
```css
.lc kbd {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--border-2);
  color: var(--fg-2);
}
```

### 7.11 Focus ring (`:focus-visible`)

[`tokens.css:225`](../components/engram/tokens.css):
```css
.lc :focus-visible {
  outline: none;
  box-shadow: var(--ring-focus);    /* 0 0 0 2px oklch(0.70 0.14 45 / 0.35) */
  border-radius: var(--r-sm);
}
```

Every focusable element in `.lc` gets a peach ring on keyboard focus. Don't
override unless you have a specific reason; mouse-focus does not trigger
this thanks to `:focus-visible`.

### 7.12 Divider (`.hr`)

[`tokens.css:167`](../components/engram/tokens.css):
```css
.lc .hr { height: 1px; background: var(--border); border: 0; }
```

Vertical dividers in `<PageHeader>` actions are written inline rather than
using `.hr`:
```jsx
<div style={{ width: 1, height: 18, background: "var(--border)" }} />
```

---

## 8. Layout Patterns

### 8.1 `<Shell>` — app frame

[`components/engram/Shell.tsx:15-43`](../components/engram/Shell.tsx):

```jsx
<div className="lc" style={{ display: "flex", height: "100vh", width: "100%", background: "var(--bg)" }}>
  <Sidebar onToggle={toggle} collapsed={collapsed} />
  <main style={{
    flex: 1, minWidth: 0, height: "100%",
    display: "flex", flexDirection: "column", overflow: "hidden",
    position: "relative",
  }}>
    {/* If sidebar collapsed, an absolutely-positioned reopen button appears at top-left z=5 */}
    {children}
  </main>
  {rightRail}
</div>
```

- **Always wrap a page in `<Shell>`.** It applies the `.lc` class scope, sets
  the dark background, and ensures the sidebar + main + (optional) right rail
  layout. Without it, every Engram class (`.btn`, `.card`, etc.) silently
  fails because the selectors are `.lc *`.
- `<Shell>` accepts `rightRail` as a prop slot for a right-side panel — the
  graph view will likely want this for the analytics panel.

### 8.2 `<PageHeader>` — 44 px breadcrumb bar

[`Shell.tsx:52-71`](../components/engram/Shell.tsx):

```jsx
<header style={{
  height: 44, flex: "0 0 44px",
  display: "flex", alignItems: "center",
  padding: "0 16px",
  borderBottom: "1px solid var(--border)",
  gap: 10,
}}>
  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--fg)", fontSize: 13, fontWeight: 500 }}>
    {crumbs.map((c, i) => (
      <React.Fragment key={i}>
        <span style={{ color: i === crumbs.length - 1 ? "var(--fg)" : "var(--fg-3)" }}>{c}</span>
        {i < crumbs.length - 1 && <Icon name="chevronRight" size={12} color="var(--fg-4)" />}
      </React.Fragment>
    ))}
  </div>
  <div style={{ flex: 1 }} />
  {actions}
</header>
```

**Crumbs.** Pass an array of `ReactNode`s. Parent crumbs get `--fg-3`; the
last crumb (current page) gets `--fg`. Separators are `chevronRight` icons in
`--fg-4`. To make a parent clickable, pass a `<Link className="crumb-link">…</Link>`
as the crumb.

**Actions.** Right-aligned via the `flex: 1` spacer. Convention is
icon-buttons (`btn-ghost btn-icon`) → optional inline metadata in `.mono /
--fg-4` → optional `1×18 var(--border)` divider → primary action button.
Examples:

- `/projects`: filter / sort / layers buttons → divider → "+ New project"
  (`btn-primary btn-sm`).
- `/projects/[id]`: monospace metadata "Acme · 2025" → divider → ghost icon
  delete-trigger button.

### 8.3 Two-pane content grid (360 + 1fr)

[`project-detail-client.tsx:690-698`](../components/projects/project-detail-client.tsx):

```jsx
<div style={{
  flex: 1,
  display: "grid",
  gridTemplateColumns: "360px 1fr",
  gap: 16,
  padding: "16px 20px 0",
  minHeight: 0,
}}/>
```

`min-height: 0` is required on grid + flex children for inner content to
honor `overflow: auto`. Without it the content blows out. Always include it
when nesting scrollable areas.

### 8.4 4-column stats strip

[`projects-dashboard-client.tsx:519-540`](../components/projects/projects-dashboard-client.tsx):

```jsx
<div style={{
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 0,                                             /* dividers, not gap */
  marginTop: 22,
  padding: "16px 0",
  borderTop: "1px solid var(--border)",
  borderBottom: "1px solid var(--border)",
}}>
  {stats.map((s, i) => (
    <div key={i} style={{
      padding: "0 20px",
      borderRight: i < 3 ? "1px solid var(--border)" : "none",
    }}>
      <div className={"stat-num" + (s.peach ? " peach" : "")}>{s.val}</div>
      <div className="stat-label" style={{ marginTop: 6 }}>{s.label}</div>
      <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 4 }}>{s.hint}</div>
    </div>
  ))}
</div>
```

Convention: the **last** stat is the headline metric and gets `.stat-num.peach`.

---

## 9. Sidebar

### 9.1 Container

[`Sidebar.tsx:166-201`](../components/engram/Sidebar.tsx):
```jsx
<aside style={{
  width: collapsed ? 0 : 220,
  flex:  collapsed ? "0 0 0px" : "0 0 220px",
  height: "100%",
  background: "var(--bg-deep)",                       /* one step deeper than canvas */
  borderRight: collapsed ? "none" : "1px solid var(--border)",
  overflow: "hidden",
  display: "flex", flexDirection: "column",
  fontSize: 13,
  transition: "width 200ms ease, flex-basis 200ms ease",
}}>
  <div style={{ width: 220, flex: "0 0 auto", display: "flex", flexDirection: "column", height: "100%" }}>
    <SidebarBrand onToggle={onToggle} />
    <nav className="scroll" style={{ flex: 1, overflow: "auto", padding: "4px 10px 10px" }}>
      {/* nav items */}
    </nav>
  </div>
</aside>
```

The fixed-220 inner wrapper means the sidebar collapses by clipping rather
than re-flowing — text and icons fade out cleanly during the 200 ms width
animation.

### 9.2 Brand row (`<SidebarBrand>`)

[`Sidebar.tsx:114-133`](../components/engram/Sidebar.tsx):
```jsx
<div style={{ padding: "12px 10px 8px", display: "flex", alignItems: "center", gap: 8 }}>
  <Link href="/projects" style={{
    display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "2px 4px",
    textDecoration: "none", color: "inherit",
  }}>
    <HexLogo size={22} />
    <span style={{
      color: "var(--fg)", fontWeight: 600, fontSize: 14.5,
      letterSpacing: "-0.02em", fontFeatureSettings: '"cv01","ss03"',
    }}>Engram</span>
  </Link>
  <button type="button" className="btn btn-ghost btn-icon" aria-label="Toggle sidebar" onClick={onToggle}>
    <Icon name="sidebar" size={15} color="var(--fg-3)" />
  </button>
</div>
```

`<HexLogo>` is a peach-gradient hexagon SVG ([`Sidebar.tsx:15-32`](../components/engram/Sidebar.tsx))
with a `#1a0f0a` 60%-opacity inner stroke at 1.2 px. The wordmark uses
600-weight Inter (heavier than headings — this is the only place 600 is used
for non-button text).

### 9.3 Section header (`<SidebarSection>`)

[`Sidebar.tsx:41-63`](../components/engram/Sidebar.tsx):
```jsx
<button style={{
  display: "flex", alignItems: "center", gap: 4,
  padding: "14px 8px 6px",
  cursor: "pointer",
  color: "var(--fg-4)",
  fontSize: 11.5,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  userSelect: "none",
  background: "transparent", border: 0, width: "100%",
  textAlign: "left", fontFamily: "inherit",
}}>
  <span>{label}</span>
  <span style={{
    transform: `rotate(${open ? 0 : -90}deg)`,
    transition: "transform 180ms",
    display: "inline-flex",
  }}>
    <Icon name="chevronDown" size={12} color="var(--fg-4)" />
  </span>
</button>
```

The chevron rotates instead of swapping icons — cleaner animation. The 14 px
top padding isolates each section visually without needing a divider.

### 9.4 Nav item (`<SidebarNavItem>`)

Renders as `<Link href>` when `href` is provided, else a `<div role="link"
aria-disabled="true" tabIndex=0>` placeholder. See §7.5 for the `.nav-item`
class CSS.

```jsx
<Link className={"nav-item" + (active ? " active" : "")} aria-current={active ? "page" : undefined}>
  <span className="nav-icon"><Icon name={icon} size={15} /></span>
  <span style={{ flex: 1 }}>{label}</span>
  {count != null && (
    <span style={{ fontSize: 11, color: "var(--fg-4)", fontVariantNumeric: "tabular-nums" }}>
      {count}
    </span>
  )}
</Link>
```

Active matching ([`Sidebar.tsx:150-154`](../components/engram/Sidebar.tsx)):
```js
// /projects/new is "active" against href="/projects"
const isActive = (pathname: string, href?: string) =>
  !!href && (pathname === href || pathname.startsWith(href + "/"));
```

### 9.5 Collapse toggle when sidebar is hidden

[`Shell.tsx:27-37`](../components/engram/Shell.tsx):

When `collapsed={true}`, an absolutely-positioned reopen button is rendered
at the top-left of `<main>`:

```jsx
{collapsed && (
  <button
    type="button"
    className="btn btn-ghost btn-icon"
    aria-label="Open sidebar"
    onClick={toggle}
    style={{ position: "absolute", top: 9, left: 10, zIndex: 5 }}
  >
    <Icon name="sidebar" size={15} color="var(--fg-3)" />
  </button>
)}
```

`top: 9, left: 10` puts it visually centered with the page header content.
`z-index: 5` is enough to clear normal content but well below modal layers.

---

## 10. Form Patterns

All recipes from [`app/projects/new/page.tsx`](../app/projects/new/page.tsx).

### 10.1 Field label

```jsx
<label htmlFor="project-name" style={{
  display: "block",
  fontSize: 12.5,
  color: "var(--fg-2)",
  marginBottom: 6,
  fontWeight: 500,
}}>
  Project name
</label>
```

### 10.2 Helper text (below input)

```jsx
<div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 6 }}>
  Shown in the sidebar and on exported reports.
</div>
```

### 10.3 Locked / read-only field

When a field exists but is not editable (e.g. a single-tenant company picker):
```jsx
<div role="group" aria-labelledby="company-label" aria-disabled="true" style={{
  display: "flex", alignItems: "center", justifyContent: "space-between",
  height: 38,
  padding: "0 12px",
  background: "rgba(255,255,255,0.015)",       /* deeper than .input bg */
  border: "1px solid var(--border)",            /* weaker than .input border */
  borderRadius: 8,
  color: "var(--fg-2)",
  fontSize: 13.5,
  cursor: "not-allowed",
  userSelect: "none",
}}>
  <span>{value}</span>
  <Icon name="lock" size={13} color="var(--fg-4)" />
</div>
```
Three signals say "not editable": the lock icon, the not-allowed cursor, and
the visually flatter background+border.

### 10.4 Segmented year picker

[`app/projects/new/page.tsx:17-37`](../app/projects/new/page.tsx):

```jsx
<div role="radiogroup" aria-label="Reporting year" style={{ display: "flex", gap: 8 }}>
  {years.map((y) => {
    const selected = y === value;
    return (
      <button key={y}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => onChange(y)}
        className="btn"
        style={{
          flex: 1, height: 38,
          background:   selected ? "var(--primary-soft)"   : "rgba(255,255,255,0.02)",
          borderColor:  selected ? "var(--primary-line)"   : "var(--border-2)",
          color:        selected ? "var(--primary)"        : "var(--fg-2)",
        }}>
        {y}
      </button>
    );
  })}
</div>
```

This is the canonical "selected segment = peach-soft fill + peach border +
peach text" pattern. Reuse it for any toggle/segmented control where one of
N options is active.

### 10.5 Cream callout (the "warm moment")

[`app/projects/new/page.tsx:152-162`](../app/projects/new/page.tsx):

```jsx
<div style={{
  padding: 14,
  borderRadius: 8,
  background: "var(--cream-soft)",
  border: "1px solid oklch(0.95 0.04 85 / 0.14)",
  display: "flex", gap: 10,
}}>
  <Icon name="sparkles" size={15} color="var(--cream)" />
  <div style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.55 }}>
    <b style={{ color: "var(--cream)", fontWeight: 500 }}>Auto-setup:</b> we'll create default facility buckets…
  </div>
</div>
```

Cream is reserved for one purpose: positive informational callouts.
**Don't** use it for warning, error, or decorative.

### 10.6 Error alert (form-level)

```jsx
{error && (
  <div role="alert" style={{
    padding: "10px 12px",
    borderRadius: 8,
    background: "rgba(222,86,86,0.08)",
    border: "1px solid rgba(222,86,86,0.3)",
    color: "#E58971",                       /* salmon — same hue as primary-hover */
    fontSize: 12.5,
  }}>
    {error}
  </div>
)}
```

Note: this uses `#E58971` text rather than `--danger` because at small sizes
the saturated red from `--danger` reads as "system error", whereas the salmon
reads as "user input issue" — softer.

### 10.7 Form actions row

```jsx
<div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 28 }}>
  <button type="button" className="btn btn-ghost" disabled={submitting}>Cancel</button>
  <button type="submit"  className="btn btn-primary" disabled={submitting}>
    {submitting ? "Creating…" : "Create project"}
  </button>
</div>
```

Conventions:
- Right-aligned (`justify-content: flex-end`)
- Cancel is `btn-ghost`, primary is `btn-primary` — never two `btn-primary`
- Disable both during submit; primary's text changes to `Verbing…` (`Creating…`,
  `Deleting…`). No spinner — text change is the only signal.

### 10.8 Form card with cream gradient (optional accent)

[`app/projects/new/page.tsx:85-90`](../app/projects/new/page.tsx):

```jsx
<form className="card" style={{
  padding: 36,
  position: "relative",
  background: "linear-gradient(180deg, rgba(248,238,210,0.035) 0%, rgba(255,255,255,0.01) 100%)",
  border: "1px solid var(--border)",
}}>
  <button type="button" className="btn btn-ghost btn-icon"
          aria-label="Close"
          style={{ position: "absolute", top: 14, right: 14 }}>
    <Icon name="x" size={14} color="var(--fg-3)" />
  </button>
  {/* form contents */}
</form>
```

The gradient layers a 3.5% cream wash at the top fading to a 1% white wash —
just barely visible, but adds warmth to "create" / "onboarding" surfaces.
The close button is absolutely-positioned at top-right so it doesn't interfere
with the form heading.

---

## 11. Status & Indicator Components

### 11.1 `StatusPill` (5-status pill with animated dot)

[`components/projects/v6-status-pill.tsx`](../components/projects/v6-status-pill.tsx):

Tones (`V6_STATUS_TONES`):

| Status | Color | Soft (background) | Line (border) | Animated dot? |
|---|---|---|---|---|
| `uploading`  | `#6FA4C9` (info blue) | `rgba(111,164,201,0.14)` | `rgba(111,164,201,0.35)` | ✓ |
| `uploaded`   | `var(--fg-2)` (neutral) | `rgba(255,255,255,0.05)` | `var(--border-2)` | — |
| `processing` | `#DE7356` (peach) | `rgba(222,115,86,0.14)` | `rgba(222,115,86,0.35)` | ✓ |
| `processed`  | `oklch(0.72 0.14 155)` (success green) | `oklch(0.72 0.14 155 / 0.14)` | `oklch(0.72 0.14 155 / 0.35)` | — |
| `error`      | `oklch(0.65 0.22 25)` (danger red) | `oklch(0.65 0.22 25 / 0.14)` | `oklch(0.65 0.22 25 / 0.35)` | — |

Recipe ([`v6-status-pill.tsx:62-92`](../components/projects/v6-status-pill.tsx)):
```jsx
<span style={{
  display: "inline-flex", alignItems: "center", gap: 6,
  height:  small ? 20 : 22,
  padding: small ? "0 7px" : "0 9px",
  borderRadius: 9999,
  fontSize: small ? 10.5 : 11.5,
  fontWeight: 500,
  border: `1px solid ${tone.line}`,
  background: tone.soft,
  color: tone.color,
  whiteSpace: "nowrap",
}}>
  <span style={{
    width: 6, height: 6,
    borderRadius: "50%",
    background: tone.color,
    animation: animate ? "wv-pulse 1.4s ease-in-out infinite" : undefined,
  }} />
  {tone.label}
</span>
```

`small` variant is for documents-table rows; default for cards/list rows.

**Note:** `projects-dashboard-client.tsx` defines a *separate* `StatusPill`
(no border, just a colored dot + label, [`projects-dashboard-client.tsx:43-51`](../components/projects/projects-dashboard-client.tsx))
keyed on a different `ProjStatus` enum (`empty | uploaded | processing |
processed`). Different aggregation level: that one is for the project as a
whole; the v6 one is per-document. Don't conflate them.

### 11.2 `CompletionRing` (18×18 SVG)

[`projects-dashboard-client.tsx:54-66`](../components/projects/projects-dashboard-client.tsx):

```jsx
<svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
  <circle cx={9} cy={9} r={7} stroke="var(--border-2)" strokeWidth={2} fill="none" />
  <circle cx={9} cy={9} r={7} stroke="#DE7356" strokeWidth={2} fill="none"
          strokeDasharray={2 * Math.PI * 7}
          strokeDashoffset={2 * Math.PI * 7 * (1 - pct / 100)}
          transform="rotate(-90 9 9)"
          strokeLinecap="round" />
</svg>
```

Always peach. The `rotate(-90 9 9)` starts the progress at 12 o'clock.
`strokeLinecap: "round"` softens the head/tail — important at this size.

### 11.3 `Sparkline` (12-bar SVG mini chart)

[`Primitives.tsx:132-143`](../components/engram/Primitives.tsx):

```jsx
<svg width={width} height={height} style={{ display: "block" }}>
  {data.map((v, i) => {
    const max = Math.max(...data, 1);
    const barW = width / data.length - 2;
    const h = Math.max(2, (v / max) * height);
    return <rect key={i}
      x={i * (barW + 2)}
      y={height - h}
      width={barW}
      height={h}
      rx={1}
      fill={color}
      opacity={0.55 + 0.45 * (v / max)} />;
  })}
</svg>
```

Defaults: `width=120`, `height=28`, `color="#DE7356"`. Bars use opacity `0.55
+ 0.45 * (v / max)` so taller bars are more vivid — gives the chart a sense
of focus without two colors. Used on project cards (`width=120, height=30`).

### 11.4 `Progress` bar (4 px slim rail)

[`v6-progress.tsx:5-36`](../components/projects/v6-progress.tsx):

```jsx
<div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
     style={{
       width: "100%",
       height: 4,
       background: "rgba(255,255,255,0.06)",
       borderRadius: 4,
       overflow: "hidden",
     }}>
  <div style={{
    width: `${pct}%`,
    height: "100%",
    background: "var(--primary)",
    borderRadius: 4,
    transition: "width 200ms ease-out",
  }}/>
</div>
```

`200ms ease-out` is the canonical duration for any width-tweening (progress,
animated counts).

### 11.5 `StatusFilterButtons` (segmented filter rail with counts)

[`v6-status-filter.tsx:25-90`](../components/projects/v6-status-filter.tsx):

```jsx
<div role="tablist" aria-label="Filter by status" style={{
  display: "inline-flex", alignItems: "center",
  padding: 3, gap: 2,
  background: "rgba(255,255,255,0.025)",
  border: "1px solid var(--border)",
  borderRadius: 8,
}}>
  {tabs.map((t) => {
    const active = filter === t.id;
    return (
      <button role="tab" aria-selected={active}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          height: 28, padding: "0 10px",
          border: 0, borderRadius: 6,
          background: active ? "rgba(255,255,255,0.08)" : "transparent",
          color:      active ? "var(--fg)"               : "var(--fg-3)",
          fontSize: 12, fontWeight: 510,
          fontFamily: "inherit", cursor: "pointer",
          transition: "background 150ms ease-out, color 150ms ease-out",
        }}>
        <Icon name={t.icon} size={13} color={active ? t.color : "currentColor"} />
        <span className="mono" style={{ fontSize: 11, color: active ? "var(--fg-2)" : "var(--fg-4)" }}>
          {count}
        </span>
      </button>
    );
  })}
</div>
```

This is the **inverse** of the simpler tab pattern in the dashboard — it has
a wrapping pill container with its own border/bg, so the active tab reads as
"deeper into the surface" rather than "lifted off the surface". Use this when
the filter rail needs to feel like a unit; use the dashboard pattern when
tabs are part of a larger toolbar.

### 11.6 `Pager` (compact pagination)

[`v6-pager.tsx`](../components/projects/v6-pager.tsx):

26 × 26 buttons, `--r-sm` (6 px), `rgba(255,255,255,0.06)` for active page,
`rgba(255,255,255,0.04)` for inactive on hover. Hidden when `total <= 1`.
Uses `chevronLeft` / `chevronRight` icons (size 13) for prev/next.

---

## 12. Animations & Transitions

### 12.1 Standard timings

| Duration | Easing | Used for |
|---|---|---|
| 150 ms | `ease-out` | Nav-item bg/color, status filter tab, pager button, checkbox opacity (selection reveal) |
| 180 ms | `ease-out` | `.btn` bg/border/color, card border/bg, input border/box-shadow, sidebar section chevron rotate, bulk action bar `bar-rise` |
| 200 ms | `ease-out` (or just `ease`) | Sidebar collapse width (`200ms ease`), Progress bar width |
| 260 ms | `ease-out` | Drop zone border/bg (slower because the change is bigger) |
| 160 ms | `ease-out` | Full-screen drop overlay opacity (`drop-overlay-in`) |
| 1.4 s  | `ease-in-out infinite` | `wv-pulse` status dot |

**Convention:** never use anything other than `ease-out` for state changes —
`ease-in` is reserved for elements leaving the viewport (rare in this app).

### 12.2 Keyframes

**`wv-pulse`** ([`tokens.css:228-231`](../components/engram/tokens.css)):
```css
@keyframes wv-pulse {
  0%, 100% { opacity: 1;    transform: scale(1); }
  50%      { opacity: 0.55; transform: scale(1.3); }
}
```
Used by status dots in `uploading` and `processing` states.

**`drop-overlay-in`** ([`project-detail-client.tsx:961-966`](../components/projects/project-detail-client.tsx)):
```css
@keyframes drop-overlay-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```
Used by the full-screen drag overlay. 160 ms ease-out.

**`bar-rise`** ([`projects-dashboard-client.tsx:328-333`](../components/projects/projects-dashboard-client.tsx)):
```css
@keyframes bar-rise {
  from { opacity: 0; transform: translate(-50%, 8px); }
  to   { opacity: 1; transform: translate(-50%, 0);   }
}
```
Used by the bulk action bar appearing at the bottom. 180 ms ease-out. Note
the `-50%` X — the bar is centered via `left: 50%; transform: translateX(-50%)`,
so the keyframe must preserve the X translation while animating Y.

### 12.3 Inline style-tag pattern

Both `drop-overlay-in` and `bar-rise` are declared inside their component's
JSX via `<style>{...}</style>`. This avoids polluting global CSS with
component-specific keyframes, but means each component is self-contained.
If a new component needs a one-off keyframe, follow this pattern rather than
adding to `tokens.css`.

---

## 13. Page-Specific Recipes

### 13.1 `/projects` (dashboard)

[`components/projects/projects-dashboard-client.tsx`](../components/projects/projects-dashboard-client.tsx)

**Structure:**
```
<Shell>
  <PageHeader crumbs={["Projects"]} actions={...} />
  <div className="scroll" style={{ flex: 1, overflow: "auto" }}>
    <div padding="28px 20px 18px">
      <h1 className="serif" fontSize={30}>Projects</h1>
      <subtitle ...>
      <stats-strip 4-col />
    </div>
    <div padding="0 20px" controls-row>
      <status-tabs />
      <flex-spacer />
      <view-mode-pill />
    </div>
    {view === "list" ? <ProjectsList /> : <ProjectsCards />}
  </div>
  {anySelected && <BulkActionBar />}
  <BulkDeleteDialog />
</Shell>
```

**Page-header actions:** filter / sort / layers icon-buttons → 1×18 divider →
`+ New project` (`btn-primary btn-sm`).

**Title:** `<h1 className="serif" style={{ fontSize: 30, marginBottom: 6 }}>`,
subtitle in `var(--fg-3) 13.5px max-width 560px`.

**Stats strip:** see §8.4. The 4 stats today are: Total projects · Documents
processed · Records processed · Total tCO₂e tracked (peach).

**Status tabs (per-status filter):**
```jsx
<button role="tab" aria-selected={active}
  className="btn btn-ghost btn-sm"
  style={{
    height: 28, padding: "0 10px",
    background: active ? "rgba(255,255,255,0.06)" : "transparent",
    color:      active ? "var(--fg)"              : "var(--fg-3)",
  }}>
  {label} <span style={{ marginLeft: 4, color: "var(--fg-4)", fontSize: 11.5 }}>{count}</span>
</button>
```

**View-mode pill (List / Cards):**
```jsx
<div style={{
  display: "flex", padding: 2,
  background: "rgba(255,255,255,0.03)",
  borderRadius: 7,
  border: "1px solid var(--border)",
}}>
  {/* Each toggle: */}
  <button className="btn btn-ghost btn-sm"
    aria-pressed={current === "list"}
    style={{
      border: "none", height: 26, padding: "0 10px",
      background: current === "list" ? "rgba(255,255,255,0.08)" : "transparent",
      color:      current === "list" ? "var(--fg)"              : "var(--fg-3)",
    }}>
    <Icon name="list" size={14} /> List
  </button>
</div>
```

**Project list row** ([`projects-dashboard-client.tsx:107-177`](../components/projects/projects-dashboard-client.tsx)):
- Columns: Name (auto) · Status (160) · Last updated (140) · Emission year
  (140) · Completion (120). `tableLayout: "fixed"` + `<colgroup>`.
- Header: 11.5 px uppercase 0.06em `var(--fg-4)`, padding 10px 12px.
- Body: 13.5 px, padding 11px 12px.
- Hover row bg: `rgba(255,255,255,0.02)`.
- Selected row bg: `rgba(222,115,86,0.08)`.
- Checkbox is `opacity: 0` until row is hovered, any row is selected, or
  this row is selected → `opacity: 1`, `transition: opacity 150ms`. This
  keeps the row clean by default but reveals the affordance on intent.

**Project card** ([`projects-dashboard-client.tsx:202-274`](../components/projects/projects-dashboard-client.tsx)):
- 3-column grid, `gap: 16px`, padding `8px 20px 32px`.
- Card: `padding: 16px; min-height: 180px; flex column gap 12px`.
- Border/bg: same neutral default + peach tint on hover/selected (see §4.4).
- Layout: top row (checkbox + project name + company·year + more icon) →
  middle row (peach 24 px stat + sparkline 120×30 right-aligned) → footer
  row (StatusPill + "{n} docs · {updated}" right-aligned in `--fg-4 11.5`).
- Project name: 15 px, weight 510, letter-spacing -0.01em, ellipsis on overflow.

**Bulk action bar** ([`projects-dashboard-client.tsx:286-335`](../components/projects/projects-dashboard-client.tsx)):
- Fixed: `left: 50%; bottom: 24px; transform: translateX(-50%)`, z=50.
- Pill: padding `8px 8px 8px 16px`, border-radius 999, box-shadow `0 12px 32px
  rgba(0,0,0,0.45)`, bg `var(--bg-2)`.
- Contents: "{N} selected" → 1×18 divider → `Clear` (ghost-sm) → destructive
  delete button (see §7.1 destructive override).
- Animates in via `bar-rise` (180 ms).

**Bulk delete dialog** ([`projects-dashboard-client.tsx:337-390`](../components/projects/projects-dashboard-client.tsx)):
- Uses shadcn `AlertDialog` family (Tailwind classes — outside `.lc` rules).
- The "list of project names" inside the dialog uses an inline-styled `<ul>`
  with `max-height: 240px; overflow-y: auto; bg rgba(255,255,255,0.02);
  border var(--border); border-radius: 6; font-size: 13;`.

### 13.2 `/projects/new` (create form)

[`app/projects/new/page.tsx`](../app/projects/new/page.tsx)

**Structure:**
```
<Shell>
  <PageHeader crumbs={["Projects", "New"]} />
  <div className="scroll" flex justify-center padding="40px 20px">
    <form className="card" width=560 padding=36 cream-gradient>
      <close-x btn-ghost-icon absolute top-14 right-14 />
      <h1 className="serif" fontSize=28>New project</h1>
      <subtitle 13.5 var(--fg-3) margin-bottom=28>...</subtitle>
      <field-stack gap=18>
        <field name="Project name" + .input + helper />
        <field name="Company" + locked-display + helper />
        <field name="Reporting year" + YearPicker />
        <cream-callout />
        {error && <error-alert />}
      </field-stack>
      <actions justify-end gap=8 margin-top=28>
        <btn-ghost>Cancel</btn-ghost>
        <btn-primary>Create project</btn-primary>
      </actions>
    </form>
  </div>
</Shell>
```

All recipes from §10. Notable: this page is the **only place that uses the
cream gradient on a card**, and the only place the cream callout appears.

### 13.3 `/projects/[id]` (project detail / upload)

[`components/projects/project-detail-client.tsx`](../components/projects/project-detail-client.tsx)

**Structure:**
```
<Shell>
  <PageHeader crumbs={[<Link className="crumb-link">Projects</Link>, project.name]}
              actions={mono-metadata · divider · ProjectDeleteButton} />
  <main flex-column overflow-hidden>
    <div grid="360px 1fr" gap=16 padding="16 20 0">
      <DropZone width=360 />
      <div flex-column gap=12 min-height=0>
        <div flex gap=12>
          <h3 className="serif" fontSize=16>Documents</h3>
          <flex-spacer />
          <StatusFilterButtons />
        </div>
        <div className="card" flex=1 overflow-hidden flex-column>
          <DocumentsTable scroll />
        </div>
        <pager-row flex justify-between padding="10px 4px">
          <span className="mono" 11 var(--fg-4)>1–10 of 42</span>
          <Pager />
        </pager-row>
      </div>
    </div>
    <footer flex gap=16 padding="12px 20px"
            border-top="1px solid var(--border)"
            background="rgba(0,0,0,0.2)">
      <progress-panel max-width=460 min-width=280>
        Processing  <peach>{done}</peach><fg-4> / {total}</fg-4> documents  ·  ETA
        <Progress pct=... />
      </progress-panel>
      <flex-spacer />
      <btn>View Graph (icon graph)</btn>
      <btn-primary btn-lg>Process N file(s) (icon play)</btn-primary>
    </footer>
  </main>
  {isDragging && <FullScreenDropOverlay />}
  {conflictDialog && <UploadConflictDialog />}
</Shell>
```

**Drop zone** ([`project-detail-client.tsx:988-1092`](../components/projects/project-detail-client.tsx)):
- 360 × 100% column.
- Padding 24, `border-radius: 12, border: 1.5px dashed`. Border is
  `var(--border-3)` idle, `var(--primary-line)` when hovered or system is
  dragging.
- Background: idle = `linear-gradient(180deg, rgba(222,115,86,0.06),
  rgba(222,115,86,0.01))`, active = `rgba(180,88,64,0.16)`.
- Decorative SVG (3 stacked file rectangles) absolute top-right, 84×84,
  opacity 0.12, stroke `var(--primary)` width 1.5.
- Center: 54×54 icon tile (radius 14) with `var(--primary-soft)` bg + 1 px
  `var(--primary-line)` border, peach upload icon size 24 → `<h3
  className="serif" fontSize=17>` → 12 px `--fg-3` description (max-width
  240, line-height 1.45) → `Browse files` "fake button" (`btn-sm`,
  pointer-events none).
- Transition: `border-color 260ms ease-out, background 260ms ease-out`
  (slower than other components — the change is bigger).

**Documents table** ([`project-detail-client.tsx:1115-1165`](../components/projects/project-detail-client.tsx)):
- Lives inside a `.card` container that flex-grows; the inner `<div
  className="scroll" overflow="auto">` holds the table for vertical scroll.
- Columns: File (auto) · Status (118) · Size (84) · Uploaded (96) · Actions
  (44).
- Header: `fontSize: 12, fontWeight: 500, color: var(--fg-3),
  letterSpacing: 0.02em, padding: 8px 12px, borderBottom: 1px var(--border)`.
- Body: `padding: 12, fontSize: 13.5, color: var(--fg-2)`.
- Row hover: `rgba(255,255,255,0.015)` bg (lighter than list view).
- Last row: no border-bottom.
- File-cell layout: 20 px circle icon (`--border-2` border, `rgba(255,255,255,0.04)`
  bg, `--fg-3` icon color) + filename in `--fg, weight 500, ellipsis`. If the
  source type is known, render a `<Glyph>` instead of the generic file icon.
- Size cell: monospace 11.5 px in `--fg-3` (`fontFamily: var(--font-mono)`).
- Uploaded cell: 12 px, `--fg-3`.
- Actions cell: `btn-ghost btn-icon`, opacity 0.3 / cursor not-allowed when
  row has no `storagePath`.

**Processing footer:**
- 12 × 20 padding, `border-top: 1px solid var(--border)`, `background:
  rgba(0,0,0,0.2)` — the only place a "deeper" surface is layered on top
  of the canvas.
- Left: progress panel with peach `{done} / {total}` count + 4 px Progress.
- Right: `View Graph` (`.btn`) + `Process N file(s)` (`.btn-primary.btn-lg`).

**Full-screen drop overlay** ([`project-detail-client.tsx:890-968`](../components/projects/project-detail-client.tsx)):
- `position: fixed; inset: 0; z=9999; pointer-events: none`.
- Background: `rgba(20,16,14,0.62)` + `backdrop-filter: blur(10px)`.
- Inner border: `inset: 32; border: 3px dashed rgba(222,115,86,0.65);
  border-radius: 20; background: rgba(180,88,64,0.08)`.
- Center: 88 × 88 icon tile (radius 22) with `--primary-soft` bg, peach
  `Icon name="upload" size=40`, `box-shadow: 0 12px 32px rgba(0,0,0,0.35)`.
- `<h2 className="serif" fontSize=30>Drop documents anywhere</h2>` → 14 px
  `--fg-3` description (max-width 380, line-height 1.5).
- Animates in via `drop-overlay-in` (160 ms).

---

## 14. Iconography

### 14.1 `<Icon>` component

[`Primitives.tsx:21-89`](../components/engram/Primitives.tsx).

- Stroke-width: **1.75** (always — never override).
- ViewBox: 24 × 24.
- Default size: 16 px. UI conventions:
  - 12 px: chevrons (breadcrumb separators, `play` in primary footer
    button), helper-text icons.
  - 13 px: pill icons, table action icons, status filter tab icons, footer
    button icons.
  - 14 px: `+` in dashboard "+ New project", grid/list view toggle icons,
    close button (`x`).
  - 15 px: page-header action icons, sidebar nav-item icons (`size={15}`),
    sidebar brand toggle, inline metadata icons in form fields.
  - 24 px: drop-zone center icon.
  - 40 px: full-screen drop overlay center icon.
- Default color: `currentColor` — pass `color` prop to override.

Available names (~50): `search, plus, chevronDown, chevronRight, chevronLeft,
more, filter, sort, layers, inbox, user, folder, grid, list, settings, help,
upload, file, fileText, download, check, x, trash, alert, clock, play,
pause, zoom, zoomOut, graph, sparkles, arrowLeft, arrowRight, flame, zap,
snowflake, factory, bus, workers, globe, pdf, csv, xlsx, cycle, sidebar,
eye, edit, leaf, chart, database, copy, lock`.

### 14.2 Color conventions

| Default icon color | Use |
|---|---|
| `var(--fg-2)` | Inside neutral `.btn` (e.g. "View Graph") |
| `var(--fg-3)` | Page-header icon buttons (filter, sort, layers, more, edit), sidebar toggle, row action icon |
| `var(--fg-4)` | Helper text icons (lock in locked field), breadcrumb separator chevrons |
| `var(--primary)` | Active sidebar nav icon, drop-zone upload icon |
| `var(--primary-ink)` | Icon inside `.btn-primary` (so it reads against peach) |
| `var(--cream)` | Sparkles in cream callout |

Active state is signaled by **icon color change to peach**, not by background.

### 14.3 `<Glyph>` component

[`Primitives.tsx:99-122`](../components/engram/Primitives.tsx).

A round colored badge that pairs an icon with a category color. Sizes default
to 22 px; in the documents table they're rendered at 20 px.

| Kind | Icon | Color |
|---|---|---|
| `fuel` | `flame` | `#E9B84E` (gold) |
| `electricity` | `zap` | `#6FA4C9` (info blue) |
| `refrigerant` | `snowflake` | `#9FC5E8` (lighter blue) |
| `workers` | `workers` | `#C6A882` (warm tan) |
| `mobile` | `bus` | `#DE7356` (peach) |
| `fugitive` | `snowflake` | `#9FC5E8` |
| `purchased` | `zap` | `#6FA4C9` |
| `process` | `factory` | `#C8876A` (rust) |

Background is `color-mix(in oklab, {color} 14%, transparent)`; border is the
same color at 30%; icon stroke is the full color. Reuse this exact recipe
when adding a new category — it auto-tones for any base hue.

---

## 15. Accessibility Patterns

### 15.1 Focus

- All focusable elements receive the peach focus ring via `:focus-visible`
  (see §7.11). Don't add a custom `outline` — it'll fight the box-shadow.
- Disabled controls: `opacity: 0.5; cursor: not-allowed; pointer-events:
  none` (or just `disabled` attribute on `<button>` / `<input>`).

### 15.2 ARIA conventions in shipped code

| Element | Pattern |
|---|---|
| Sidebar nav `<Link>` | `aria-current="page"` when active |
| Status filter tabs | container `role="tablist" aria-label="Filter by status"`, each `role="tab" aria-selected={active}` |
| View-mode toggles | `aria-pressed={current === id}` |
| Year picker | container `role="radiogroup" aria-label="Reporting year"`, each `role="radio" aria-checked={selected}` |
| Project list rows | `aria-selected={isSelected}` on `<tr>` |
| Locked field | `role="group" aria-labelledby="…" aria-disabled="true"` |
| Drop zone | `role="button" tabIndex={0} aria-label="Upload files"` + Enter/Space key handler |
| Drag overlay | `aria-hidden` (decorative) |
| Bulk action bar | `role="region" aria-label="Bulk selection actions"` |
| Progress | `role="progressbar" aria-valuenow aria-valuemin aria-valuemax` |
| Page in dialog | shadcn AlertDialog already wires labelledby/describedby |

### 15.3 Selection-reveal pattern (checkbox)

Hidden until intent is shown, then transitions in over 150 ms:
```js
style={{
  opacity: showCheckbox ? 1 : 0,
  transition: "opacity 150ms",
  cursor: "pointer",
  flexShrink: 0,
}}
```
Where `showCheckbox = isSelected || anySelected || isHover`. The third
condition is critical — once any row in the list is selected, *all*
checkboxes reveal so the user can extend the selection.

---

## 16. Do's and Don'ts

**Do:**
- Wrap every page in `<Shell>` so `.lc` and the Engram tokens apply.
- Use CSS variables (`var(--primary)`, `var(--fg-3)`, etc.) — never hardcode
  hex except for known one-offs (`#DE7356`, `#6FA4C9`).
- Use `.btn` / `.btn-primary` / `.btn-ghost` for every button. Don't roll
  custom styles.
- Use `.serif` (not `<h1>` defaults) when you want display weight on
  arbitrary elements.
- Use `var(--font-mono)` (or `className="mono"`) for any monospace usage —
  IDs, sizes, hashes, timestamps, count badges.
- Pair `font-variant-numeric: tabular-nums` with mono in any column-aligned
  numeric context.
- Use `min-height: 0` on every flex/grid child whose contents need to
  scroll. Otherwise `overflow: auto` is silently a no-op.
- Use `ease-out` for state transitions, 150–200 ms.
- Add the peach focus ring everywhere (it's free via `:focus-visible`); only
  override if you have a real reason.

**Don't:**
- Don't use pure black or pure white. Canvas is `oklch(0.145 0.004 60)`
  (warm dark), foreground is `oklch(0.985 0.003 60)` (warm white).
- Don't add a theme toggle — there is no light mode.
- Don't introduce a second saturated brand color. Peach is the brand;
  status uses muted blue/gold/green/red; cream is the one warm callout.
- Don't use `--cream` for warning/error/decorative — it's reserved for
  positive informational callouts only.
- Don't import from `components/ui/*` unless that file is already used
  elsewhere — the v0 scaffold left 50+ unused files.
- Don't mix Tailwind radii (`rounded-lg`) with Engram radii
  (`var(--r-lg)`) on the same element — pick one. Inside `.lc`, prefer Engram.
- Don't add drop shadows for elevation — use the 1.5% white card overlay +
  subtle border instead. The bulk action bar's `0 12px 32px rgba(0,0,0,0.45)`
  is the rare exception (it's floating, so it needs the shadow).
- Don't add new global CSS keyframes; declare component-specific keyframes
  inline via `<style>{...}</style>` (see `bar-rise`, `drop-overlay-in`).
- Don't change `font-feature-settings`. The global `"cv01", "ss03", "ss01"`
  + the heading-only `"cv01", "ss03"` are intentionally curated for Inter.
- Don't use `font-weight: 500` for headings — it's `510` (Inter variable
  axis).
- Don't use `outline:` for focus — use `box-shadow: var(--ring-focus)`.

---

## 17. Quick Reference Tables

### 17.1 All color tokens

| Token | Value | One-line use |
|---|---|---|
| `--bg`            | `oklch(0.145 0.004 60)` | Page canvas |
| `--bg-deep`       | `oklch(0.115 0.004 60)` | Sidebar background |
| `--surface`       | `oklch(0.19 0.005 60)`  | (rarely used directly) |
| `--surface-2`     | `oklch(0.23 0.008 60)`  | Hover/popover |
| `--surface-3`     | `oklch(0.28 0.010 60)`  | Active row highlight |
| `--fg`            | `oklch(0.985 0.003 60)` | Headings, primary text |
| `--fg-2`          | `oklch(0.86 0.004 60)`  | Body, table cells |
| `--fg-3`          | `oklch(0.66 0.006 60)`  | Muted, helper |
| `--fg-4`          | `oklch(0.48 0.006 60)`  | Placeholder, timestamp |
| `--border`        | `oklch(1 0 0 / 0.07)`   | Dividers, card edges |
| `--border-2`      | `oklch(1 0 0 / 0.11)`   | Inputs, default buttons |
| `--border-3`      | `oklch(1 0 0 / 0.16)`   | Button hover, drop-zone idle |
| `--primary`       | `#DE7356`               | Primary CTA, focus, brand |
| `--primary-hover` | `#E58971`               | `.btn-primary:hover` |
| `--primary-ink`   | `#1a0f0a`               | Text on `--primary` |
| `--primary-soft`  | `oklch(0.70 0.14 45 / 0.15)` | Selected/active fill |
| `--primary-line`  | `oklch(0.70 0.14 45 / 0.35)` | Focus border / ring color |
| `--cream`         | `#F8EED2`               | Callout label, sparkles icon |
| `--cream-soft`    | `oklch(0.95 0.04 85 / 0.08)` | Callout background |
| `--scope-1`       | `#DE7356`               | Scope-1 series (graph) |
| `--scope-2`       | `#6FA4C9`               | Scope-2 series (graph) |
| `--success`       | `oklch(0.72 0.14 155)`  | Processed status |
| `--success-soft`  | `oklch(0.72 0.14 155 / 0.14)` | Success pill bg |
| `--warn`          | `#E9B84E`               | Processing (legacy), partial |
| `--warn-soft`     | `oklch(0.80 0.13 85 / 0.14)` | Warn pill bg |
| `--danger`        | `oklch(0.65 0.22 25)`   | Error pill |
| `--danger-soft`   | `oklch(0.65 0.22 25 / 0.14)` | Danger pill bg |
| `--info`          | `#6FA4C9`               | Uploaded, scope-2 |
| `--info-soft`     | `oklch(0.70 0.07 240 / 0.15)` | |

### 17.2 Heights cheat sheet

| Element | Height (px) |
|---|---|
| Page header | 44 |
| Sidebar (expanded) | 220 wide |
| Nav item | 28 |
| Button (default) | 32 |
| Button (sm) | 26 |
| Button (lg) | 38 |
| Button (icon) | 28 (square) |
| Input / select | 36 |
| Read-only / year picker / form field height | 38 |
| Status pill | 22 (default) / 20 (small) |
| Status filter tab | 28 |
| Pager button | 26 (square) |
| Progress bar | 4 |
| Completion ring | 18 (square) |
| Glyph (default) | 22 |
| Documents-table file icon | 20 (round) |
| Drop-zone center icon tile | 54 (square) |
| Full-screen overlay icon tile | 88 (square) |

### 17.3 Tailwind class → meaning

These are the few Tailwind classes that *do* appear in the shipped UI
(mostly in shadcn primitives and a couple of holdouts):

| Class | Resolves to |
|---|---|
| `bg-background` | `var(--background)` (Tailwind, NOT `--bg`) |
| `text-foreground` | `var(--foreground)` |
| `bg-card` | `var(--card)` |
| `text-muted-foreground` | `var(--muted-foreground)` |
| `bg-destructive` | `var(--destructive)` |
| `text-destructive-foreground` | `var(--destructive-foreground)` |
| `border` (utility) | `var(--border)` (Tailwind, NOT `--border` from tokens.css — different value!) |
| `rounded-lg` | `0.625rem` (10 px) — NOT 12 px |
| `font-sans` | `var(--font-sans)` from `@theme inline` (Geist) |
| `hover:underline` | underline on hover (used on project name links) |
| `animate-spin` | spinner keyframes (used on `Loader2` in delete dialog) |

**Watch out:** `var(--border)` resolves to *different* values inside vs
outside `.lc` because both stylesheets define `--border` at `:root` and
`.dark`. Inside `.lc`, the Engram tokens.css value wins (`oklch(1 0 0 / 0.07)`);
outside, the globals.css value wins (`oklch(0.269 0 0)` in dark mode). When
in doubt, just use the Engram token names (`--border`, `--border-2`, etc.)
inside `.lc` since they are predictable.

---

## 18. Appendix: Applying this to `/projects/[id]/graph`

The route exists at [`app/projects/[id]/graph/page.tsx`](../app/projects/[id]/graph/page.tsx)
and renders `<GraphViewClient>` which wraps the legacy `<GHGGraph>`
([`components/ghg-graph.tsx`](../components/ghg-graph.tsx)). The graph view
inherits `app/projects/layout.tsx`, so Inter + `tokens.css` are already
loaded — but `<GHGGraph>` does **not** wrap in `<Shell>` and does not use
the Engram tokens, so none of the above recipes apply yet.

**To bring the graph view in line:**

1. **Wrap in `<Shell>`** so the `.lc` scope applies. Keep the no-graph
   fallback ([`page.tsx:30-48`](../app/projects/[id]/graph/page.tsx))
   inside `<Shell>` too — currently it uses Tailwind `container mx-auto` +
   `rounded-lg` + `bg-card`, all of which look out of place vs the rest of
   the app.

2. **Add a `<PageHeader>`** with crumbs:
   ```jsx
   crumbs={[
     <Link className="crumb-link" href="/projects">Projects</Link>,
     <Link className="crumb-link" href={`/projects/${id}`}>{project.name}</Link>,
     "Graph",
   ]}
   actions={/* topology mode toggle, year selector, theme picker, etc. */}
   ```

3. **Use `<Shell rightRail={...}>`** to pin the analytics panel as a
   right-side panel. Style the panel container as `.card` with the same
   `rgba(255,255,255,0.015)` bg + `var(--border)` recipe — currently it's a
   480-px aside without a border-radius.

4. **Filter rail** (search · scope · source-type · emission-type) should
   use the §11.5 `StatusFilterButtons` pattern (or the simpler dashboard
   tab pattern in §13.1 if it lives in the page header). Replace any custom
   pill/chip styling with `.pill` variants where applicable.

5. **All buttons** in the graph view (recenter, zoom, expand topology,
   reset filters) must use `.btn` / `.btn-ghost` / `.btn-primary` — replace
   any `<button className="text-sm px-3 py-1 …">` ad-hoc styles.

6. **Force-graph node colors:** prefer
   - Company / facility nodes: `var(--fg-2)` or `var(--fg)` for stroke,
     neutral fill from `--surface-*`.
   - Emission-source nodes: pick from the §14.3 `Glyph` color palette, by
     `emission_type`. The peach `--primary` is reserved for `mobile_combustion`
     (matches the `Glyph kind="mobile"` color); other types use their Glyph
     color so the canvas reads consistently with the documents-table glyphs.
   - Selected node: `--primary-soft` fill + `--primary-line` stroke (matches
     dashboard selection convention).
   - Scope coloring (when used): `--scope-1` and `--scope-2`.

7. **Hover/selection of canvas nodes:** mirror the list/card selection
   convention — peach-tinted background (`rgba(222,115,86,0.06–0.08)`) with
   `var(--primary-line)` border.

8. **Sticky stats strip** above the canvas: use the §8.4 4-column pattern.
   The candidates are: company total tCO₂e (peach) · scope-1 · scope-2 ·
   facility/source counts.

9. **Empty / no-graph state:** instead of the current Tailwind card, render
   inside `<Shell>` with a `.card` containing a `.serif` heading and
   `--fg-3` body text — same recipe as the `/projects/new` form card, but
   without the cream gradient.

10. **No new tokens, no new global CSS.** The graph view should only need
    *composition* of existing recipes. If you find yourself wanting a new
    color or radius, raise it as a tokens-addition discussion before adding.

This appendix is pointers, not a build plan — the actual graph view styling
work is a separate task.
