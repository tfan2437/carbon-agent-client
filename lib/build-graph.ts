// lib/build-graph.ts
//
// Pure transform: backend DocumentRecord[] → GHGGraphData.
// Used when the backend returns a flat records[] array. If the backend
// returns pre-built {nodes, links} directly, this file is unused.
//
// Mirrors build_graph.py on the backend side — keep the two in sync.

import type {
  ActivityDataNode,
  CompanyNode,
  EmissionSourceNode,
  EmissionType,
  FacilityNode,
  GHGGraphData,
  GHGLink,
  GHGNode,
  ProcessingStatus,
  Scope,
  ScopeCategory,
  SourceDocumentNode,
  SourceType,
} from './types';

// ─── Backend record shape (mirrors models/record.py DocumentRecord) ───

export interface DocumentRecord {
  document_id: string;
  file_hash: string;
  source_file: string;
  source_type: SourceType;
  location_code: string | null;
  period_start: string;
  period_end: string;
  extraction: unknown;
  emission: {
    scope: 1 | 2;
    factor_value: number;
    factor_unit: string;
    factor_source: string;
    factor_year: number;
    activity_value: number;
    activity_unit: string;
    emissions_kgco2e: number;
    emissions_tco2e: number;
    gas_breakdown: Array<{
      gas: string;
      factor_per_unit: number;
      gwp: number;
      emission_kg: number;
      emission_co2e_kg: number;
      emission_tco2e: number;
    }> | null;
  } | null;
  taxonomy: {
    facility_id: string;
    facility_name: string;
    equipment_id: string | null;
    source_code: string;
    source_name: string;
    material_code: string;
    material_name: string;
    is_biofuel: boolean;
    scope_category: ScopeCategory;
    emission_type: EmissionType;
  } | null;
  status: ProcessingStatus;
  warnings: string[];
  processed_at: string;
}

