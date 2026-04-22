'use client';

import { useMemo, useState } from 'react';
import { ActivityDataNode } from '@/lib/types';
import { hoursHistogram, rollupByDepartment, rollupByTitle } from '@/lib/aggregations';
import { usePii } from '../pii-context';
import { Pagination, usePagination } from './pagination';

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

  // Department filter (Phase 3d) — toggle row in 部門人時 to filter the employee table.
  const [deptFilter, setDeptFilter] = useState<string | null>(null);

  const filteredEmployees = useMemo(
    () =>
      deptFilter ? employees.filter((e) => e.employee_department === deptFilter) : employees,
    [employees, deptFilter],
  );

  const pager = usePagination<Employee>(filteredEmployees.length, 50);
  const visible = useMemo(() => pager.slice(filteredEmployees), [pager, filteredEmployees]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  return (
    <div>
      <section className="px-5 py-4 border-b border-white/5 grid grid-cols-2 gap-3">
        <Stat label="員工總數" value={String(summary?.employee_count ?? employees.length)} unit="人" />
        <Stat label="總人時" value={totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} unit="hr" />
        <Stat label="平均人時/員工" value={avg.toFixed(1)} unit="hr" />
        <Stat label="人時範圍" value={`${minH.toFixed(0)} – ${maxH.toFixed(0)}`} unit="hr" />
      </section>

      <section className="px-5 py-4 border-b border-white/5">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-[11px] uppercase tracking-wider text-gray-500">部門人時</h3>
          {deptFilter && (
            <button
              onClick={() => setDeptFilter(null)}
              className="text-[10px] text-gray-400 hover:text-white"
            >
              清除篩選 ✕
            </button>
          )}
        </div>
        <table className="w-full text-xs">
          <thead className="border-b border-white/5">
            <tr>
              <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-gray-500">部門</th>
              <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider text-gray-500">員工數</th>
              <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider text-gray-500">總人時</th>
              <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider text-gray-500">平均</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {byDept.map((d) => {
              const isFiltered = deptFilter === d.department;
              return (
                <tr
                  key={d.department}
                  className={[
                    'border-b border-white/5 cursor-pointer transition-colors',
                    isFiltered ? 'bg-white/10' : 'hover:bg-white/5',
                  ].join(' ')}
                  onClick={() => setDeptFilter(isFiltered ? null : d.department)}
                  title={
                    showRaw
                      ? `${isFiltered ? '取消' : '套用'}員工表篩選: ${d.department}`
                      : '解鎖 PII 後可篩選員工表'
                  }
                >
                  <td className="px-2 py-1 text-gray-200">{d.department}</td>
                  <td className="px-2 py-1 text-right text-gray-300 tabular-nums">{d.employee_count}</td>
                  <td className="px-2 py-1 text-right text-gray-300 tabular-nums">
                    {d.total_hours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-400 tabular-nums">
                    {d.avg_hours.toFixed(1)}
                  </td>
                  <td className="px-1 text-[10px] text-gray-600">{isFiltered ? '✓' : '→'}</td>
                </tr>
              );
            })}
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
          <div className="flex items-baseline justify-between px-3 mb-2">
            <h3 className="text-[11px] uppercase tracking-wider text-amber-400">
              員工資料 (PII)
              {deptFilter && (
                <span className="text-gray-500 normal-case ml-2 text-[10px]">
                  · 篩選: {deptFilter} ({filteredEmployees.length})
                </span>
              )}
            </h3>
            <span className="text-[10px] text-gray-600">點 ▸ 展開明細</span>
          </div>
          <table className="w-full text-xs">
            <thead className="border-b border-white/5">
              <tr>
                <th className="w-5" />
                <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-gray-500">編號</th>
                <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-gray-500">姓名</th>
                <th className="px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-gray-500">部門</th>
                <th className="px-2 py-1.5 text-right text-[10px] uppercase tracking-wider text-gray-500">人時</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e, i) => {
                const absoluteIdx = pager.page * pager.pageSize + i;
                const isOpen = expanded.has(absoluteIdx);
                return (
                  <EmployeeRow
                    key={absoluteIdx}
                    employee={e}
                    isOpen={isOpen}
                    onToggle={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(absoluteIdx)) next.delete(absoluteIdx);
                        else next.add(absoluteIdx);
                        return next;
                      })
                    }
                  />
                );
              })}
            </tbody>
          </table>
          <Pagination
            total={filteredEmployees.length}
            page={pager.page}
            pageSize={pager.pageSize}
            onPageChange={pager.setPage}
            onPageSizeChange={pager.setPageSize}
          />
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

function EmployeeRow({
  employee,
  isOpen,
  onToggle,
}: {
  employee: Employee;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-1 py-1 text-[10px] text-gray-500 select-none">{isOpen ? '▾' : '▸'}</td>
        <td className="px-2 py-1 text-gray-400 font-mono text-[10px]">{employee.employee_id ?? '—'}</td>
        <td className="px-2 py-1 text-gray-200">{employee.employee_name ?? '—'}</td>
        <td className="px-2 py-1 text-gray-400 text-[10px] truncate">{employee.employee_department}</td>
        <td className="px-2 py-1 text-right text-gray-300 tabular-nums">
          {Number(employee.total_hours ?? 0).toFixed(1)}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-white/[0.03]">
          <td />
          <td colSpan={4} className="px-2 py-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <KV label="部門" value={employee.employee_department ?? '—'} />
              <KV label="職務" value={employee.employee_title ?? '—'} />
              <KV
                label="人時"
                value={`${Number(employee.total_hours ?? 0).toFixed(2)} hr`}
              />
              <KV label="員工編號" value={employee.employee_id ?? '—'} mono />
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
