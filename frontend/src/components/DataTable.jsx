import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { totalPages } from '../utils';

function Skeleton({ rows = 5, cols = 4 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-surface-100 dark:border-surface-800">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded animate-pulse" style={{ width: `${60 + (j * 15) % 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function DataTable({
  columns,        // [{ key, label, sortable, render, className }]
  data = [],
  isLoading = false,
  pagination,     // { page, limit, total }
  onPageChange,
  emptyMessage = 'No records found',
  onRowClick,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey]; const bv = b[sortKey];
        if (av == null) return 1; if (bv == null) return -1;
        const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  const pages = pagination ? totalPages(pagination.total, pagination.limit) : 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={`px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap
                    ${col.sortable ? 'cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none' : ''}
                    ${col.className || ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      sortKey === col.key
                        ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        : <ChevronsUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-surface-950 divide-y divide-surface-100 dark:divide-surface-800">
            {isLoading ? (
              <Skeleton rows={5} cols={columns.length} />
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400 dark:text-slate-600">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={row.id || i}
                  onClick={() => onRowClick?.(row)}
                  className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-brand-50/50 dark:hover:bg-brand-950/20' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-slate-700 dark:text-slate-300 ${col.className || ''}`}>
                      {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>
            Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              className="btn-secondary px-3 py-1.5 disabled:opacity-40"
            >Prev</button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
              const p = i + Math.max(1, pagination.page - 2);
              if (p > pages) return null;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange?.(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${p === pagination.page ? 'bg-brand-600 text-white' : 'btn-secondary'}`}
                >{p}</button>
              );
            })}
            <button
              disabled={pagination.page >= pages}
              onClick={() => onPageChange?.(pagination.page + 1)}
              className="btn-secondary px-3 py-1.5 disabled:opacity-40"
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
