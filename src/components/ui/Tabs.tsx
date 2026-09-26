'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';

export function Tabs({
    tabs,
    active,
    onChange
}: {
    tabs: { value: string; label: string; count?: number }[];
    active: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex gap-1 overflow-x-auto border-b border-line">
            {tabs.map((t) => {
                const isActive = t.value === active;
                return (
                    <button
                        key={t.value}
                        type="button"
                        onClick={() => onChange(t.value)}
                        className={clsx(
                            '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-[13px] font-medium transition',
                            isActive
                                ? 'border-brand-600 text-brand-700'
                                : 'border-transparent text-muted hover:text-slate-700'
                        )}
                    >
                        {t.label}
                        {t.count != null && (
                            <span
                                className={clsx(
                                    'ml-2 rounded-md px-1.5 py-0.5 text-[11px]',
                                    isActive ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'
                                )}
                            >
                                {t.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
    return (
        <ol className="flex items-center gap-2 overflow-x-auto">
            {steps.map((label, index) => {
                const step = index + 1;
                const done = step < current;
                const active = step === current;

                return (
                    <li key={label} className="flex flex-1 items-center gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <span
                                className={clsx(
                                    'grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-[13px] font-semibold transition',
                                    done && 'border-brand-600 bg-brand-600 text-white',
                                    active && 'border-brand-600 bg-white text-brand-700',
                                    !done && !active && 'border-line bg-white text-slate-400'
                                )}
                            >
                                {done ? <Check className="h-4 w-4" /> : step}
                            </span>
                            <span
                                className={clsx(
                                    'hidden truncate text-[13px] font-medium sm:block',
                                    active ? 'text-ink' : done ? 'text-slate-600' : 'text-slate-400'
                                )}
                            >
                                {label}
                            </span>
                        </div>
                        {step < steps.length && (
                            <span className={clsx('h-px flex-1', done ? 'bg-brand-600' : 'bg-line')} />
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
