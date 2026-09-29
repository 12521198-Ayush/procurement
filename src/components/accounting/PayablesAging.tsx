'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CalendarClock, Hourglass } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui/Card';
import { ReportSkeleton, SearchBox, clampPct } from '@/components/accounting/AccountingUI';
import { ErrorCard } from '@/components/accounting/TaxReports';
import { formatINR, formatINRCompact, percentOf, useReport, type AgingBucket, type ApAging } from '@/lib/accounting';
import { formatDate, formatDateTime } from '@/lib/format';

const BUCKETS: { key: AgingBucket; label: string; color: string; pill: string }[] = [
    { key: '0_to_30_days', label: '0–30 days', color: '#10b981', pill: 'bg-emerald-50 text-emerald-700' },
    { key: '31_to_60_days', label: '31–60 days', color: '#fbb12c', pill: 'bg-amber-50 text-amber-700' },
    { key: '61_to_90_days', label: '61–90 days', color: '#f97316', pill: 'bg-orange-50 text-orange-700' },
    { key: 'over_90_days', label: '90+ days', color: '#f43f5e', pill: 'bg-rose-50 text-rose-700' }
];

const vendorName = (identifier: string) => identifier.replace(/^Payable to\s+/i, '');

export function PayablesAging() {
    const { data, loading, error } = useReport<ApAging>('ap-aging');
    const [query, setQuery] = useState('');

    const vendors = useMemo(() => {
        const q = query.trim().toLowerCase();
        return [...(data?.report.vendors ?? [])]
            .filter((v) => !q || v.vendor_identifier.toLowerCase().includes(q))
            .sort((a, b) => b.outstanding_balance - a.outstanding_balance);
    }, [data, query]);

    if (loading) return <ReportSkeleton compact />;
    if (error || !data) return <ErrorCard title="Could not load payables ageing" error={error} />;

    const r = data.report;
    const total = r.total_outstanding;
    const overdue = r['31_to_60_days'] + r['61_to_90_days'] + r.over_90_days;

    return (
        <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
                <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-700 to-rose-900/90 p-5 text-white shadow-pop">
                    <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/5" />
                    <div className="flex items-center gap-2 text-[12px] text-slate-300">
                        <Hourglass className="h-4 w-4" />
                        Total owed to vendors
                    </div>
                    <p className="mt-3 text-[32px] font-semibold leading-tight tracking-tight">{formatINR(total)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-300">
                        <CalendarClock className="h-3.5 w-3.5" />
                        As of {formatDateTime(data.as_of_date)}
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4 text-[12px]">
                        <div>
                            <p className="text-slate-400">Vendors</p>
                            <p className="mt-0.5 text-lg font-semibold">{r.vendors.length}</p>
                        </div>
                        <div>
                            <p className="text-slate-400">Past 30 days</p>
                            <p className={clsx('mt-0.5 text-lg font-semibold', overdue ? 'text-rose-300' : 'text-emerald-300')}>
                                {formatINRCompact(overdue)}
                            </p>
                        </div>
                    </div>
                </section>

                <Card className="lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="section-title">Ageing profile</h3>
                        <span className="text-[11px] text-muted">By days since invoice</span>
                    </div>
                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                        {BUCKETS.map((b) => (
                            <div key={b.key} style={{ width: `${percentOf(r[b.key], total)}%`, background: b.color }} title={b.label} />
                        ))}
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {BUCKETS.map((b) => (
                            <div key={b.key} className="rounded-xl border border-line p-3.5">
                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                                    <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                                    {b.label}
                                </div>
                                <p className="mt-1.5 text-lg font-semibold tracking-tight text-ink" title={formatINR(r[b.key])}>
                                    {formatINRCompact(r[b.key])}
                                </p>
                                <p className="text-[11px] text-slate-400">{percentOf(r[b.key], total)}% of total</p>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <Card padded={false} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                    <h3 className="section-title">Outstanding by vendor</h3>
                    <SearchBox value={query} onChange={setQuery} placeholder="Search vendor" />
                </div>
                {vendors.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="th">Vendor</th>
                                    <th className="th">Last invoice</th>
                                    <th className="th text-right">Invoiced</th>
                                    <th className="th text-right">Paid</th>
                                    <th className="th">Settled</th>
                                    <th className="th text-right">Outstanding</th>
                                    <th className="th">Age</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {vendors.map((v) => {
                                    const bucket = BUCKETS.find((b) => b.key === v.bucket) ?? BUCKETS[0];
                                    const paidPct = percentOf(v.total_paid, v.total_invoiced);
                                    return (
                                        <tr key={v.vendor_identifier} className="hover:bg-slate-50/60">
                                            <td className="td">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-900 text-[12px] font-semibold text-white">
                                                        {vendorName(v.vendor_identifier).charAt(0).toUpperCase()}
                                                    </span>
                                                    <span className="font-medium text-ink">{vendorName(v.vendor_identifier)}</span>
                                                </div>
                                            </td>
                                            <td className="td text-muted">{formatDate(v.last_invoice_date)}</td>
                                            <td className="td text-right tabular-nums">{formatINR(v.total_invoiced)}</td>
                                            <td className="td text-right tabular-nums">{formatINR(v.total_paid)}</td>
                                            <td className="td">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${clampPct(paidPct)}%` }} />
                                                    </div>
                                                    <span className="text-[11px] text-muted">{paidPct}%</span>
                                                </div>
                                            </td>
                                            <td className="td text-right font-semibold tabular-nums text-ink">{formatINR(v.outstanding_balance)}</td>
                                            <td className="td">
                                                <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-semibold', bucket.pill)}>
                                                    {v.days_outstanding} day{v.days_outstanding === 1 ? '' : 's'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title={query ? 'No vendors match your search' : 'Nothing owed to vendors'} hint="Unpaid vendor bills are aged here." />
                )}
            </Card>
        </div>
    );
}
