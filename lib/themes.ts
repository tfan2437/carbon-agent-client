// lib/themes.ts — graph color themes
//
// Three palettes, all designed for legibility on the locked dark background
// (#0B0E14). Each theme exposes `colorFor(node)` and a small legend; the
// graph and analytics-panel header consume the same function so colors stay
// in sync across the surface.
//
// Palette sources:
//  - Okabe-Ito (2002): 8-color colorblind-safe palette popularised by Nature.
//    The yellow is shifted from #F0E442 to #F5C710 for dark-bg legibility.
//  - Paul Tol "Bright": vivid qualitative palette designed for screens.
//
// Scope 1 (amber) / Scope 2 (blue) tokens stay separate — they're used by
// time-series charts and scope filter buttons regardless of node theme.
import type { GHGNode } from './types';

export type ThemeKey = 'scope' | 'okabe' | 'tol';

export interface ThemeLegendEntry {
  color: string;
  label: string;
}

export interface Theme {
  key: ThemeKey;
  name: string;          // Chinese display name (toggle button)
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

const OKABE_ITO = {
  vermillion: '#D55E00',
  skyBlue: '#56B4E9',
  yellow: '#F5C710',       // dark-bg variant of Okabe yellow #F0E442
  bluishGreen: '#009E73',
  facility: '#9CA3AF',
  company: '#F3F4F6',
  document: '#6B7280',
} as const;

const TOL_BRIGHT = {
  red: '#EE6677',
  cyan: '#66CCEE',
  yellow: '#CCBB44',
  green: '#228833',
  facility: '#BBBBBB',
  company: '#EEEEEE',
  document: '#777777',
} as const;

// ─── Theme builders ──────────────────────────────────────────────────

const scopeTheme: Theme = {
  key: 'scope',
  name: '範疇',
  englishName: 'Scope',
  description: '依範疇 1 / 2 上色',
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

interface EmissionPalette {
  mobile: string;
  fugitive: string;
  electricity: string;
  process: string;
  facility: string;
  company: string;
  document: string;
}

function makeEmissionTheme(opts: {
  key: ThemeKey;
  name: string;
  englishName: string;
  description: string;
  palette: EmissionPalette;
}): Theme {
  const { palette } = opts;
  return {
    key: opts.key,
    name: opts.name,
    englishName: opts.englishName,
    description: opts.description,
    colorFor: (node) => {
      switch (node.type) {
        case 'company':
          return palette.company;
        case 'facility':
          return palette.facility;
        case 'emission_source':
          switch (node.emission_type) {
            case 'mobile_combustion':
              return palette.mobile;
            case 'fugitive':
              return palette.fugitive;
            case 'purchased_electricity':
              return palette.electricity;
            case 'process':
              return palette.process;
          }
          return palette.facility;
        case 'source_document':
          return palette.document;
        case 'activity_data':
          // Activities are panel-only; the header reads the parent source
          // color via breadcrumb, so this is a safe fallback.
          return palette.facility;
      }
    },
    legend: [
      { color: palette.mobile, label: '移動燃燒' },
      { color: palette.fugitive, label: '逸散' },
      { color: palette.electricity, label: '外購電力' },
      { color: palette.process, label: '製程' },
    ],
  };
}

const okabeTheme = makeEmissionTheme({
  key: 'okabe',
  name: '類別',
  englishName: 'Okabe-Ito',
  description: '依排放類別上色（色盲友善）',
  palette: {
    mobile: OKABE_ITO.vermillion,
    fugitive: OKABE_ITO.skyBlue,
    electricity: OKABE_ITO.yellow,
    process: OKABE_ITO.bluishGreen,
    facility: OKABE_ITO.facility,
    company: OKABE_ITO.company,
    document: OKABE_ITO.document,
  },
});

const tolTheme = makeEmissionTheme({
  key: 'tol',
  name: '鮮明',
  englishName: 'Tol Bright',
  description: '高對比鮮明配色',
  palette: {
    mobile: TOL_BRIGHT.red,
    fugitive: TOL_BRIGHT.cyan,
    electricity: TOL_BRIGHT.yellow,
    process: TOL_BRIGHT.green,
    facility: TOL_BRIGHT.facility,
    company: TOL_BRIGHT.company,
    document: TOL_BRIGHT.document,
  },
});

export const THEMES: Record<ThemeKey, Theme> = {
  scope: scopeTheme,
  okabe: okabeTheme,
  tol: tolTheme,
};

export const THEME_ORDER: ThemeKey[] = ['scope', 'okabe', 'tol'];

// Default to Okabe-Ito — colorblind-safe, gives the emission-type axis the
// strongest visual encoding in the canvas.
export const DEFAULT_THEME: ThemeKey = 'okabe';
