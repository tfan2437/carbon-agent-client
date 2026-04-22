// lib/aggregations.ts — pure rollup helpers reused by analytics-panel tabs
//
// Activity-level data is the source of truth for everything below the
// emission_source layer. These helpers turn that flat data into shapes the
// chart and table components consume directly. Memoize the call sites with
// useMemo — the helpers themselves are intentionally side-effect-free.

import type {
  ActivityDataNode,
  EmissionType,
  GasEmission,
  GHGGraphData,
  GHGNode,
  MonthlyBreakdown,
  SourceType,
} from './types';

// ─── Node lookups ────────────────────────────────────────────────────

export function indexNodes(graph: GHGGraphData): Map<string, GHGNode> {
  const m = new Map<string, GHGNode>();
  for (const n of graph.nodes) m.set(n.id, n);
  return m;
}

export function activitiesUnderSource(
  graph: GHGGraphData,
  emissionSourceId: string,
): ActivityDataNode[] {
  const out: ActivityDataNode[] = [];
  for (const n of graph.nodes) {
    if (n.type === 'activity_data') {
      // emission_source id format: es-{fid}-{src}-{mat}
      // activity facility_id / source_code / material_code line up directly
      const parts = emissionSourceId.split('-');
      // shape: ['es', fid, src, mat]  (note: '-' is in fid like 'D00001' so use slice)
      // Safer: derive the expected es id from the activity itself.
      const expected = `es-${n.facility_id}-${n.source_code}-${n.material_code}`;
      if (expected === emissionSourceId) out.push(n);
      // touch parts to avoid unused warning when we keep the variable for clarity
      void parts;
    }
  }
  return out;
}

export function activitiesUnderFacility(
  graph: GHGGraphData,
  facilityId: string,
): ActivityDataNode[] {
  const out: ActivityDataNode[] = [];
  for (const n of graph.nodes) {
    if (n.type === 'activity_data' && n.facility_id === facilityId) out.push(n);
  }
  return out;
}

// ─── Time-series rollups ─────────────────────────────────────────────

/** 12-element [Jan..Dec] tCO₂e rollup over a set of activities, year-filtered. */
export function rollupMonthly(
  activities: ActivityDataNode[],
  year: number,
): number[] {
  const bucket = Array(12).fill(0) as number[];
  for (const a of activities) {
    if (a.year !== year) continue;
    if (Array.isArray(a.monthly_breakdown) && a.monthly_breakdown.length > 0) {
      for (const m of a.monthly_breakdown) {
        if (m.month >= 1 && m.month <= 12) {
          bucket[m.month - 1] += Number(m.emissions_tco2e ?? 0);
        }
      }
      continue;
    }
    const month = parseInt((a.period_start ?? '').slice(5, 7), 10);
    if (month >= 1 && month <= 12) {
      bucket[month - 1] += Number(a.emissions_tco2e ?? 0);
    }
  }
  return bucket;
}

/** Stacked monthly: returns one named series per source_type. */
export function rollupMonthlyBySourceType(
  activities: ActivityDataNode[],
  year: number,
): Record<SourceType, number[]> {
  const out: Record<string, number[]> = {};
  for (const a of activities) {
    if (a.year !== year) continue;
    if (!out[a.source_type]) out[a.source_type] = Array(12).fill(0);
    const bucket = out[a.source_type];
    if (Array.isArray(a.monthly_breakdown) && a.monthly_breakdown.length > 0) {
      for (const m of a.monthly_breakdown) {
        if (m.month >= 1 && m.month <= 12) {
          bucket[m.month - 1] += Number(m.emissions_tco2e ?? 0);
        }
      }
      continue;
    }
    const month = parseInt((a.period_start ?? '').slice(5, 7), 10);
    if (month >= 1 && month <= 12) {
      bucket[month - 1] += Number(a.emissions_tco2e ?? 0);
    }
  }
  return out as Record<SourceType, number[]>;
}

// ─── Categorical rollups ─────────────────────────────────────────────

export function rollupBySourceType(
  activities: ActivityDataNode[],
): Record<SourceType, number> {
  const out: Record<string, number> = {};
  for (const a of activities) {
    out[a.source_type] = (out[a.source_type] ?? 0) + Number(a.emissions_tco2e ?? 0);
  }
  return out as Record<SourceType, number>;
}

export function rollupByEmissionType(
  activities: ActivityDataNode[],
  graph: GHGGraphData,
): Record<EmissionType, number> {
  const idx = indexNodes(graph);
  const out: Record<string, number> = {};
  for (const a of activities) {
    const es = idx.get(`es-${a.facility_id}-${a.source_code}-${a.material_code}`);
    if (!es || es.type !== 'emission_source') continue;
    out[es.emission_type] = (out[es.emission_type] ?? 0) + Number(a.emissions_tco2e ?? 0);
  }
  return out as Record<EmissionType, number>;
}

// ─── Gas breakdown sum across activities ─────────────────────────────

export function sumGasBreakdown(activities: ActivityDataNode[]): GasEmission[] {
  const acc = new Map<string, GasEmission>();
  for (const a of activities) {
    for (const g of a.gas_breakdown ?? []) {
      const cur = acc.get(g.gas);
      if (!cur) {
        acc.set(g.gas, { ...g });
      } else {
        cur.emission_kg += g.emission_kg;
        cur.emission_co2e_kg += g.emission_co2e_kg;
        cur.emission_tco2e += g.emission_tco2e;
      }
    }
  }
  return Array.from(acc.values());
}

