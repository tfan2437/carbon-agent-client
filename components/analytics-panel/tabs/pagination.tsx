'use client';

import { useState } from 'react';

interface Props {
  total: number;
  page: number;             // 0-indexed
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (n: number) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_OPTIONS = [25, 50, 100];

export function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_OPTIONS,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const canPrev = safePage > 0;
  const canNext = safePage < pageCount - 1;
  const startRow = total === 0 ? 0 : safePage * pageSize + 1;
  const endRow = Math.min(total, (safePage + 1) * pageSize);

  return (
    <div className="px-3 py-2 flex items-center justify-between gap-3 text-[11px] text-gray-400 border-t border-white/5">
      <div className="tabular-nums whitespace-nowrap">
        {total === 0 ? '無資料' : <>共 {total.toLocaleString()} 筆 · {startRow.toLocaleString()}–{endRow.toLocaleString()}</>}
      </div>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <div className="flex items-center gap-1">
            {pageSizeOptions.map((n) => (
              <button
                key={n}
                onClick={() => onPageSizeChange(n)}
                className={[
                  'px-1.5 py-0.5 rounded text-[10px] tabular-nums transition-colors',
                  n === pageSize
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5',
                ].join(' ')}
                title={`每頁 ${n} 筆`}
              >
                {n}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => canPrev && onPageChange(safePage - 1)}
            disabled={!canPrev}
            className="px-1.5 py-0.5 rounded text-gray-300 hover:bg-white/10 disabled:text-gray-700 disabled:hover:bg-transparent"
            title="上一頁"
          >
            ◀
          </button>
          <span className="tabular-nums whitespace-nowrap text-gray-500">
            {safePage + 1} / {pageCount}
          </span>
          <button
            onClick={() => canNext && onPageChange(safePage + 1)}
            disabled={!canNext}
            className="px-1.5 py-0.5 rounded text-gray-300 hover:bg-white/10 disabled:text-gray-700 disabled:hover:bg-transparent"
            title="下一頁"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────

export interface PaginationState<T> {
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  slice: (arr: T[]) => T[];
  total: number;
}

export function usePagination<T>(total: number, defaultSize = 50): PaginationState<T> {
  const [rawPage, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultSize);

  // Derive a safe page during render — avoids the cascading-render hazard
  // of resetting page state in an effect when total/pageSize shrinks.
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(rawPage, pageCount - 1);

  const slice = (arr: T[]) => arr.slice(page * pageSize, (page + 1) * pageSize);

  return { page, setPage, pageSize, setPageSize, slice, total };
}
