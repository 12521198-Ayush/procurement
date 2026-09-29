'use client';

import clsx from 'clsx';
import { AlertTriangle, CalendarDays, CheckCircle2 } from 'lucide-react';
import { PRESETS, TYPE_STYLE, presetPeriod, type AccountType, type Period, type PresetKey } from '@/lib/accounting';

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
