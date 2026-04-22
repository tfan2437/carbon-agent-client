'use client';

import { useMemo } from 'react';
import { ActivityDataNode } from '@/lib/types';
import { hoursHistogram, rollupByDepartment, rollupByTitle } from '@/lib/aggregations';
import { usePii } from '../pii-context';

interface Props {
  activity: ActivityDataNode;
}

interface Employee {
  employee_id?: string;
  employee_name?: string | null;
  employee_department?: string;
  employee_title?: string;
  total_hours?: number;
}

export function DetailWorkHours({ activity }: Props) {
  const { unlocked, unmasked } = usePii();
  const showRaw = unlocked && unmasked;

  const ext = activity.extraction as Record<string, unknown> | null;
  const employees: Employee[] = useMemo(
    () => (Array.isArray(ext?.employees) ? (ext!.employees as Employee[]) : []),
    [ext],
  );
  const summary = activity.extraction_summary as {
    doc_type_code?: string;
    employee_count?: number;
    total_hours?: number;
  };

  const totalHours = summary?.total_hours ?? employees.reduce((s, e) => s + Number(e.total_hours ?? 0), 0);
  const avg = employees.length > 0 ? totalHours / employees.length : 0;
  const hoursList = employees.map((e) => Number(e.total_hours ?? 0));
  const minH = hoursList.length ? Math.min(...hoursList) : 0;
  const maxH = hoursList.length ? Math.max(...hoursList) : 0;

  const byDept = useMemo(() => rollupByDepartment(employees as Array<Record<string, unknown>>), [employees]);
  const byTitle = useMemo(() => rollupByTitle(employees as Array<Record<string, unknown>>), [employees]);
  const histogram = useMemo(() => hoursHistogram(employees as Array<Record<string, unknown>>, 10), [employees]);
  const histMax = Math.max(1, ...histogram.map((h) => h.count));

  return (
    <div>
      <section className="px-5 py-4 border-b border-white/5 grid grid-cols-2 gap-3">
        <Stat label="員工總數" value={String(summary?.employee_count ?? employees.length)} unit="人" />
        <Stat label="總人時" value={totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} unit="hr" />
        <Stat label="平均人時/員工" value={avg.toFixed(1)} unit="hr" />
        <Stat label="人時範圍" value={`${minH.toFixed(0)} – ${maxH.toFixed(0)}`} unit="hr" />
      </section>

      <section className="px-5 py-4 border-b border-white/5">
        <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">部門人時</h3>
        <table className="w-full text-xs">
          <thead className="border-b border-white/5">
            <tr>
              <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-gray-500">部門</th>
              <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider text-gray-500">員工數</th>
              <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider text-gray-500">總人時</th>
              <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider text-gray-500">平均</th>
            </tr>
          </thead>
          <tbody>
            {byDept.map((d) => (
              <tr key={d.department} className="border-b border-white/5">
                <td className="px-2 py-1 text-gray-200">{d.department}</td>
                <td className="px-2 py-1 text-right text-gray-300 tabular-nums">{d.employee_count}</td>
                <td className="px-2 py-1 text-right text-gray-300 tabular-nums">
                  {d.total_hours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </td>
                <td className="px-2 py-1 text-right text-gray-400 tabular-nums">
                  {d.avg_hours.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {byTitle.length > 0 && (
        <section className="px-5 py-4 border-b border-white/5">
          <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">職務人時</h3>
          <div className="space-y-1">
            {byTitle.map((t) => (
              <div key={t.title} className="flex justify-between text-xs">
                <span className="text-gray-200">{t.title}</span>
                <span className="text-gray-400 tabular-nums">
                  {t.employee_count} 人 · {t.total_hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hr
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {histogram.length > 0 && (
        <section className="px-5 py-4 border-b border-white/5">
          <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">人時分布</h3>
          <div className="flex items-end gap-1 h-20">
            {histogram.map((b, i) => (
              <div key={i} className="flex-1 group relative" title={`${b.bucket} · ${b.count} 人`}>
                <div
                  className="bg-violet-500/70 hover:bg-violet-400 rounded-t-sm"
                  style={{ height: `${(b.count / histMax) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-gray-500">
            <span>{histogram[0]?.lo.toFixed(0)} h</span>
            <span>{histogram[histogram.length - 1]?.hi.toFixed(0)} h</span>
          </div>
        </section>
      )}

      {showRaw && employees.length > 0 && (
        <section className="px-2 py-3">
          <h3 className="px-3 text-[11px] uppercase tracking-wider text-amber-400 mb-2">員工資料 (PII)</h3>
          <table className="w-full text-xs">
            <thead className="border-b border-white/5">
              <tr>
                <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-gray-500">編號</th>
                <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-gray-500">姓名</th>
                <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-gray-500">部門 / 職務</th>
                <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider text-gray-500">人時</th>
              </tr>
            </thead>
            <tbody>
              {employees.slice(0, 100).map((e, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="px-2 py-1 text-gray-400 font-mono text-[10px]">{e.employee_id ?? '—'}</td>
                  <td className="px-2 py-1 text-gray-200">{e.employee_name ?? '—'}</td>
                  <td className="px-2 py-1 text-gray-400 text-[10px]">
                    {e.employee_department} / {e.employee_title}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-300 tabular-nums">
                    {Number(e.total_hours ?? 0).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {employees.length > 100 && (
            <p className="px-3 py-2 text-[10px] text-gray-500">僅顯示前 100 筆 / 共 {employees.length} 筆</p>
          )}
        </section>
      )}

      {!unlocked && (
        <p className="px-5 py-3 text-[10px] text-gray-600">
          員工姓名已隱藏。完整名冊需 `?pii=1` URL 參數並開啟解鎖。
        </p>
      )}
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
