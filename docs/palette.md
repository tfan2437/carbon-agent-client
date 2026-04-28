# Color palette

Categorical hues for charts, scope encoding, and chip badges. Each hue
ships with two transparency variants — `*-soft` (15%) for chip
backgrounds and `*-line` (40%) for chip borders / thin dividers on the
same hue.

All values verified against the `#131211` page background for WCAG AA
contrast (small-text 4.5:1 unless noted).

## Solids

| Hue | Hex | Soft (15%) | Line (40%) | Role |
|---|---|---|---|---|
| **Peach** | `#DE7356` | `rgba(222, 115, 86, 0.15)` | `rgba(222, 115, 86, 0.40)` | Brand primary — active button fills, total-emissions hero, focus rings, logo |
| **Amber** | `#E0A23F` | `rgba(224, 162, 63, 0.15)` | `rgba(224, 162, 63, 0.40)` | Warm secondary — fuel / mobile-combustion accents, alt charts |
| **Gold** | `#C99C3D` | `rgba(201, 156, 61, 0.15)` | `rgba(201, 156, 61, 0.40)` | Scope 1 (direct emissions) — deeper, audit-friendly warm |
| **Blue** | `#6FA4C9` | `rgba(111, 164, 201, 0.15)` | `rgba(111, 164, 201, 0.40)` | Cool primary — `info` chips, electricity accents |
| **Slate** | `#5B89B8` | `rgba(91, 137, 184, 0.15)` | `rgba(91, 137, 184, 0.40)` | Scope 2 (purchased electricity) — muted cool to pair with Gold |
| **Teal** | `#3FA89B` | `rgba(63, 168, 155, 0.15)` | `rgba(63, 168, 155, 0.40)` | Cool secondary — alternate cool accent for multi-series charts |

## Pairings used

| Pairing | Hues | Where |
|---|---|---|
| Peach + Blue | `#DE7356` / `#6FA4C9` | Brand chrome — primary actions, info chips |
| Gold + Slate | `#C99C3D` / `#5B89B8` | Scope 1 / Scope 2 — stats strip, hover pills, panel scope badges |
| Amber + Teal | `#E0A23F` / `#3FA89B` | (reserved) categorical encodings beyond scope |

## Token names

Defined in [components/engram/tokens.css](../components/engram/tokens.css):

```css
--primary:       #DE7356;
--primary-soft:  oklch(0.70 0.14 45 / 0.15);
--primary-line:  oklch(0.70 0.14 45 / 0.35);

--scope-1:       #C99C3D;
--scope-1-soft:  rgba(201, 156, 61, 0.15);
--scope-1-line:  rgba(201, 156, 61, 0.40);

--scope-2:       #5B89B8;
--scope-2-soft:  rgba(91, 137, 184, 0.15);
--scope-2-line:  rgba(91, 137, 184, 0.40);

--info:          #6FA4C9;
--info-soft:     oklch(0.70 0.07 240 / 0.15);

--warn:          #E9B84E;          /* close to Amber but kept distinct */
--warn-soft:     oklch(0.80 0.13 85 / 0.14);
```

Amber and Teal don't have dedicated tokens yet — add them when the
first usage lands. Inline rgba values until then.

## Why Scope 1 ≠ Peach

`--primary` (peach) carries the "brand / active state / focus" meaning
across every surface (buttons, hero number, focus ring, logo). When
Scope 1 also painted peach, a Scope 1 chip and an active filter chip
were visually identical. Gold preserves the warm-cool axis everyone
expects from scope visualizations while staying out of the brand
namespace.