export interface CompanyConfig {
  company_id: string;
  company_name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const round4 = (x: number): number => Math.round(x * 10000) / 10000;

function periodLabel(periodStart: string, periodEnd: string): string {
  const [ys, ms] = [periodStart.slice(0, 4), periodStart.slice(5, 7)];
  const [ye, me] = [periodEnd.slice(0, 4), periodEnd.slice(5, 7)];
  if (ys === ye && ms === me) return `${ys}-${ms}`;
  if (ys === ye) return `${ys}-${ms}~${me}`;
  return `${ys}-${ms}~${ye}-${me}`;
}

function esId(facilityId: string, sourceCode: string, materialCode: string): string {
  return `es-${facilityId}-${sourceCode}-${materialCode}`;
}

function summarizeExtraction(
  ext: unknown,
  sourceType: SourceType,
): Record<string, unknown> {
  if (!ext || typeof ext !== 'object') return {};
  const e = ext as Record<string, unknown>;
  switch (sourceType) {
    case 'fuel':
      return {
        fuel_type: e.fuel_type,
        supply_type: e.supply_type,
        total_liters: e.total_liters,
        total_records: e.total_records,
        equipment_count: e.equipment_count,
      };
    case 'electricity':
      return {
        customer_number: e.customer_number,
        service_address: e.service_address,
        pricing_type: e.pricing_type,
        tou_type: e.tou_type,
        total_consumption_kwh: e.total_consumption_kwh,
        total_amount_twd: e.total_amount_twd,
        segments: e.segments,
        extraction_confidence: e.extraction_confidence,
      };
    case 'refrigerant':
      return {
        supply_type: e.supply_type,
        total_equipment_count: e.total_equipment_count,
        total_charge_kg: e.total_charge_kg,
        equipment_items: e.equipment_items,
      };
    case 'work_hours':
      return {
        doc_type_code: e.doc_type_code,
        employee_count: e.employee_count,
        total_hours: e.total_hours,
      };
    default:
      return {};
  }
}

// ─── Main transform ──────────────────────────────────────────────────

export function buildGraph(
  records: DocumentRecord[],
  company: CompanyConfig,
): GHGGraphData {
  // Only records with taxonomy + emission are usable
  const valid = records.filter((r) => r.taxonomy && r.emission);

  const facilitiesSeen = new Map<string, string>();                      // fid → name
  const emissionSourcesSeen = new Map<string, EmissionSourceNode>();     // esId → node
  const documentsSeen = new Map<string, SourceDocumentNode>();           // source_file → node

  const facilityEmissions = new Map<string, number>();
  const sourceEmissions = new Map<string, number>();
  const allYears = new Set<number>();

  let scope1 = 0;
  let scope2 = 0;
  let totalTco2e = 0;

  // ── Single pass over records ──
  const activityNodes: ActivityDataNode[] = [];
  const links: GHGLink[] = [];

  for (const rec of valid) {
    const tax = rec.taxonomy!;
    const em = rec.emission!;
    const fid = tax.facility_id;
    const srcCode = tax.source_code;
    const matCode = tax.material_code;
    const tco2e = em.emissions_tco2e ?? 0;
    const year = parseInt(rec.period_start.slice(0, 4), 10);
    allYears.add(year);
    totalTco2e += tco2e;
    if (em.scope === 1) scope1 += tco2e;
    if (em.scope === 2) scope2 += tco2e;

    // Facility
    facilitiesSeen.set(fid, tax.facility_name);
    facilityEmissions.set(fid, (facilityEmissions.get(fid) ?? 0) + tco2e);

    // Emission Source (by facility + source + material)
    const key = esId(fid, srcCode, matCode);
    sourceEmissions.set(key, (sourceEmissions.get(key) ?? 0) + tco2e);
    if (!emissionSourcesSeen.has(key)) {
      emissionSourcesSeen.set(key, {
        id: key,
        type: 'emission_source',
        name: `${tax.source_name} · ${tax.material_name}`,
        short_name: tax.source_name,
        material_name: tax.material_name,
        source_code: srcCode,
        material_code: matCode,
        scope: em.scope as Scope,
        scope_category: tax.scope_category,
        emission_type: tax.emission_type,
        is_biofuel: tax.is_biofuel,
        facility_id: fid,
        emissions_tco2e: 0,       // filled in after loop
        year,
      });
    }

    // Activity Data (1:1 per record)
    const activityId = `activity-${rec.document_id}`;
    const pLabel = periodLabel(rec.period_start, rec.period_end);
    activityNodes.push({
      id: activityId,
      type: 'activity_data',
      name: `${pLabel} · ${tax.material_name}`,
      scope: em.scope as Scope,
      document_id: rec.document_id,
      facility_id: fid,
      source_code: srcCode,
      material_code: matCode,
      period_start: rec.period_start,
      period_end: rec.period_end,
      period_label: pLabel,
      year,
      activity_value: em.activity_value,
      activity_unit: em.activity_unit,
      emission_factor: {
        value: em.factor_value,
        unit: em.factor_unit,
        source: em.factor_source,
        year: em.factor_year,
      },
      gas_breakdown: em.gas_breakdown ?? [],
      emissions_kgco2e: em.emissions_kgco2e,
      emissions_tco2e: em.emissions_tco2e,
      source_type: rec.source_type,
      source_file: rec.source_file,
      status: rec.status ?? 'success',
      warnings: rec.warnings ?? [],
      extraction_summary: summarizeExtraction(rec.extraction, rec.source_type) as ActivityDataNode['extraction_summary'],
      extraction: rec.extraction,
    });
    links.push({ source: key, target: activityId });

    // Source document (may be shared)
    const sf = rec.source_file;
    const docId = `doc-${sf}`;
    if (!documentsSeen.has(sf)) {
      documentsSeen.set(sf, {
        id: docId,
        type: 'source_document',
        name: sf,
        scope: null,
        source_file: sf,
        source_type: rec.source_type,
        record_count: 0,
        status: 'success',
        year,
      });
    }
    const doc = documentsSeen.get(sf)!;
    doc.record_count += 1;
    if (rec.status === 'failed') doc.status = 'failed';
    else if (rec.status === 'partial' && doc.status !== 'failed') doc.status = 'partial';

    links.push({ source: activityId, target: docId });
  }

  // ── Emissions accumulation into emission_source nodes ──
  for (const [key, node] of emissionSourcesSeen) {
    node.emissions_tco2e = round4(sourceEmissions.get(key) ?? 0);
  }

  const years = Array.from(allYears).sort();
  const primaryYear = years.length > 0 ? years[years.length - 1] : null;

  // ── Assemble nodes in stable order ──
  const companyId = `company-${company.company_id}`;
  const companyNode: CompanyNode = {
    id: companyId,
    type: 'company',
    name: company.company_name,
    scope: null,
    emissions_tco2e: round4(totalTco2e),
    scope_1_tco2e: round4(scope1),
    scope_2_tco2e: round4(scope2),
    record_count: valid.length,
    year: primaryYear,
  };

  const facilityNodes: FacilityNode[] = Array.from(facilitiesSeen.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fid, fname]) => ({
      id: `facility-${fid}`,
      type: 'facility',
      name: fname,
      scope: null,
      facility_id: fid,
      emissions_tco2e: round4(facilityEmissions.get(fid) ?? 0),
      year: primaryYear,
    }));

  const emissionSourceNodes = Array.from(emissionSourcesSeen.values()).sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  const documentNodes = Array.from(documentsSeen.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // ── Build structural links (company→facility, facility→source) ──
  const structuralLinks: GHGLink[] = [
    ...facilityNodes.map((f) => ({ source: companyId, target: f.id })),
    ...emissionSourceNodes.map((es) => ({
      source: `facility-${es.facility_id}`,
      target: es.id,
    })),
  ];

  const nodes: GHGNode[] = [
    companyNode,
    ...facilityNodes,
    ...emissionSourceNodes,
    ...activityNodes,
    ...documentNodes,
  ];

  return {
    meta: {
      company_id: company.company_id,
      company_name: company.company_name,
      primary_year: primaryYear,
      years_covered: years,
      total_tco2e: round4(totalTco2e),
      scope_1_tco2e: round4(scope1),
      scope_2_tco2e: round4(scope2),
      record_count: valid.length,
      facility_count: facilitiesSeen.size,
      emission_source_count: emissionSourcesSeen.size,
      source_document_count: documentsSeen.size,
    },
    nodes,
    links: [...structuralLinks, ...links],
  };
}
