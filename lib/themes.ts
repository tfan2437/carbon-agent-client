// lib/themes.ts — graph color themes
//
// Three palettes, all designed for legibility on the locked dark background
// (#0B0E14). Each theme exposes `colorFor(node)` and a small legend; the
// graph and analytics-panel header consume the same function so colors stay
// in sync across the surface.
//
// Default is "材質" (Material): each emission_type owns a hue family
// (warm reds for fuel, cool blues for refrigerant, gold for electricity,
// green for process), and individual materials (柴油 / 汽油 / HFC-134a /
// R410a / …) receive distinct shades within that family. Same material
// across different vehicles or facilities renders in the same color so
// patterns are immediately visible on the canvas.
//
// Tokens come from Tailwind's OKLCH-tuned palette — perceptually balanced
// and tested for dark backgrounds.
//
// "範疇" (Scope) and "類別" (Type) remain as alternatives:
//  - Scope: Scope 1 amber / Scope 2 blue — for compliance reading.
//  - Type:  Okabe-Ito 4-color encoding by emission_type only — colorblind
//           safe, picked from the Nature-popularised palette (1.7-axis
//           protan/deutan/tritan tested).
import type { EmissionType, GHGNode } from './types';

export type ThemeKey = 'material' | 'scope' | 'type';

export interface ThemeLegendEntry {
  color: string;
  label: string;
  hint?: string;
}

export interface Theme {
  key: ThemeKey;
  name: string;          // Chinese display (toggle button)
  englishName: string;   // tooltip / accessibility
  description: string;
  colorFor: (node: GHGNode) => string;
  legend: ThemeLegendEntry[];
}

// ─── Tokens ──────────────────────────────────────────────────────────

export const SCOPE_TOKENS = {
  scope1: '#F59E0B',
  scope2: '#3B82F6',
  neutral: '#6B7280',
} as const;

const NEUTRAL = {
  facility: '#9CA3AF',
  company: '#F3F4F6',
  document: '#6B7280',
} as const;

// ─── Material theme ──────────────────────────────────────────────────
//
// Hand-curated by (emission_type, material_code). Material codes come from
// the backend's emission factor catalog (環境部 113年公告 / 經濟部能源署).
// Unknown materials fall through to a deterministic shade picked from the
// emission_type's family ramp — same code always maps to the same shade.

const MATERIAL_COLORS: Record<string, string> = {
  // mobile_combustion — warm amber / orange family
  'mobile_combustion:170006': '#D97706', // 柴油 diesel — deep amber
  'mobile_combustion:170001': '#F97316', // 車用汽油 gasoline — bright orange
  'mobile_combustion:GG2306': '#FBBF24', // 尿素 urea (AdBlue) — light amber

  // fugitive — cool sky / cyan / teal family
  'fugitive:GG1814': '#0EA5E9',           // R410a HFC blend — sky
  'fugitive:GG1835': '#22D3EE',           // HFC-134a — cyan
  'fugitive:360006': '#14B8A6',           // 水肥 wastewater (CH4) — teal

  // purchased_electricity — gold family
  'purchased_electricity:GG3500': '#EAB308', // 台電電力 — gold

  // process — green family (no instances yet in data)
};

const FAMILY_RAMPS: Record<EmissionType, string[]> = {
  // Each ramp keeps the family hue but rotates lightness/chroma so that
  // any new material remains identifiably "warm" or "cool" while still
  // being visually distinct from siblings.
  mobile_combustion: ['#D97706', '#F97316', '#FBBF24', '#FB923C', '#EA580C', '#FCD34D'],
  fugitive: ['#0EA5E9', '#22D3EE', '#14B8A6', '#0284C7', '#06B6D4', '#0891B2'],
  purchased_electricity: ['#EAB308', '#CA8A04', '#FACC15', '#FDE047'],
  process: ['#10B981', '#059669', '#34D399', '#047857'],
};

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function materialColor(emissionType: EmissionType, materialCode: string): string {
  const key = `${emissionType}:${materialCode}`;
  const exact = MATERIAL_COLORS[key];
  if (exact) return exact;
  const ramp = FAMILY_RAMPS[emissionType];
  return ramp[hashCode(materialCode) % ramp.length];
}

