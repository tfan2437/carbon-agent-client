// lib/types.ts — extended schema for LingCarbon graph view
//
// Replaces the hand-rolled types in lib/ghg-data.ts. Fields are a superset
// of the v0 mock — existing usages continue to work; new fields unlock
// inspector drill-down, the emission_type filter dimension, and audit traceability.

// ─── Enums (mirrors backend models/enums.py) ─────────────────────────

export type NodeType =
  | 'company'
  | 'facility'
  | 'emission_source'
  | 'activity_data'
  | 'source_document';

export type Scope = 1 | 2 | null;

export type ScopeCategory = 'direct' | 'indirect';

export type EmissionType =
  | 'mobile_combustion'      // 移動燃燒 — fuel
  | 'fugitive'               // 逸散 — refrigerant, wastewater
  | 'purchased_electricity'  // 外購電力
  | 'process';               // 製程 (not used yet)

export type SourceType =
  | 'electricity'
  | 'fuel'
  | 'refrigerant'
  | 'work_hours';

export type ProcessingStatus = 'success' | 'partial' | 'failed' | 'duplicate';

// ─── Backend payload types (mirrors models/record.py) ───────────────
// Kept on activity_data nodes for the inspector drill-down.

export interface GasEmission {
  gas: string;                    // "CO2" | "CH4" | "N2O" | "HFCs" | "PFCs" | "SF6" | "NF3"
  factor_per_unit: number;
  gwp: number;
  emission_kg: number;
  emission_co2e_kg: number;
  emission_tco2e: number;
}

export interface EmissionFactorInfo {
  value: number;
  unit: string;                   // "kgCO2e/L" | "kgCO2e/kWh" | "kgCO2e/kg" | ...
  source: string;                 // "環境部 113年公告..." | "經濟部能源署..."
  year: number;
}

// Extraction payload summaries (one per source_type) — abbreviated for inspector

export interface FuelExtractionSummary {
  fuel_type: 'diesel' | 'gasoline' | 'def';
  supply_type: string;            // "自設加油站" | "中油加油卡" | "公務車加油"
  total_liters: number;
  total_records: number;          // transaction count
  equipment_count: number;        // unique vehicle count
}

export interface ElectricityExtractionSummary {
  customer_number: string;
  service_address: string;
  pricing_type: string;           // "表燈簡易營業用"
  tou_type: string | null;        // "二段式時間電價" | "三段式時間電價" | null
  total_consumption_kwh: number;
  total_amount_twd: number;
  segments: {
    peak_kwh: number | null;
    off_peak_kwh: number | null;
    half_peak_kwh: number | null;
    saturday_half_peak_kwh: number | null;
    regular_kwh: number | null;
  };
  extraction_confidence: number;
}

export interface RefrigerantExtractionSummary {
  supply_type: string;            // "冰箱" | "冷氣" | "飲水機"
  total_equipment_count: number;
  total_charge_kg: number;
  equipment_items: Array<{
    equipment_location: string;
    equipment_type: string;
    equipment_brand: string;
    equipment_model: string;
    refrigerant_type: string;
    refrigerant_charge: number;
    refrigerant_charge_unit: 'g' | 'kg';
  }>;
}

export interface WorkHoursExtractionSummary {
  doc_type_code: string;          // "1800" | "1900"
  employee_count: number;
  total_hours: number;
}

export type ExtractionSummary =
  | FuelExtractionSummary
  | ElectricityExtractionSummary
  | RefrigerantExtractionSummary
  | WorkHoursExtractionSummary
  | Record<string, never>;

// ─── Graph node types ────────────────────────────────────────────────

interface BaseNode {
  id: string;
  type: NodeType;
  name: string;
  scope: Scope;
  year: number | null;
}

export interface CompanyNode extends BaseNode {
  type: 'company';
  scope: null;
  emissions_tco2e: number;
  scope_1_tco2e: number;
  scope_2_tco2e: number;
  record_count: number;
}

export interface FacilityNode extends BaseNode {
  type: 'facility';
  scope: null;
  facility_id: string;            // D-code e.g. "D00001"
  emissions_tco2e: number;
}

export interface EmissionSourceNode extends BaseNode {
  type: 'emission_source';
  short_name: string;             // "大客車" (source_name only)
  material_name: string;          // "柴油"
  source_code: string;            // "B100"
  material_code: string;          // "170006"
  scope_category: ScopeCategory;
  emission_type: EmissionType;
  is_biofuel: boolean;
  facility_id: string;
  emissions_tco2e: number;
}

export interface ActivityDataNode extends BaseNode {
  type: 'activity_data';
  document_id: string;            // UUID from backend DocumentRecord
  facility_id: string;
  source_code: string;
  material_code: string;
  period_start: string;           // ISO date "2025-01-01"
  period_end: string;
  period_label: string;           // "2025-01" | "2025-01~02" | "2025-01~12"
  activity_value: number;
  activity_unit: string;
  emission_factor: EmissionFactorInfo;
  gas_breakdown: GasEmission[];
  emissions_kgco2e: number;
  emissions_tco2e: number;
  source_type: SourceType;
  source_file: string;
  status: ProcessingStatus;
  warnings: string[];
  extraction_summary: ExtractionSummary;
  extraction: unknown;            // full payload — kept for deep inspector use
}

export interface SourceDocumentNode extends BaseNode {
  type: 'source_document';
  scope: null;
  source_file: string;
  source_type: SourceType;
  record_count: number;           // how many activity nodes feed from this file
  status: ProcessingStatus;
}

export type GHGNode =
  | CompanyNode
  | FacilityNode
  | EmissionSourceNode
  | ActivityDataNode
  | SourceDocumentNode;

// ─── Graph payload (what the API returns) ───────────────────────────

export interface GHGLink {
  source: string;
  target: string;
}

export interface GHGGraphMeta {
  company_id: string;
  company_name: string;
  primary_year: number | null;
  years_covered: number[];
  total_tco2e: number;
  scope_1_tco2e: number;
  scope_2_tco2e: number;
  record_count: number;
  facility_count: number;
  emission_source_count: number;
  source_document_count: number;
}

export interface GHGGraphData {
  meta: GHGGraphMeta;
  nodes: GHGNode[];
  links: GHGLink[];
}

// ─── UI-only helpers ────────────────────────────────────────────────

export const NODE_COLORS = {
  scope1: '#F59E0B',
  scope2: '#3B82F6',
  neutral: '#6B7280',
} as const;

export const EMISSION_TYPE_LABELS: Record<EmissionType, { zh: string; en: string }> = {
  mobile_combustion: { zh: '移動燃燒', en: 'Mobile Combustion' },
  fugitive: { zh: '逸散', en: 'Fugitive' },
  purchased_electricity: { zh: '外購電力', en: 'Purchased Electricity' },
  process: { zh: '製程', en: 'Process' },
};

export const NODE_TYPE_LABELS: Record<NodeType, { zh: string; en: string }> = {
  company: { zh: '公司', en: 'Company' },
  facility: { zh: '場站', en: 'Facility' },
  emission_source: { zh: '排放源', en: 'Emission Source' },
  activity_data: { zh: '活動數據', en: 'Activity Data' },
  source_document: { zh: '來源文件', en: 'Source Document' },
};

export function getNodeColor(node: GHGNode): string {
  if (node.scope === 1) return NODE_COLORS.scope1;
  if (node.scope === 2) return NODE_COLORS.scope2;
  return NODE_COLORS.neutral;
}
