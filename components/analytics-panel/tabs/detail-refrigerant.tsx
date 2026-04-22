'use client';

import { useMemo } from 'react';
import { ActivityDataNode } from '@/lib/types';
import { refrigerantMonthly } from '@/lib/aggregations';
import { MonthlyChart } from './monthly-chart';

interface Props {
  activity: ActivityDataNode;
}

interface RefrigerantEquipment {
  equipment_location?: string;
  equipment_type?: string;
  equipment_brand?: string;
  equipment_model?: string;
  refrigerant_type?: string;
  refrigerant_charge?: number;
  refrigerant_charge_unit?: 'g' | 'kg';
  evidence_ref?: string;
}

export function DetailRefrigerant({ activity }: Props) {
  const ext = activity.extraction as Record<string, unknown> | null;
  const items: RefrigerantEquipment[] = useMemo(
    () => (Array.isArray(ext?.equipment_items) ? (ext!.equipment_items as RefrigerantEquipment[]) : []),
    [ext],
  );
  const summary = activity.extraction_summary as {
    supply_type?: string;
    total_equipment_count?: number;
    total_charge_kg?: number;
  };

  const monthly = useMemo(() => refrigerantMonthly(activity), [activity]);

  return (
    <div>
      <section className="px-5 py-4 border-b border-white/5 grid grid-cols-3 gap-3">
        <Stat label="設備類型" value={summary?.supply_type ?? '—'} />
        <Stat label="設備數" value={String(summary?.total_equipment_count ?? items.length)} unit="台" />
        <Stat label="總充填量" value={(summary?.total_charge_kg ?? 0).toFixed(3)} unit="kg" />
      </section>

      <section className="px-5 py-4 border-b border-white/5">
        <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">月度排放</h3>
        <MonthlyChart data={monthly} unit="tCO₂e" height={120} />
        <p className="text-[10px] text-gray-500 mt-2">
          冷媒按 12 個月平均分配 (年度快照)。
        </p>
      </section>

      <section className="px-5 py-4">
        <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">設備清單</h3>
        <div className="space-y-2">
          {items.map((eq, i) => {
            const charge = Number(eq.refrigerant_charge ?? 0);
            const unit = eq.refrigerant_charge_unit ?? 'g';
            const display = unit === 'g' && charge >= 1000
              ? `${(charge / 1000).toFixed(2)} kg`
              : `${charge.toLocaleString()} ${unit}`;
            return (
              <div key={i} className="bg-white/5 border border-white/5 rounded-lg p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm text-gray-200 truncate">
                    {eq.equipment_location ?? '—'} · {eq.equipment_type ?? '—'}
                  </div>
                  <div className="text-xs text-gray-300 tabular-nums whitespace-nowrap">{display}</div>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {[eq.equipment_brand, eq.equipment_model].filter(Boolean).join(' ')}
                </div>
                <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-3">
                  <span>冷媒: <span className="text-gray-300">{eq.refrigerant_type ?? '—'}</span></span>
                  {eq.evidence_ref && (
                    <span className="font-mono text-gray-600">ref: {eq.evidence_ref}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
