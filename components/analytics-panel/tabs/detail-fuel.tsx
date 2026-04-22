'use client';

import { useMemo, useState } from 'react';
import { ActivityDataNode } from '@/lib/types';
import { rollupTransactionsByDay, rollupByVehicle, topN } from '@/lib/aggregations';
import { maskPlate } from '@/lib/pii';
import { usePii } from '../pii-context';

interface Props {
  activity: ActivityDataNode;
}

interface FuelTransaction extends Record<string, unknown> {
  transaction_at?: string;
  vehicle_plate?: string | null;
  driver_name?: string | null;
  driver_id?: string | null;
  liters?: number;
  amount?: number;
}

export function DetailFuel({ activity }: Props) {
  const { unlocked, unmasked } = usePii();
  const showRaw = unlocked && unmasked;
  const [showAllTx, setShowAllTx] = useState(false);

  const ext = activity.extraction as Record<string, unknown> | null;
  const transactions: FuelTransaction[] = useMemo(
    () => (Array.isArray(ext?.transactions) ? (ext!.transactions as FuelTransaction[]) : []),
    [ext],
  );

  const summary = activity.extraction_summary as {
    fuel_type?: string;
    supply_type?: string;
    total_liters?: number;
    total_records?: number;
    equipment_count?: number;
  };

  const daily = useMemo(() => rollupTransactionsByDay(transactions), [transactions]);
  const byVehicle = useMemo(() => rollupByVehicle(transactions), [transactions]);
  const top = useMemo(() => topN(byVehicle, 5, (v) => v.liters), [byVehicle]);

  const totalLiters = summary?.total_liters ?? transactions.reduce((s, t) => s + Number(t.liters ?? 0), 0);
  const totalAmount = transactions.reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const avgL = transactions.length > 0 ? totalLiters / transactions.length : 0;

  // Display plate value, applying masking when raw view is off
  const displayPlate = (p: string | null | undefined) =>
    showRaw ? (p ?? '—') : (maskPlate(p) ?? '—');

  return (
    <div>
      {/* Top stats */}
      <section className="px-5 py-4 border-b border-white/5 grid grid-cols-2 gap-3">
        <Stat label="總公升數" value={totalLiters.toLocaleString(undefined, { maximumFractionDigits: 1 })} unit="L" />
        <Stat label="總金額" value={totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} unit="TWD" />
        <Stat label="交易筆數" value={transactions.length.toLocaleString()} unit="筆" />
        <Stat label="車輛數" value={String(summary?.equipment_count ?? byVehicle.length)} unit="輛" />
        <Stat label="平均每筆" value={avgL.toFixed(1)} unit="L/筆" />
        <Stat label="燃料類型" value={summary?.fuel_type ?? '—'} unit={summary?.supply_type} />
      </section>

      {/* Daily breakdown */}
      {daily.length > 0 && (
        <section className="px-5 py-4 border-b border-white/5">
          <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-3">每日加油</h3>
          <div className="flex items-end gap-1 h-24">
            {daily.map((d) => {
              const max = Math.max(...daily.map((x) => x.liters));
              const h = max > 0 ? (d.liters / max) * 100 : 0;
              return (
                <div
                  key={d.date}
                  className="flex-1 group relative"
                  title={`${d.date} · ${d.liters.toLocaleString()} L · ${d.transactions} 筆`}
                >
                  <div
                    className="bg-amber-500/70 hover:bg-amber-400 transition-colors rounded-t-sm"
                    style={{ height: `${h}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-gray-500">
            <span>{daily[0]?.date}</span>
            <span>{daily[daily.length - 1]?.date}</span>
          </div>
        </section>
      )}

      {/* Top vehicles */}
      {top.top.length > 0 && (
        <section className="px-5 py-4 border-b border-white/5">
          <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">用油最多 (Top 5)</h3>
          <div className="space-y-1.5">
            {top.top.map((v) => (
              <div key={v.vehicle_plate ?? 'unknown'} className="flex justify-between text-xs">
                <span className="text-gray-200 font-mono">{displayPlate(v.vehicle_plate)}</span>
                <span className="text-gray-400 tabular-nums">
                  {v.liters.toLocaleString(undefined, { maximumFractionDigits: 1 })} L · {v.transactions} 筆
                </span>
              </div>
            ))}
            {top.rest && (
              <div className="flex justify-between text-xs text-gray-500 italic">
                <span>其他 {top.rest.count} 輛</span>
                <span className="tabular-nums">
                  {top.rest.total.toLocaleString(undefined, { maximumFractionDigits: 1 })} L
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Transaction table */}
      <section className="px-2 py-3">
        <div className="flex items-center justify-between px-3 mb-2">
          <h3 className="text-[11px] uppercase tracking-wider text-gray-500">交易紀錄</h3>
          {transactions.length > 30 && (
            <button
              onClick={() => setShowAllTx((v) => !v)}
              className="text-[10px] text-gray-400 hover:text-white"
            >
              {showAllTx ? '只顯示前 30 筆' : `顯示全部 ${transactions.length} 筆`}
            </button>
          )}
        </div>
        <table className="w-full text-xs">
          <thead className="border-b border-white/5">
            <tr>
              <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-gray-500">時間</th>
              <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-gray-500">車牌</th>
              <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider text-gray-500">公升</th>
              <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider text-gray-500">金額</th>
            </tr>
          </thead>
          <tbody>
            {(showAllTx ? transactions : transactions.slice(0, 30)).map((tx, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-2 py-1 text-gray-400 whitespace-nowrap">
                  {(tx.transaction_at ?? '').slice(0, 16).replace('T', ' ')}
                </td>
                <td className="px-2 py-1 text-gray-200 font-mono">{displayPlate(tx.vehicle_plate)}</td>
                <td className="px-2 py-1 text-right text-gray-300 tabular-nums">
                  {Number(tx.liters ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="px-2 py-1 text-right text-gray-400 tabular-nums">
                  {Number(tx.amount ?? 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!unlocked && (
          <p className="px-3 py-2 text-[10px] text-gray-600">
            車牌已遮罩 (`VFH-***`);駕駛欄位已隱藏。完整資料需 `?pii=1` URL 參數。
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-base text-white tabular-nums">
        {value}
        {unit && <span className="text-xs text-gray-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}
