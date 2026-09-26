'use client';

import { Search } from 'lucide-react';

export function PageHeader({
    title,
    subtitle,
    action
}: {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 className="text-xl font-semibold text-ink">{title}</h1>
                {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}

export function FilterBar({
    search,
    onSearch,
    placeholder = 'Search...',
    children
}: {
    search?: string;
    onSearch?: (value: string) => void;
    placeholder?: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
            {onSearch && (
                <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        className="input pl-9"
                        placeholder={placeholder}
                        value={search ?? ''}
                        onChange={(e) => onSearch(e.target.value)}
                        aria-label={placeholder}
                    />
                </div>
            )}
            {children}
        </div>
    );
}
