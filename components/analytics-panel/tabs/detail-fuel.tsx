'use client';

import { useMemo, useState } from 'react';
import { ActivityDataNode } from '@/lib/types';
import { rollupTransactionsByDay, rollupByVehicle, topN } from '@/lib/aggregations';
import { maskPlate } from '@/lib/pii';
import { usePii } from '../pii-context';
import { Pagination, usePagination } from './pagination';

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
  amount_currency?: string;
  odometer_km?: number | null;
  row_index?: number;
}

interface OdometerJump {
  vehicle_plate: string | null;
  jump_km: number;
  from_km: number;
  to_km: number;
  date: string;
}

export function DetailFuel({ activity }: Props) {
  const { unlocked, unmasked } = usePii();
  const showRaw = unlocked && unmasked;

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
  const odometerJumps = useMemo(() => detectOdometerJumps(transactions), [transactions]);

  const totalLiters = summary?.total_liters ?? transactions.reduce((s, t) => s + Number(t.liters ?? 0), 0);
  const totalAmount = transactions.reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const avgL = transactions.length > 0 ? totalLiters / transactions.length : 0;

  const pager = usePagination<FuelTransaction>(transactions.length, 50);
  const visibleTx = useMemo(() => pager.slice(transactions), [pager, transactions]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Display plate value, applying masking when raw view is off
  const displayPlate = (p: string | null | undefined) =>
    showRaw ? (p ?? '—') : (maskPlate(p) ?? '—');
  const displayDriver = (n: string | null | undefined) =>
    showRaw ? (n ?? '—') : '***';

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

      {/* Odometer outliers (Phase 3a) */}
      {odometerJumps.length > 0 && (
        <section className="px-5 py-4 border-b border-white/5">
          <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">里程跳動 (Top 5)</h3>
          <div className="space-y-1">
            {odometerJumps.slice(0, 5).map((j, i) => (
              <div key={i} className="flex justify-between gap-2 text-xs">
                <span className="text-gray-200 font-mono truncate">{displayPlate(j.vehicle_plate)}</span>
                <span className="text-gray-400 tabular-nums whitespace-nowrap">
                  {j.from_km.toLocaleString()} → {j.to_km.toLocaleString()}
                  <span className="text-amber-400 ml-1">+{j.jump_km.toLocaleString()} km</span>
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-2">
            連續加油間里程差異最大者,可用於異常檢查。
          </p>
        </section>
      )}

      {/* Transaction table */}
      <section className="px-2 py-3">
        <div className="flex items-center justify-between px-3 mb-2">
          <h3 className="text-[11px] uppercase tracking-wider text-gray-500">交易紀錄</h3>
          <span className="text-[10px] text-gray-600">點 ▸ 展開明細</span>
        </div>
        <table className="w-full text-xs">
          <thead className="border-b border-white/5">
            <tr>
              <th className="w-5" />
              <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-gray-500">時間</th>
              <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-gray-500">車牌</th>
              <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider text-gray-500">公升</th>
              <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider text-gray-500">金額</th>
            </tr>
          </thead>
          <tbody>
            {visibleTx.map((tx, i) => {
              const absoluteIdx = pager.page * pager.pageSize + i;
              const isOpen = expanded.has(absoluteIdx);
              return (
                <RowFragment
                  key={absoluteIdx}
                  tx={tx}
                  isOpen={isOpen}
                  onToggle={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(absoluteIdx)) next.delete(absoluteIdx);
                      else next.add(absoluteIdx);
                      return next;
                    })
                  }
                  displayPlate={displayPlate}
                  displayDriver={displayDriver}
                />
              );
            })}
          </tbody>
        </table>
        <Pagination
          total={transactions.length}
          page={pager.page}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
        />
        {!unlocked && (
          <p className="px-3 py-2 text-[10px] text-gray-600">
            車牌已遮罩 (`VFH-***`);駕駛欄位已隱藏。完整資料需 `?pii=1` URL 參數。
          </p>
        )}
      </section>
    </div>
  );
}

function RowFragment({
  tx,
  isOpen,
  onToggle,
  displayPlate,
  displayDriver,
}: {
  tx: FuelTransaction;
  isOpen: boolean;
  onToggle: () => void;
  displayPlate: (p: string | null | undefined) => string;
  displayDriver: (n: string | null | undefined) => string;
}) {
  return (
    <>
      <tr
        className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-1 py-1 text-[10px] text-gray-500 select-none">{isOpen ? '▾' : '▸'}</td>
        <td className="px-2 py-1 text-gray-400 whitespace-nowrap">
          {(tx.transaction_at ?? '').slice(0, 16).replace('T', ' ')}
        </td>
        <td className="px-2 py-1 text-gray-200 font-mono">{displayPlate(tx.vehicle_plate)}</td>
        <td className="px-2 py-1 text-right text-gray-300 tabular-nums">
          {Number(tx.liters ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </td>
        <td className="px-2 py-1 text-right text-gray-400 tabular-nums">
          {Number(tx.amount ?? 0).toLocaleString()}
          {tx.amount_currency && tx.amount_currency !== 'TWD' && (
            <span className="text-[9px] text-gray-600 ml-0.5">{tx.amount_currency}</span>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-white/[0.03]">
          <td />
          <td colSpan={4} className="px-2 py-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <KV label="駕駛" value={displayDriver(tx.driver_name)} />
              <KV label="駕駛 ID" value={displayDriver(tx.driver_id)} mono />
              <KV
                label="里程"
                value={tx.odometer_km != null ? `${Number(tx.odometer_km).toLocaleString()} km` : '—'}
              />
              <KV label="原始列號" value={tx.row_index != null ? `#${tx.row_index}` : '—'} mono />
              {tx.amount_currency && <KV label="幣別" value={tx.amount_currency} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className={`text-gray-300 ${mono ? 'font-mono text-[10px]' : ''}`}>{value}</span>
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

// ─── Helpers ────────────────────────────────────────────────────────

function detectOdometerJumps(transactions: FuelTransaction[]): OdometerJump[] {
  // Group by vehicle, sort by transaction_at, compute consecutive deltas.
  const byVehicle = new Map<string, FuelTransaction[]>();
  for (const t of transactions) {
    if (t.odometer_km == null || !t.vehicle_plate) continue;
    const key = String(t.vehicle_plate);
    if (!byVehicle.has(key)) byVehicle.set(key, []);
    byVehicle.get(key)!.push(t);
  }
  const jumps: OdometerJump[] = [];
  for (const [plate, txs] of byVehicle) {
    const sorted = [...txs].sort((a, b) => (a.transaction_at ?? '').localeCompare(b.transaction_at ?? ''));
    for (let i = 1; i < sorted.length; i++) {
      const prev = Number(sorted[i - 1].odometer_km ?? 0);
      const curr = Number(sorted[i].odometer_km ?? 0);
      const delta = curr - prev;
      if (delta > 0) {
        jumps.push({
          vehicle_plate: plate,
          jump_km: delta,
          from_km: prev,
          to_km: curr,
          date: (sorted[i].transaction_at ?? '').slice(0, 10),
        });
      }
    }
  }
  return jumps.sort((a, b) => b.jump_km - a.jump_km);
}
