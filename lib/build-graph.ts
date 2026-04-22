// lib/build-graph.ts
//
// Pure transform: backend DocumentRecord[] → GHGGraphData.
// Used when the backend returns a flat records[] array. If the backend
// returns pre-built {nodes, links} directly, this file is unused.
//
// Mirrors outputs/scripts/build_graph.py — keep the two in sync.

import type {
  ActivityDataNode,
  CompanyNode,
  EmissionEntry,
  EmissionSourceNode,
  EmissionType,
  ExtractionSummary,
  FacilityNode,
  GHGGraphData,
  GHGLink,
  GHGNode,
  MonthlyBreakdown,
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
  // emission may be EmissionEntry[] (current backend) or single legacy
  // object (v0 mock). Normalized to array via _normalizeEmission().
  emission: EmissionEntry[] | EmissionEntry | null;
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
  file_processing_time_ms?: number | null;
}

export interface CompanyConfig {
  company_id: string;
  company_name: string;
}

export interface BuildGraphOptions {
  includePii?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const round4 = (x: number): number => Math.round(x * 10000) / 10000;

const zeros12 = (): number[] => Array(12).fill(0);

function periodLabel(periodStart: string, periodEnd: string): string {
  const ys = periodStart.slice(0, 4);
  const ms = periodStart.slice(5, 7);
  const ye = periodEnd.slice(0, 4);
  const me = periodEnd.slice(5, 7);
  if (ys === ye && ms === me) return `${ys}-${ms}`;
  if (ys === ye) return `${ys}-${ms}~${me}`;
  return `${ys}-${ms}~${ye}-${me}`;
}

function esId(facilityId: string, sourceCode: string, materialCode: string): string {
  return `es-${facilityId}-${sourceCode}-${materialCode}`;
}

// ─── PII masking ─────────────────────────────────────────────────────

export function maskPlate(plate: string | null | undefined): string | null {
  if (plate == null) return plate ?? null;
  const s = String(plate);
  if (s.length === 0) return s;
  if (s.length <= 3) return `${s}-***`;
  return `${s.slice(0, 3)}-***`;
}

function maskExtraction(
  ext: unknown,
  sourceType: SourceType,
  includePii: boolean,
): unknown {
  if (includePii || ext == null || typeof ext !== 'object') return ext;
  const e = { ...(ext as Record<string, unknown>) };
  if (sourceType === 'fuel' && Array.isArray(e.transactions)) {
    e.transactions = (e.transactions as Array<Record<string, unknown>>).map((tx) => ({
      ...tx,
      vehicle_plate: maskPlate(tx.vehicle_plate as string | null | undefined),
      driver_name: null,
      driver_id: null,
    }));
  } else if (sourceType === 'work_hours' && Array.isArray(e.employees)) {
    e.employees = (e.employees as Array<Record<string, unknown>>).map((emp) => ({
      ...emp,
      employee_name: null,
    }));
  }
  return e;
}

// ─── Emission entry normalization ────────────────────────────────────

function normalizeEmission(emission: DocumentRecord['emission']): EmissionEntry[] {
  if (emission == null) return [];
  if (Array.isArray(emission)) return emission.filter(Boolean);
  // Legacy single-object form — wrap as a synthetic single-entry array
  return [emission];
}

function entryYear(entry: EmissionEntry, fallbackPeriodStart: string): number {
  if (entry.year != null) return entry.year;
  const ps = entry.period_start || fallbackPeriodStart;
  return parseInt(ps.slice(0, 4), 10);
}

function accumulateMonthly(
  bucket: number[],
  entry: EmissionEntry,
  primaryYear: number,
): void {
  const eyear = entryYear(entry, entry.period_start ?? '1970-01-01');
  if (eyear !== primaryYear) return;
  const mb: MonthlyBreakdown[] | null | undefined = entry.monthly_breakdown;
  if (Array.isArray(mb) && mb.length > 0) {
    for (const m of mb) {
      const month = Number(m.month);
      if (month >= 1 && month <= 12) {
        bucket[month - 1] += Number(m.emissions_tco2e ?? 0);
      }
    }
    return;
  }
  const ps = entry.period_start ?? '';
  if (ps.length >= 7) {
    const month = parseInt(ps.slice(5, 7), 10);
    if (month >= 1 && month <= 12) {
      bucket[month - 1] += Number(entry.emissions_tco2e ?? 0);
    }
  }
}

// ─── Extraction summarizer ───────────────────────────────────────────

function summarizeExtraction(
  ext: unknown,
  sourceType: SourceType,
): ExtractionSummary {
  if (!ext || typeof ext !== 'object') return {} as ExtractionSummary;
  const e = ext as Record<string, unknown>;
  switch (sourceType) {
    case 'fuel':
      return {
        fuel_type: e.fuel_type,
        supply_type: e.supply_type,
        total_liters: e.total_liters,
        total_records: e.total_records,
        equipment_count: e.equipment_count,
      } as ExtractionSummary;
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
      } as ExtractionSummary;
    case 'refrigerant':
      return {
        supply_type: e.supply_type,
        total_equipment_count: e.total_equipment_count,
        total_charge_kg: e.total_charge_kg,
        equipment_items: e.equipment_items,
      } as ExtractionSummary;
    case 'work_hours':
      return {
        doc_type_code: e.doc_type_code,
        employee_count: e.employee_count,
        total_hours: e.total_hours,
      } as ExtractionSummary;
    default:
      return {} as ExtractionSummary;
  }
}