// ─── Top-N split: leave the long tail in a single "其他" bucket ──────

export interface TopNResult<T> {
  top: T[];
  rest: { count: number; total: number } | null;
}

export function topN<T>(
  items: T[],
  n: number,
  weight: (t: T) => number,
): TopNResult<T> {
  if (items.length <= n) return { top: items, rest: null };
  const sorted = [...items].sort((a, b) => weight(b) - weight(a));
  const top = sorted.slice(0, n);
  const tail = sorted.slice(n);
  return {
    top,
    rest: {
      count: tail.length,
      total: tail.reduce((s, t) => s + weight(t), 0),
    },
  };
}

// ─── Source-type-specific table aggregations ────────────────────────

export interface VehicleAgg {
  vehicle_plate: string | null;
  liters: number;
  amount: number;
  transactions: number;
}

export function rollupByVehicle(
  transactions: Array<Record<string, unknown>>,
): VehicleAgg[] {
  const m = new Map<string, VehicleAgg>();
  for (const tx of transactions) {
    const plate = (tx.vehicle_plate as string | null) ?? '—';
    const cur = m.get(plate) ?? {
      vehicle_plate: plate,
      liters: 0,
      amount: 0,
      transactions: 0,
    };
    cur.liters += Number(tx.liters ?? 0);
    cur.amount += Number(tx.amount ?? 0);
    cur.transactions += 1;
    m.set(plate, cur);
  }
  return Array.from(m.values()).sort((a, b) => b.liters - a.liters);
}

export interface DailyAgg {
  date: string;            // "YYYY-MM-DD"
  liters: number;
  amount: number;
  transactions: number;
}

export function rollupTransactionsByDay(
  transactions: Array<Record<string, unknown>>,
): DailyAgg[] {
  const m = new Map<string, DailyAgg>();
  for (const tx of transactions) {
    const ts = String(tx.transaction_at ?? '');
    if (!ts) continue;
    const date = ts.slice(0, 10);
    const cur = m.get(date) ?? { date, liters: 0, amount: 0, transactions: 0 };
    cur.liters += Number(tx.liters ?? 0);
    cur.amount += Number(tx.amount ?? 0);
    cur.transactions += 1;
    m.set(date, cur);
  }
  return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface DeptAgg {
  department: string;
  employee_count: number;
  total_hours: number;
  avg_hours: number;
}

export function rollupByDepartment(
  employees: Array<Record<string, unknown>>,
): DeptAgg[] {
  const m = new Map<string, DeptAgg>();
  for (const emp of employees) {
    const dept = (emp.employee_department as string | null) ?? '未分類';
    const cur = m.get(dept) ?? {
      department: dept,
      employee_count: 0,
      total_hours: 0,
      avg_hours: 0,
    };
    cur.employee_count += 1;
    cur.total_hours += Number(emp.total_hours ?? 0);
    m.set(dept, cur);
  }
  for (const v of m.values()) {
    v.avg_hours = v.employee_count > 0 ? v.total_hours / v.employee_count : 0;
  }
  return Array.from(m.values()).sort((a, b) => b.total_hours - a.total_hours);
}

export interface TitleAgg {
  title: string;
  employee_count: number;
  total_hours: number;
}

export function rollupByTitle(
  employees: Array<Record<string, unknown>>,
): TitleAgg[] {
  const m = new Map<string, TitleAgg>();
  for (const emp of employees) {
    const title = (emp.employee_title as string | null) ?? '未分類';
    const cur = m.get(title) ?? { title, employee_count: 0, total_hours: 0 };
    cur.employee_count += 1;
    cur.total_hours += Number(emp.total_hours ?? 0);
    m.set(title, cur);
  }
  return Array.from(m.values()).sort((a, b) => b.total_hours - a.total_hours);
}

/** Equal-width histogram over hours-per-employee for the work_hours visualization. */
export function hoursHistogram(
  employees: Array<Record<string, unknown>>,
  bucketCount = 12,
): Array<{ bucket: string; count: number; lo: number; hi: number }> {
  const hours = employees.map((e) => Number(e.total_hours ?? 0));
  if (hours.length === 0) return [];
  const min = Math.min(...hours);
  const max = Math.max(...hours);
  if (min === max) return [{ bucket: `${min.toFixed(0)}h`, count: hours.length, lo: min, hi: max }];
  const width = (max - min) / bucketCount;
  const out = Array.from({ length: bucketCount }, (_, i) => {
    const lo = min + i * width;
    const hi = i === bucketCount - 1 ? max : lo + width;
    return { bucket: `${lo.toFixed(0)}-${hi.toFixed(0)}h`, count: 0, lo, hi };
  });
  for (const h of hours) {
    let idx = Math.floor((h - min) / width);
    if (idx >= bucketCount) idx = bucketCount - 1;
    out[idx].count += 1;
  }
  return out;
}

// ─── Refrigerant monthly extractor ──────────────────────────────────
// Refrigerant activities always carry a 12-slice monthly_breakdown.

export function refrigerantMonthly(activity: ActivityDataNode): number[] {
  const bucket = Array(12).fill(0) as number[];
  if (!Array.isArray(activity.monthly_breakdown)) return bucket;
  for (const m of activity.monthly_breakdown as MonthlyBreakdown[]) {
    if (m.month >= 1 && m.month <= 12) {
      bucket[m.month - 1] += Number(m.emissions_tco2e ?? 0);
    }
  }
  return bucket;
}
