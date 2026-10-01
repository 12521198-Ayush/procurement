'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, Check, CircleDashed, Loader, X } from 'lucide-react';
import StatusPill from '@/components/ui/StatusPill';
import { formatDate } from '@/lib/format';

export type Stage = { key: string; label: string; state: string; count?: number; date?: string | null };
export type RelatedRecord = { type: string; label: string; number: string; id: string; status: string | null; href: string; subtitle?: string };

/** RFQ → Quotation → Bid opening → PO → PI → Payment → Dispatch → GRN → Invoice → Receipt */
export function LifecycleStepper({ stages }: { stages: Stage[] }) {
    return (
        <ol className="flex gap-1 overflow-x-auto pb-1">
            {stages.map((s, i) => {
                const done = s.state === 'done';
                const current = s.state === 'current';
                const cancelled = s.state === 'cancelled';
                return (
                    <li key={s.key} className="flex min-w-[96px] flex-1 items-center gap-1">
                        <div className="flex min-w-0 flex-col items-center gap-1 text-center">
                            <span
                                className={clsx(
                                    'grid h-8 w-8 place-items-center rounded-full border-2',
                                    done && 'border-emerald-500 bg-emerald-500 text-white',
                                    current && 'border-brand-600 bg-white text-brand-600',
                                    cancelled && 'border-rose-500 bg-rose-50 text-rose-600',
                                    !done && !current && !cancelled && 'border-line bg-white text-slate-300'
                                )}
                                title={s.state}
                            >
                                {done ? <Check className="h-4 w-4" /> : current ? <Loader className="h-4 w-4" /> : cancelled ? <X className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
                            </span>
                            <span className={clsx('text-[11px] font-medium leading-tight', done || current ? 'text-ink' : 'text-slate-400')}>{s.label}</span>
                            <span className="text-[10px] text-muted">
                                {s.date ? formatDate(s.date) : s.count ? `${s.count}` : s.state === 'optional' ? 'optional' : s.state === 'skipped' ? 'n/a' : ''}
                            </span>
                        </div>
                        {i < stages.length - 1 && <span className={clsx('mb-8 h-0.5 flex-1 rounded', done ? 'bg-emerald-400' : 'bg-line')} />}
                    </li>
                );
            })}
        </ol>
    );
}

/** One-click navigation to every record in the procurement chain. */
export function RelatedDocuments({ related, exclude }: { related: RelatedRecord[]; exclude?: string }) {
    const rows = related.filter((r) => !(exclude && r.id === exclude));
    if (!rows.length) return <p className="text-[13px] text-muted">No related records yet.</p>;
    return (
        <ul className="divide-y divide-line">
            {rows.map((r, i) => (
                <li key={r.type + r.id + i} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{r.label}</p>
                        <p className="truncate text-[13px] font-medium text-ink">
                            {r.number}
                            {r.subtitle && <span className="ml-1.5 font-normal text-muted">· {r.subtitle}</span>}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {r.status && <StatusPill status={r.status} />}
                        <Link href={r.href} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700">
                            View <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </li>
            ))}
        </ul>
    );
}