// ─── Main transform ──────────────────────────────────────────────────

export function buildGraph(
  records: DocumentRecord[],
  company: CompanyConfig,
  options: BuildGraphOptions = {},
): GHGGraphData {
  const includePii = options.includePii ?? false;

  // ── Filter to records with both taxonomy and at least one emission entry ──
  const validRecords: Array<{ rec: DocumentRecord; entries: EmissionEntry[] }> = [];
  for (const r of records) {
    if (!r.taxonomy) continue;
    const entries = normalizeEmission(r.emission);
    if (entries.length === 0) continue;
    validRecords.push({ rec: r, entries });
  }

  // ── Determine years and primary_year (by entry count, ties → most recent) ──
  const yearCounts = new Map<number, number>();
  for (const { rec, entries } of validRecords) {
    for (const e of entries) {
      const y = entryYear(e, rec.period_start);
      yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1);
    }
  }
  const yearsSorted = Array.from(yearCounts.keys()).sort((a, b) => a - b);
  let primaryYear: number | null = null;
  if (yearCounts.size > 0) {
    let maxCount = -1;
    for (const [y, c] of yearCounts) {
      if (c > maxCount || (c === maxCount && primaryYear !== null && y > primaryYear)) {
        maxCount = c;
        primaryYear = y;
      }
    }
  }

  // ── Accumulators ──
  const facilitiesSeen = new Map<string, string>();                                  // fid → name
  const emissionSourcesSeen = new Map<string, EmissionSourceNode>();                  // esId → node
  const documentsSeen = new Map<
    string,
    { sourceFile: string; sourceType: SourceType; fileHash: string | null; recordCount: number; anyPartial: boolean; anyFailed: boolean }
  >();
  const facilityEmissions = new Map<string, number>();
  const sourceEmissions = new Map<string, number>();
  const sourceRecordCount = new Map<string, number>();
  const sourceTypeCounts: Record<string, number> = {};

  const companyMonthly = zeros12();
  const companyMonthlyScope1 = zeros12();
  const companyMonthlyScope2 = zeros12();
  const facilityMonthly = new Map<string, number[]>();
  const sourceMonthly = new Map<string, number[]>();

  let scope1Total = 0;
  let scope2Total = 0;

  // ── Pre-pass: discover entities + accumulate totals + monthly rollups ──
  for (const { rec, entries } of validRecords) {
    const tax = rec.taxonomy!;
    const fid = tax.facility_id;
    const srcCode = tax.source_code;
    const matCode = tax.material_code;
    const esKey = esId(fid, srcCode, matCode);

    facilitiesSeen.set(fid, tax.facility_name);
    if (!facilityMonthly.has(fid)) facilityMonthly.set(fid, zeros12());

    if (!emissionSourcesSeen.has(esKey)) {
      const first = entries[0];
      emissionSourcesSeen.set(esKey, {
        id: esKey,
        type: 'emission_source',
        name: `${tax.source_name} · ${tax.material_name}`,
        short_name: tax.source_name,
        material_name: tax.material_name,
        source_code: srcCode,
        material_code: matCode,
        scope: (Number(first.scope) || 1) as Scope,
        scope_category: tax.scope_category,
        emission_type: tax.emission_type,
        is_biofuel: tax.is_biofuel ?? false,
        facility_id: fid,
        emissions_tco2e: 0,         // filled in after loop
        monthly_emissions: zeros12(),
        record_count: 0,
        year: primaryYear,
      });
    }
    if (!sourceMonthly.has(esKey)) sourceMonthly.set(esKey, zeros12());

    sourceRecordCount.set(esKey, (sourceRecordCount.get(esKey) ?? 0) + 1);
    sourceTypeCounts[rec.source_type] = (sourceTypeCounts[rec.source_type] ?? 0) + 1;

    for (const entry of entries) {
      const tco2e = Number(entry.emissions_tco2e ?? 0);
      const scope = Number(entry.scope) || 1;
      facilityEmissions.set(fid, (facilityEmissions.get(fid) ?? 0) + tco2e);
      sourceEmissions.set(esKey, (sourceEmissions.get(esKey) ?? 0) + tco2e);
      if (scope === 1) scope1Total += tco2e;
      else if (scope === 2) scope2Total += tco2e;

      if (primaryYear !== null) {
        accumulateMonthly(facilityMonthly.get(fid)!, entry, primaryYear);
        accumulateMonthly(sourceMonthly.get(esKey)!, entry, primaryYear);
        accumulateMonthly(companyMonthly, entry, primaryYear);
        if (scope === 1) accumulateMonthly(companyMonthlyScope1, entry, primaryYear);
        else if (scope === 2) accumulateMonthly(companyMonthlyScope2, entry, primaryYear);
      }
    }

    // Source document
    const sf = rec.source_file;
    if (!documentsSeen.has(sf)) {
      documentsSeen.set(sf, {
        sourceFile: sf,
        sourceType: rec.source_type,
        fileHash: rec.file_hash ?? null,
        recordCount: 0,
        anyPartial: false,
        anyFailed: false,
      });
    }
    const doc = documentsSeen.get(sf)!;
    doc.recordCount += 1;
    if (rec.status === 'partial') doc.anyPartial = true;
    if (rec.status === 'failed') doc.anyFailed = true;
  }

  const totalTco2e = round4(
    Array.from(facilityEmissions.values()).reduce((s, v) => s + v, 0),
  );

  // ── Build nodes + links ──
  const nodes: GHGNode[] = [];
  const links: GHGLink[] = [];

  // Company
  const companyId = `company-${company.company_id}`;
  const companyNode: CompanyNode = {
    id: companyId,
    type: 'company',
    name: company.company_name,
    scope: null,
    emissions_tco2e: totalTco2e,
    scope_1_tco2e: round4(scope1Total),
    scope_2_tco2e: round4(scope2Total),
    record_count: validRecords.length,
    year: primaryYear,
    monthly_emissions: companyMonthly.map((v) => round4(v)),
    monthly_emissions_by_scope: {
      '1': companyMonthlyScope1.map((v) => round4(v)),
      '2': companyMonthlyScope2.map((v) => round4(v)),
    },
  };
  nodes.push(companyNode);

  // Facilities
  for (const fid of Array.from(facilitiesSeen.keys()).sort()) {
    const fname = facilitiesSeen.get(fid)!;
    const facilityNode: FacilityNode = {
      id: `facility-${fid}`,
      type: 'facility',
      name: fname,
      scope: null,
      facility_id: fid,
      emissions_tco2e: round4(facilityEmissions.get(fid) ?? 0),
      monthly_emissions: (facilityMonthly.get(fid) ?? zeros12()).map((v) => round4(v)),
      year: primaryYear,
    };
    nodes.push(facilityNode);
    links.push({ source: companyId, target: facilityNode.id });
  }

  // Emission sources
  const esEntries = Array.from(emissionSourcesSeen.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  for (const [key, node] of esEntries) {
    node.emissions_tco2e = round4(sourceEmissions.get(key) ?? 0);
    node.monthly_emissions = (sourceMonthly.get(key) ?? zeros12()).map((v) => round4(v));
    node.record_count = sourceRecordCount.get(key) ?? 0;
    nodes.push(node);
    links.push({ source: `facility-${node.facility_id}`, target: node.id });
  }

  // Activity Data — one per (record, entry-year)
  for (const { rec, entries } of validRecords) {
    const tax = rec.taxonomy!;
    const fid = tax.facility_id;
    const srcCode = tax.source_code;
    const matCode = tax.material_code;
    const esKey = esId(fid, srcCode, matCode);
    const extSummary = summarizeExtraction(rec.extraction, rec.source_type);
    const maskedExtraction = maskExtraction(rec.extraction, rec.source_type, includePii);
    const multiYear = entries.length > 1;

    for (const entry of entries) {
      const eyear = entryYear(entry, rec.period_start);
      const activityId = multiYear
        ? `activity-${rec.document_id}-y${eyear}`
        : `activity-${rec.document_id}`;
      const epStart = entry.period_start ?? rec.period_start;
      const epEnd = entry.period_end ?? rec.period_end;
      const pLabel = periodLabel(epStart, epEnd);

      const activityNode: ActivityDataNode = {
        id: activityId,
        type: 'activity_data',
        name: `${pLabel} · ${tax.material_name}`,
        scope: (Number(entry.scope) || 1) as Scope,
        document_id: rec.document_id,
        facility_id: fid,
        source_code: srcCode,
        material_code: matCode,
        period_start: epStart,
        period_end: epEnd,
        period_label: pLabel,
        year: eyear,
        activity_value: Number(entry.activity_value ?? 0),
        activity_unit: entry.activity_unit ?? '',
        emission_factor: {
          value: Number(entry.factor_value ?? 0),
          unit: entry.factor_unit ?? '',
          source: entry.factor_source ?? '',
          year: Number(entry.factor_year ?? 0),
        },
        gas_breakdown: entry.gas_breakdown ?? [],
        monthly_breakdown: entry.monthly_breakdown ?? null,
        emissions_kgco2e: Number(entry.emissions_kgco2e ?? 0),
        emissions_tco2e: Number(entry.emissions_tco2e ?? 0),
        source_type: rec.source_type,
        source_file: rec.source_file,
        file_hash: rec.file_hash,
        file_processing_time_ms: rec.file_processing_time_ms ?? null,
        evidence_url: null,
        status: rec.status ?? 'success',
        warnings: rec.warnings ?? [],
        extraction_summary: extSummary,
        extraction: maskedExtraction,
      };
      nodes.push(activityNode);
      links.push({ source: esKey, target: activityId });
      links.push({ source: activityId, target: `doc-${rec.source_file}` });
    }
  }

  // Source Documents
  for (const sf of Array.from(documentsSeen.keys()).sort()) {
    const meta = documentsSeen.get(sf)!;
    const status: ProcessingStatus = meta.anyFailed
      ? 'failed'
      : meta.anyPartial
        ? 'partial'
        : 'success';
    const docNode: SourceDocumentNode = {
      id: `doc-${sf}`,
      type: 'source_document',
      name: sf,
      scope: null,
      source_file: sf,
      source_type: meta.sourceType,
      record_count: meta.recordCount,
      status,
      file_hash: meta.fileHash,
      year: primaryYear,
    };
    nodes.push(docNode);
  }

  return {
    meta: {
      company_id: company.company_id,
      company_name: company.company_name,
      primary_year: primaryYear,
      years_covered: yearsSorted,
      total_tco2e: totalTco2e,
      scope_1_tco2e: round4(scope1Total),
      scope_2_tco2e: round4(scope2Total),
      record_count: validRecords.length,
      facility_count: facilitiesSeen.size,
      emission_source_count: emissionSourcesSeen.size,
      source_document_count: documentsSeen.size,
      source_type_counts: sourceTypeCounts as Record<SourceType, number>,
      pii_included: includePii,
    },
    nodes,
    links,
  };
}
