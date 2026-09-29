'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowDownLeft, ArrowUpRight, FileInput, FileOutput, Landmark, Minus, ReceiptIndianRupee, Equal } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { ReportSkeleton, SearchBox, SummaryTile } from '@/components/accounting/AccountingUI';
import { formatINR, periodLabel, useReport, type Gstr1, type Gstr2b, type Gstr3b, type Period, type TaxSplit, type TdsReport } from '@/lib/accounting';
import { formatDate } from '@/lib/format';

type GstView = '3b' | '1' | '2b';

const GST_VIEWS: { value: GstView; label: string; hint: string; icon: typeof FileInput }[] = [
    { value: '3b', label: 'GSTR-3B', hint: 'Monthly summary', icon: ReceiptIndianRupee },
    { value: '1', label: 'GSTR-1', hint: 'Outward supplies', icon: FileOutput },
    { value: '2b', label: 'GSTR-2B', hint: 'Inward supplies (ITC)', icon: FileInput }
];

export function GstReports({ period, onRecordInvoice }: { period: Period; onRecordInvoice: () => void }) {
    const [view, setView] = useState<GstView>('3b');

    return (
        <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
                {GST_VIEWS.map(({ value, label, hint, icon: Icon }) => {
                    const active = view === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setView(value)}
                            className={clsx(
                                'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                                active ? 'border-brand-500 bg-brand-50/60 ring-4 ring-brand-500/10' : 'border-line bg-white hover:border-brand-200'
                            )}
                        >
                            <span
                                className={clsx(
                                    'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                                    active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
                                )}
                            >
                                <Icon className="h-[18px] w-[18px]" />
                            </span>
                            <span>
                                <span className={clsx('block text-[13px] font-semibold', active ? 'text-brand-700' : 'text-ink')}>{label}</span>
                                <span className="block text-[11px] text-muted">{hint}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {view === '3b' && <Gstr3bView period={period} />}
            {view === '1' && <Gstr1View period={period} />}
            {view === '2b' && <Gstr2bView period={period} onRecordInvoice={onRecordInvoice} />}
        </div>
    );
}

/* ---------------------------------------------------------------- GSTR-3B */

function Gstr3bView({ period }: { period: Period }) {
    const { data, loading, error } = useReport<Gstr3b>('gstr-3b', period);

    if (loading) return <ReportSkeleton compact />;
    if (error || !data) return <ErrorCard title="Could not load GSTR-3B" error={error} />;

    const { output_tax, input_tax_credit, net_tax_payable } = data.data;
    const net = net_tax_payable.total;
    const payable = net > 0;

    return (
        <div className="space-y-4">
            <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
                <TaxCard
                    title="Output tax"
                    caption="GST charged on your invoices"
                    icon={ArrowUpRight}
                    tone="bg-brand-50 text-brand-600"
                    split={output_tax}
                />
                <Operator icon={Minus} />
                <TaxCard
                    title="Input tax credit"
                    caption="GST paid on vendor bills"
                    icon={ArrowDownLeft}
                    tone="bg-violet-50 text-violet-600"
                    split={input_tax_credit}
                />
                <Operator icon={Equal} />
                <div
                    className={clsx(
                        'relative overflow-hidden rounded-xl p-5 text-white shadow-pop',
                        payable ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                    )}
                >
                    <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
                    <div className="flex items-center gap-2 text-[12px] font-medium text-white/85">
                        <Landmark className="h-4 w-4" />
                        {payable ? 'Net GST payable' : net < 0 ? 'Credit carried forward' : 'Nothing payable'}
                    </div>
                    <p className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">{formatINR(Math.abs(net))}</p>
                    <p className="mt-1 text-[11px] text-white/80">
                        {payable ? 'To be paid in cash for this period.' : 'Input credit exceeds output tax - it offsets future returns.'}
                    </p>
                    <dl className="mt-4 space-y-1.5 border-t border-white/20 pt-3 text-[12px]">
                        <SplitRow label="CGST" value={net_tax_payable.cgst} light />
                        <SplitRow label="SGST" value={net_tax_payable.sgst} light />
                        <SplitRow label="IGST" value={net_tax_payable.igst} light />
                    </dl>
                </div>
            </div>

            <Card>
                <CardHeader title="Head-wise summary" action={<span className="text-[11px] text-muted">{periodLabel(data.period)}</span>} />
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/80">
                            <tr>
                                <th className="th">Tax head</th>
                                <th className="th text-right">Output tax</th>
                                <th className="th text-right">Input credit</th>
                                <th className="th text-right">Net</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {(['cgst', 'sgst', 'igst', 'total'] as const).map((k) => (
                                <tr key={k} className={k === 'total' ? 'bg-slate-50 font-semibold' : 'hover:bg-slate-50/60'}>
                                    <td className="td font-medium text-ink">{k === 'total' ? 'Total' : k.toUpperCase()}</td>
                                    <td className="td text-right tabular-nums">{formatINR(output_tax[k])}</td>
                                    <td className="td text-right tabular-nums">{formatINR(input_tax_credit[k])}</td>
                                    <td className={clsx('td text-right tabular-nums', net_tax_payable[k] < 0 ? 'text-emerald-600' : 'text-ink')}>
                                        {formatINR(net_tax_payable[k])}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

function TaxCard({
    title,
    caption,
    icon: Icon,
    tone,
    split
}: {
    title: string;
    caption: string;
    icon: typeof ArrowUpRight;
    tone: string;
    split: TaxSplit;
}) {
    return (
        <div className="card card-pad">
            <div className="flex items-center gap-2.5">
                <span className={clsx('grid h-9 w-9 place-items-center rounded-lg', tone)}>
                    <Icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                    <p className="text-[13px] font-semibold text-ink">{title}</p>
                    <p className="text-[11px] text-muted">{caption}</p>
                </div>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">{formatINR(split.total)}</p>
            <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-[12px]">
                <SplitRow label="CGST" value={split.cgst} />
                <SplitRow label="SGST" value={split.sgst} />
                <SplitRow label="IGST" value={split.igst} />
            </dl>
        </div>
    );
}

function SplitRow({ label, value, light = false }: { label: string; value: number; light?: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <dt className={light ? 'text-white/75' : 'text-muted'}>{label}</dt>
            <dd className={clsx('font-medium tabular-nums', light ? 'text-white' : 'text-ink')}>{formatINR(value)}</dd>
        </div>
    );
}

function Operator({ icon: Icon }: { icon: typeof Minus }) {
    return (
        <div className="hidden place-items-center lg:grid">
            <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-slate-400 shadow-card">
                <Icon className="h-4 w-4" />
            </span>
        </div>
    );
}

/* ---------------------------------------------------------------- GSTR-1 */

function Gstr1View({ period }: { period: Period }) {
    const { data, loading, error } = useReport<Gstr1>('gstr-1', period);
    const [query, setQuery] = useState('');

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (data?.data ?? []).filter(
            (r) => !q || r.invoice_number.toLowerCase().includes(q) || (r.customer_gstin ?? '').toLowerCase().includes(q)
        );
    }, [data, query]);

    if (loading) return <ReportSkeleton compact />;
    if (error || !data) return <ErrorCard title="Could not load GSTR-1" error={error} />;

    const sum = (pick: (r: Gstr1['data'][number]) => number | null) => data.data.reduce((s, r) => s + (pick(r) ?? 0), 0);
    const tax = sum((r) => r.total_cgst + r.total_sgst + r.total_igst);

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryTile label="Invoices" value={String(data.total_invoices)} accent="border-l-slate-400" />
                <SummaryTile label="Taxable value" value={formatINR(sum((r) => r.taxable_value))} accent="border-l-brand-500" />
                <SummaryTile label="GST charged" value={formatINR(tax)} accent="border-l-violet-500" />
                <SummaryTile label="Invoice value" value={formatINR(sum((r) => r.total_invoice_value))} accent="border-l-emerald-500" />
            </div>

            <Card padded={false} className="overflow-hidden">
                <TableToolbar title="Outward supplies" period={data.period}>
                    <SearchBox value={query} onChange={setQuery} placeholder="Invoice no. or GSTIN" />
                </TableToolbar>
                {rows.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="th">Invoice</th>
                                    <th className="th">Customer GSTIN</th>
                                    <th className="th">HSN/SAC</th>
                                    <th className="th text-right">Taxable</th>
                                    <th className="th text-right">CGST</th>
                                    <th className="th text-right">SGST</th>
                                    <th className="th text-right">IGST</th>
                                    <th className="th text-right">Invoice value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {rows.map((r) => (
                                    <tr key={r.invoice_number} className="hover:bg-slate-50/60">
                                        <td className="td">
                                            <p className="font-medium text-ink">{r.invoice_number}</p>
                                            <p className="text-[11px] text-muted">{formatDate(r.invoice_date)}</p>
                                        </td>
                                        <td className="td font-mono text-[12px]">{r.customer_gstin || <span className="font-sans text-slate-400">B2C</span>}</td>
                                        <td className="td">
                                            <HsnChip code={r.hsn_sac_code} />
                                        </td>
                                        <td className="td text-right tabular-nums">{r.taxable_value == null ? '—' : formatINR(r.taxable_value)}</td>
                                        <td className="td text-right tabular-nums">{formatINR(r.total_cgst)}</td>
                                        <td className="td text-right tabular-nums">{formatINR(r.total_sgst)}</td>
                                        <td className="td text-right tabular-nums">{formatINR(r.total_igst)}</td>
                                        <td className="td text-right font-semibold tabular-nums text-ink">{formatINR(r.total_invoice_value)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        title={query ? 'No invoices match your search' : 'No outward invoices in this period'}
                        hint="Society invoices that carry GST will be listed here for GSTR-1 filing."
                    />
                )}
            </Card>
        </div>
    );
}

/* --------------------------------------------------------------- GSTR-2B */

function Gstr2bView({ period, onRecordInvoice }: { period: Period; onRecordInvoice: () => void }) {
    const { data, loading, error } = useReport<Gstr2b>('gstr-2b', period);
    const [query, setQuery] = useState('');

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (data?.data ?? []).filter(
            (r) => !q || r.invoice_number.toLowerCase().includes(q) || (r.gstin_of_supplier ?? '').toLowerCase().includes(q)
        );
    }, [data, query]);

    if (loading) return <ReportSkeleton compact />;
    if (error || !data) return <ErrorCard title="Could not load GSTR-2B" error={error} />;

    const sum = (pick: (r: Gstr2b['data'][number]) => number) => data.data.reduce((s, r) => s + (pick(r) ?? 0), 0);
    const suppliers = new Set(data.data.map((r) => r.gstin_of_supplier)).size;

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryTile label="Vendor invoices" value={String(data.total_invoices)} accent="border-l-slate-400" hint={`${suppliers} supplier${suppliers === 1 ? '' : 's'}`} />
                <SummaryTile label="Total input credit" value={formatINR(sum((r) => r.total_tax))} accent="border-l-violet-500" />
                <SummaryTile label="CGST + SGST" value={formatINR(sum((r) => r.total_cgst + r.total_sgst))} accent="border-l-brand-500" hint="Intra-state purchases" />
                <SummaryTile label="IGST" value={formatINR(sum((r) => r.total_igst))} accent="border-l-accent-400" hint="Inter-state purchases" />
            </div>

            <Card padded={false} className="overflow-hidden">
                <TableToolbar title="Inward supplies" period={data.period}>
                    <SearchBox value={query} onChange={setQuery} placeholder="Invoice no. or GSTIN" />
                    <button type="button" className="btn-primary h-9 text-[13px]" onClick={onRecordInvoice}>
                        Record vendor invoice
                    </button>
                </TableToolbar>
                {rows.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="th">Invoice</th>
                                    <th className="th">Supplier GSTIN</th>
                                    <th className="th text-right">Taxable</th>
                                    <th className="th text-right">CGST</th>
                                    <th className="th text-right">SGST</th>
                                    <th className="th text-right">IGST</th>
                                    <th className="th text-right">Eligible ITC</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {rows.map((r) => (
                                    <tr key={`${r.gstin_of_supplier}-${r.invoice_number}`} className="hover:bg-slate-50/60">
                                        <td className="td font-medium text-ink">{r.invoice_number}</td>
                                        <td className="td font-mono text-[12px]">{r.gstin_of_supplier}</td>
                                        <td className="td text-right tabular-nums">{r.taxable_value == null ? <span className="text-slate-400">—</span> : formatINR(r.taxable_value)}</td>
                                        <td className="td text-right tabular-nums">{formatINR(r.total_cgst)}</td>
                                        <td className="td text-right tabular-nums">{formatINR(r.total_sgst)}</td>
                                        <td className="td text-right tabular-nums">{formatINR(r.total_igst)}</td>
                                        <td className="td text-right">
                                            <span className="rounded-md bg-violet-50 px-2 py-1 font-semibold tabular-nums text-violet-700">{formatINR(r.total_tax)}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        title={query ? 'No invoices match your search' : 'No vendor invoices in this period'}
                        hint="Record a GST vendor bill to claim its input tax credit."
                    />
                )}
            </Card>
        </div>
    );
}

/* ------------------------------------------------------------------- TDS */

const HIDDEN_KEYS = new Set(['_id', '__v', 'premise_id']);
const MONEY_KEY = /amount|value|tds|tax|paid|total|balance|deducted/i;
const DATE_KEY = /date|_at$/i;

function humanise(key: string) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bTds\b/g, 'TDS').replace(/\bPan\b/g, 'PAN');
}

function renderCell(key: string, value: unknown) {
    if (value === null || value === undefined || value === '') return <span className="text-slate-400">—</span>;
    if (typeof value === 'number' && MONEY_KEY.test(key) && !/rate|percent|section/i.test(key)) return formatINR(value);
    if (typeof value === 'number' && /rate|percent/i.test(key)) return `${value}%`;
    if (typeof value === 'string' && DATE_KEY.test(key)) return formatDate(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export function TdsReportView({ period }: { period: Period }) {
    const { data, loading, error } = useReport<TdsReport>('tds', period);

    const rows = useMemo(() => data?.data ?? [], [data]);
    const columns = useMemo(() => {
        const keys: string[] = [];
        rows.forEach((r) => Object.keys(r).forEach((k) => !HIDDEN_KEYS.has(k) && !keys.includes(k) && keys.push(k)));
        return keys;
    }, [rows]);

    const tdsKey = columns.find((k) => /tds/i.test(k) && rows.some((r) => typeof r[k] === 'number'));
    const totalTds = tdsKey ? rows.reduce((s, r) => s + (Number(r[tdsKey]) || 0), 0) : null;

    if (loading) return <ReportSkeleton compact />;
    if (error || !data) return <ErrorCard title="Could not load the TDS report" error={error} />;

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
                <SummaryTile label="TDS entries" value={String(rows.length)} accent="border-l-slate-400" />
                <SummaryTile label="Tax deducted" value={totalTds == null ? '—' : formatINR(totalTds)} accent="border-l-rose-500" hint="Payable to the government" />
                <SummaryTile label="Period" value={periodLabel(data.period)} accent="border-l-brand-500" />
            </div>

            <Card padded={false} className="overflow-hidden">
                <TableToolbar title="Tax deducted at source" period={data.period} />
                {rows.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    {columns.map((c) => (
                                        <th key={c} className="th">
                                            {humanise(c)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {rows.map((r, i) => (
                                    <tr key={i} className="hover:bg-slate-50/60">
                                        {columns.map((c) => (
                                            <td key={c} className={clsx('td', typeof r[c] === 'number' && 'text-right tabular-nums')}>
                                                {renderCell(c, r[c])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title="No TDS deducted in this period" hint="TDS withheld on vendor payments will appear here for your 26Q return." />
                )}
            </Card>
        </div>
    );
}

/* ---------------------------------------------------------------- Shared */

function TableToolbar({ title, period, children }: { title: string; period: Period; children?: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div>
                <h3 className="section-title">{title}</h3>
                <p className="text-[11px] text-muted">{periodLabel(period)}</p>
            </div>
            {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
        </div>
    );
}

function HsnChip({ code }: { code: string }) {
    return <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[12px] text-slate-600">{code || '—'}</span>;
}

export function ErrorCard({ title, error }: { title: string; error: string | null }) {
    return (
        <Card>
            <EmptyState title={title} hint={error ?? undefined} />
        </Card>
    );
}
