'use client';

import clsx from 'clsx';
import { AlertTriangle, CalendarDays, CheckCircle2, Search } from 'lucide-react';
import { PRESETS, TYPE_STYLE, presetPeriod, type AccountType, type Period, type PresetKey } from '@/lib/accounting';

export const TOOLTIP_STYLE = { borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 };

export function clampPct(pct: number) {
    return Math.min(100, Math.max(0, pct));
}

export function Legend({ color, label }: { color: string; label: string }) {
    return (
        <span className="flex min-w-0 items-center gap-1.5 text-muted">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
            <span className="truncate">{label}</span>
        </span>
    );
}

export function SummaryTile({
    label,
    value,
    accent,
    extra,
    hint
}: {
    label: string;
    value: string;
    accent: string;
    extra?: React.ReactNode;
    hint?: string;
}) {
    return (
        <div className={clsx('card border-l-4 px-4 py-3.5', accent)}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-medium text-muted">{label}</p>
                {extra}
            </div>
            <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
        </div>
    );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
    return (
        <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
                className="input h-9 pl-9 text-[13px]"
                placeholder={placeholder}
                aria-label={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

export function ReportSkeleton({ compact = false }: { compact?: boolean }) {
    return (
        <div className="space-y-4">
            {!compact && <div className="h-[210px] animate-pulse rounded-2xl bg-slate-200" />}
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="h-[300px] animate-pulse rounded-xl bg-slate-200 lg:col-span-2" />
                <div className="h-[300px] animate-pulse rounded-xl bg-slate-200" />
            </div>
        </div>
    );
}

export function TypeBadge({ type }: { type: AccountType }) {
    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                TYPE_STYLE[type]?.pill ?? 'bg-slate-50 text-slate-600 ring-slate-200'
            )}
        >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE_STYLE[type]?.color ?? '#94a3b8' }} />
            {type}
        </span>
    );
}

export function BalancedBadge({ balanced, dark = false }: { balanced: boolean; dark?: boolean }) {
    const Icon = balanced ? CheckCircle2 : AlertTriangle;
    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                dark
                    ? balanced
                        ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30'
                        : 'bg-rose-400/15 text-rose-300 ring-1 ring-inset ring-rose-400/30'
                    : balanced
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                      : 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200'
            )}
        >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
            {balanced ? 'Balanced' : 'Out of balance'}
        </span>
    );
}

export function PeriodPicker({
    period,
    preset,
    onChange
}: {
    period: Period;
    preset: PresetKey | 'custom';
    onChange: (period: Period, preset: PresetKey | 'custom') => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-line bg-white p-0.5 shadow-sm">
                {PRESETS.map((p) => (
                    <button
                        key={p.value}
                        type="button"
                        onClick={() => onChange(presetPeriod(p.value), p.value)}
                        className={clsx(
                            'rounded-md px-3 py-1.5 text-[12px] font-medium transition',
                            preset === p.value ? 'bg-navy-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                        )}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
            <div className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 shadow-sm">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <input
                    type="date"
                    aria-label="Start date"
                    value={period.startDate}
                    max={period.endDate}
                    onChange={(e) => e.target.value && onChange({ ...period, startDate: e.target.value }, 'custom')}
                    className="bg-transparent text-[12px] text-slate-700 outline-none"
                />
                <span className="text-[12px] text-slate-400">to</span>
                <input
                    type="date"
                    aria-label="End date"
                    value={period.endDate}
                    min={period.startDate}
                    onChange={(e) => e.target.value && onChange({ ...period, endDate: e.target.value }, 'custom')}
                    className="bg-transparent text-[12px] text-slate-700 outline-none"
                />
            </div>
        </div>
    );
}
