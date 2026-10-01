'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { useResource } from '@/lib/hooks';
import { formatMoneyCompact } from '@/lib/format';

type Metric = { key: string; label: string; value: number; href: string; detail?: string; is_money?: boolean; currency?: string };

const HIGHLIGHT: Record<string, string> = {
    bids_opening_today: 'text-amber-700',
    pis_pending: 'text-violet-700',
    payments_pending: 'text-amber-700',
    dispatch_pending: 'text-orange-700',
    grn_pending: 'text-teal-700',
    invoice_pending: 'text-indigo-700',
    vendor_outstanding: 'text-rose-700',
    completed: 'text-emerald-700'
};

/** RFQ-to-ledger pipeline counts; every tile opens the list it counts. */
export default function LifecyclePipeline() {
    const { data, loading } = useResource<{ metrics: Metric[] }>('/procurement/dashboard/lifecycle', {});

    return (
        <Card>
            <CardHeader title="Procurement lifecycle" action={<span className="text-[12px] text-muted">Click a tile to open the list</span>} />
            {loading || !data ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    {Array.from({ length: 14 }).map((_, i) => (
                        <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    {data.metrics.map((m) => (
                        <Link
                            key={m.key}
                            href={m.href}
                            className="group rounded-lg border border-line bg-white px-3 py-2.5 transition hover:border-brand-300 hover:bg-brand-50/40"
                            title={m.detail}
                        >
                            <div className="flex items-start justify-between gap-1">
                                <p className="text-[11px] font-medium leading-tight text-muted">{m.label}</p>
                                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-brand-500" />
                            </div>
                            <p className={`mt-1.5 text-xl font-semibold tracking-tight ${HIGHLIGHT[m.key] || 'text-ink'}`}>
                                {m.is_money ? formatMoneyCompact(m.value, m.currency || 'INR') : m.value}
                            </p>
                            {m.detail && <p className="truncate text-[10px] text-slate-400">{m.detail}</p>}
                        </Link>
                    ))}
                </div>
            )}
        </Card>
    );
}