const materialTheme: Theme = {
  key: 'material',
  name: '材質',
  englishName: 'Material',
  description: '依排放類別著色，材質決定深淺（柴油與汽油同屬暖色調，色階不同）',
  colorFor: (node) => {
    switch (node.type) {
      case 'company':
        return NEUTRAL.company;
      case 'facility':
        return NEUTRAL.facility;
      case 'emission_source':
        return materialColor(node.emission_type, node.material_code);
      case 'source_document':
        return NEUTRAL.document;
      case 'activity_data':
        // Activities are panel-only — header uses the parent source color
        // via the breadcrumb; this is a safe fallback only.
        return NEUTRAL.facility;
    }
  },
  legend: [
    { color: '#F97316', label: '移動燃燒', hint: '紅橘系（柴油 / 汽油 / 尿素）' },
    { color: '#22D3EE', label: '逸散', hint: '藍青系（HFC / R410a / 水肥）' },
    { color: '#EAB308', label: '外購電力', hint: '金黃系' },
    { color: '#10B981', label: '製程', hint: '綠系' },
  ],
};

// ─── Scope theme ─────────────────────────────────────────────────────

const scopeTheme: Theme = {
  key: 'scope',
  name: '範疇',
  englishName: 'Scope',
  description: '依範疇 1 / 2 上色（適合查核報告對齊）',
  colorFor: (node) => {
    if (node.scope === 1) return SCOPE_TOKENS.scope1;
    if (node.scope === 2) return SCOPE_TOKENS.scope2;
    return SCOPE_TOKENS.neutral;
  },
  legend: [
    { color: SCOPE_TOKENS.scope1, label: 'Scope 1' },
    { color: SCOPE_TOKENS.scope2, label: 'Scope 2' },
    { color: SCOPE_TOKENS.neutral, label: '結構' },
  ],
};

// ─── Type theme (Okabe-Ito) ──────────────────────────────────────────

const OKABE_ITO = {
  vermillion: '#D55E00',
  skyBlue: '#56B4E9',
  yellow: '#F5C710',     // dark-bg variant of #F0E442
  bluishGreen: '#009E73',
} as const;

const typeTheme: Theme = {
  key: 'type',
  name: '類別',
  englishName: 'Type (Okabe-Ito)',
  description: '依排放類別上色，每類一色（色盲友善）',
  colorFor: (node) => {
    switch (node.type) {
      case 'company':
        return NEUTRAL.company;
      case 'facility':
        return NEUTRAL.facility;
      case 'emission_source':
        switch (node.emission_type) {
          case 'mobile_combustion':
            return OKABE_ITO.vermillion;
          case 'fugitive':
            return OKABE_ITO.skyBlue;
          case 'purchased_electricity':
            return OKABE_ITO.yellow;
          case 'process':
            return OKABE_ITO.bluishGreen;
        }
        return NEUTRAL.facility;
      case 'source_document':
        return NEUTRAL.document;
      case 'activity_data':
        return NEUTRAL.facility;
    }
  },
  legend: [
    { color: OKABE_ITO.vermillion, label: '移動燃燒' },
    { color: OKABE_ITO.skyBlue, label: '逸散' },
    { color: OKABE_ITO.yellow, label: '外購電力' },
    { color: OKABE_ITO.bluishGreen, label: '製程' },
  ],
};

// ─── Registry ────────────────────────────────────────────────────────

export const THEMES: Record<ThemeKey, Theme> = {
  material: materialTheme,
  scope: scopeTheme,
  type: typeTheme,
};

export const THEME_ORDER: ThemeKey[] = ['material', 'type', 'scope'];

// Material is the new default — answers the design intent (material identity
// becomes the primary visual axis; scope is an option, not the default).
export const DEFAULT_THEME: ThemeKey = 'material';
