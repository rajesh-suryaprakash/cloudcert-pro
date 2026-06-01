import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZE_OPTIONS, type PageSize, totalPages } from '../../hooks/usePagination';

interface PaginationProps {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: PageSize) => void;
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const pages = totalPages(total, pageSize);
  if (total === 0) return null;

  // Build page number window: always show first, last, current ±1
  const getPageNumbers = (): (number | '...')[] => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const nums: (number | '...')[] = [1];
    if (page > 3) nums.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) nums.push(i);
    if (page < pages - 2) nums.push('...');
    nums.push(pages);
    return nums;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
      {/* Page size selector */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
          className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold outline-none focus:border-indigo-400"
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((n, i) =>
          n === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-slate-400 text-xs">
              …
            </span>
          ) : (
            <button
              key={n}
              onClick={() => onPageChange(n as number)}
              className={`min-w-[2rem] h-8 px-2 rounded-lg text-xs font-bold transition-colors ${
                n === page
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
              }`}
            >
              {n}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === pages}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Summary */}
      <span className="text-xs text-slate-400">
        {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
      </span>
    </div>
  );
}
