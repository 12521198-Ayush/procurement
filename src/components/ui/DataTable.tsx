'use client';

import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export type Column<T> = {
    key: string;
    header: string;
    render?: (row: T) => React.ReactNode;
    align?: 'left' | 'right' | 'center';
    className?: string;
};

export default function DataTable<T extends Record<string, any>>({
    columns,
    rows,
    rowKey,
    loading,
    error,
    emptyTitle = 'Nothing to show yet',
    emptyHint,
    onRowClick,
    page,
    limit,
    total,
    onPageChange
}: {
    columns: Column<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    loading?: boolean;
    error?: string | null;
    emptyTitle?: string;
    emptyHint?: string;
    onRowClick?: (row: T) => void;
    page?: number;
    limit?: number;
    total?: number;
    onPageChange?: (page: number) => void;
}) {
    const showPager = page != null && limit != null && total != null && total > limit;
    const from = page && limit ? (page - 1) * limit + 1 : 0;
    const to = page && limit ? Math.min(page * limit, total ?? 0) : 0;
    const lastPage = limit && total ? Math.max(Math.ceil(total / limit), 1) : 1;

    return (
        <div className="card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="border-b border-line bg-slate-50/80">
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} className={clsx('th', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>
                                    {c.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {loading &&
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={`skeleton-${i}`}>
                                    {columns.map((c) => (
                                        <td key={c.key} className="td">
                                            <div className="h-3.5 w-full max-w-[140px] animate-pulse rounded bg-slate-200" />
                                        </td>
                                    ))}
                                </tr>
                            ))}

                        {!loading &&
                            rows.map((row) => (
                                <tr
                                    key={rowKey(row)}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                    className={clsx('transition', onRowClick && 'cursor-pointer hover:bg-slate-50')}
                                >
                                    {columns.map((c) => (
                                        <td
                                            key={c.key}
                                            className={clsx('td', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}
                                        >
                                            {c.render ? c.render(row) : (row[c.key] ?? '—')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            {!loading && !rows.length && (
                <div className="px-6 py-14 text-center">
                    <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400">
                        <Inbox className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-600">{error ? 'Could not load this list' : emptyTitle}</p>
                    {(error || emptyHint) && <p className="mt-1 text-xs text-slate-400">{error || emptyHint}</p>}
                </div>
            )}

            {showPager && (
                <div className="flex items-center justify-between border-t border-line px-5 py-3">
                    <p className="text-[13px] text-muted">
                        Showing {from}–{to} of {total}
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-slate-500 disabled:opacity-40 hover:bg-slate-50"
                            disabled={page === 1}
                            onClick={() => onPageChange?.((page || 1) - 1)}
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="px-2 text-[13px] font-medium text-slate-600">
                            {page} / {lastPage}
                        </span>
                        <button
                            type="button"
                            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-slate-500 disabled:opacity-40 hover:bg-slate-50"
                            disabled={(page || 1) >= lastPage}
                            onClick={() => onPageChange?.((page || 1) + 1)}
                            aria-label="Next page"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
