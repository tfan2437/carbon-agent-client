'use client';

import { useMemo } from 'react';
import { ActivityDataNode, GHGGraphData } from '@/lib/types';
import { usePii } from '../pii-context';

interface Props {
  activity: ActivityDataNode;
  graph: GHGGraphData;
}

interface ElectricitySummary {
  customer_number?: string;
  service_address?: string;
  pricing_type?: string;
  tou_type?: string | null;
  total_consumption_kwh?: number;
  total_amount_twd?: number;
  segments?: {
    peak_kwh?: number | null;
    off_peak_kwh?: number | null;
    half_peak_kwh?: number | null;
    saturday_half_peak_kwh?: number | null;
    regular_kwh?: number | null;
  };
  extraction_confidence?: number;
}

const SEGMENT_COLORS: Record<string, string> = {
  peak_kwh: '#EF4444',
  half_peak_kwh: '#F59E0B',
  saturday_half_peak_kwh: '#A78BFA',
  off_peak_kwh: '#3B82F6',
  regular_kwh: '#6B7280',
};

const SEGMENT_LABELS: Record<string, string> = {
  peak_kwh: '尖峰',
  half_peak_kwh: '半尖峰',
  saturday_half_peak_kwh: '週六半尖峰',
  off_peak_kwh: '離峰',
  regular_kwh: '無時段',
};

export function DetailElectricity({ activity, graph }: Props) {
  const { unlocked, unmasked } = usePii();
  const showRaw = unlocked && unmasked;
  const summary = activity.extraction_summary as ElectricitySummary;
  const total = Number(summary?.total_consumption_kwh ?? activity.activity_value ?? 0);
  const amount = Number(summary?.total_amount_twd ?? 0);

  const maskCustomerNumber = (n: string | undefined): string => {
    if (!n) return '—';
    if (showRaw) return n;
    if (n.length <= 6) return n;
    return `${n.slice(0, 4)}…${n.slice(-2)}`;
  };

  const segments = useMemo(() => {
    const seg = summary?.segments ?? {};
    return Object.entries(seg)
      .filter(([, v]) => v != null && Number(v) > 0)
      .map(([k, v]) => ({
        key: k,
        label: SEGMENT_LABELS[k] ?? k,
        color: SEGMENT_COLORS[k] ?? '#6B7280',
        kwh: Number(v),
        pct: total > 0 ? (Number(v) / total) * 100 : 0,
      }));
  }, [summary, total]);

  // Sibling activities — cross-year electricity bills produce 2 entries
  const siblings = useMemo(
    () =>
      graph.nodes.filter(
        (n) =>
          n.type === 'activity_data' &&
          n.document_id === activity.document_id &&
          n.id !== activity.id,
      ) as ActivityDataNode[],
    [graph, activity],
  );

  return (
    <div>
      <section className="px-5 py-4 border-b border-white/5 grid grid-cols-2 gap-3">
        <Stat label="度數" value={total.toLocaleString()} unit="kWh" />
        <Stat label="金額" value={amount.toLocaleString()} unit="TWD" />
        <Stat label="計費期間" value={activity.period_label} />
        <Stat
          label="電價類型"
          value={summary?.pricing_type ?? '—'}
          unit={summary?.tou_type ?? undefined}
        />
      </section>

      {summary?.extraction_confidence != null && (
        <section className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-gray-500">抽取信心度</span>
          <ConfidenceBadge value={summary.extraction_confidence} />
        </section>
      )}

      {segments.length > 0 && (
        <section className="px-5 py-4 border-b border-white/5">
          <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-3">時段使用</h3>
          <div className="flex h-6 rounded-md overflow-hidden">
            {segments.map((s) => (
              <div
                key={s.key}
                className="relative group"
                style={{ width: `${s.pct}%`, backgroundColor: s.color, minWidth: 4 }}
                title={`${s.label} · ${s.kwh.toLocaleString()} kWh (${s.pct.toFixed(1)}%)`}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {segments.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="text-gray-300">{s.label}</span>
                <span className="text-gray-400 tabular-nums ml-auto">
                  {s.kwh.toLocaleString()} ({s.pct.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="px-5 py-4 border-b border-white/5">
        <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">用電戶資訊</h3>
        <div className="space-y-1.5 text-sm">
          <Field label="電號" value={maskCustomerNumber(summary?.customer_number)} mono />
          <Field label="用電地址" value={summary?.service_address ?? '—'} />
        </div>
      </section>

      {siblings.length > 0 && (
        <section className="px-5 py-4 border-b border-white/5">
          <h3 className="text-[11px] uppercase tracking-wider text-amber-400 mb-2">⚠ 跨年度帳單</h3>
          <div className="text-xs text-gray-300">
            此電費帳單跨越 {siblings.length + 1} 個年度,已按日數比例分配。
          </div>
          <div className="mt-2 space-y-1">
            {siblings.map((s) => (
              <div key={s.id} className="text-xs text-gray-400">
                · {s.period_label} · {s.activity_value.toLocaleString()} kWh · {s.emissions_tco2e.toLocaleString(undefined, { maximumFractionDigits: 4 })} tCO₂e
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="px-5 py-4">
        <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">排放計算</h3>
        <Field
          label="活動量"
          value={`${activity.activity_value.toLocaleString()} ${activity.activity_unit}`}
        />
        <Field
          label="排放係數"
          value={`${activity.emission_factor.value} ${activity.emission_factor.unit}`}
        />
        <Field label="總排放" value={`${activity.emissions_tco2e.toLocaleString(undefined, { maximumFractionDigits: 4 })} tCO₂e`} />
      </section>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-base text-white tabular-nums truncate">
        {value}
        {unit && <span className="text-xs text-gray-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs text-gray-200 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = value * 100;
  const tier =
    pct >= 95
      ? { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: '高' }
      : pct >= 80
        ? { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: '中' }
        : { color: 'bg-rose-500/15 text-rose-400 border-rose-500/30', label: '低' };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded border tabular-nums font-medium ${tier.color}`}
      title="由 OCR / 規則 推算的萃取準確度"
    >
      {tier.label} · {pct.toFixed(2)}%
    </span>
  );
}
