'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { useDebounced } from '@/lib/hooks';
import { P, vendorDownload } from '@/lib/vendor-api';
import { useVendorResource } from '@/lib/vendor-hooks';
import { formatDate, formatMoney } from '@/lib/format';

const TYPES = [
    { value: 'tax_invoice', label: 'Invoices' },
    { value: 'payment', label: 'Payments' },
    { value: 'adjustment', label: 'Notes & adjustments' }
];

export default function VendorLedgerPage() {
    const toast = useToast();
    const [filters, setFilters] = useState({ from: '', to: '', type: '', premise_id: '', include_memo: false });
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search);
    const me = useVendorResource<any>(P + 'me', {});
    const body = { ...filters, search: debounced, from: filters.from || undefined, to: filters.to || undefined, type: filters.type || undefined, premise_id: filters.premise_id || undefined };
    const { data, loading, error } = useVendorResource<any>(P + 'ledger', body);
    const s = data?.summary;
    const signed = (m: number) => `${formatMoney(Math.abs(m || 0))} ${m >= 0 ? 'Cr' : 'Dr'}`;

    return (
        <div>
            <PageHeader
                title="Ledger"
                subtitle="Your account in the buyer's books. Cr = amount payable to you; Dr = advance paid to you."
                action={
                    <button type="button" className="btn-ghost" onClick={() => vendorDownload(P + 'ledger', { ...body, format: 'xlsx' }, 'statement-of-account.xlsx').catch(() => toast.error('Could not export'))}>
                        <Download className="h-4 w-4" /> Export
                    </button>
                }
            />
            <FilterBar search={search} onSearch={setSearch} placeholder="Search reference or PO...">
                {(me.data?.accounts?.length || 0) > 1 && (
                    <Select className="w-52" value={filters.premise_id} onChange={(e) => setFilters({ ...filters, premise_id: e.target.value })} placeholder="All buyers" options={me.data.accounts.map((a: any) => ({ value: a.premise_id, label: a.premise_name }))} />
                )}
                <Select className="w-48" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} options={TYPES} placeholder="All transactions" />
                <input type="date" className="input w-40" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} aria-label="From" />
                <input type="date" className="input w-40" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} aria-label="To" />
                <label className="flex items-center gap-2 text-[13px] text-slate-600"><input type="checkbox" checked={filters.include_memo} onChange={(e) => setFilters({ ...filters, include_memo: e.target.checked })} className="h-4 w-4 rounded border-line" /> Show POs & PIs</label>
            </FilterBar>

            {s && (
                <div className="mb-4 grid gap-3 sm:grid-cols-4">
                    <Tile label="Opening" value={signed(s.opening_balance_minor)} />
                    <Tile label="Invoiced" value={formatMoney(s.invoiced_minor)} />
                    <Tile label="Paid to you" value={formatMoney(s.paid_minor)} />
                    <Tile label="Closing balance" value={signed(s.closing_balance_minor)} strong />
                </div>
            )}

            <Card padded={false}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-line bg-slate-50/80">
                            <tr><th className="th">Date</th><th className="th">Particular</th><th className="th">Reference</th><th className="th">PO</th><th className="th text-right">Debit</th><th className="th text-right">Credit</th><th className="th text-right">Balance</th></tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {loading && <tr><td className="td" colSpan={7}><div className="h-6 animate-pulse rounded bg-slate-100" /></td></tr>}
                            {s && <tr className="bg-slate-50/60"><td className="td">{filters.from ? formatDate(filters.from) : '—'}</td><td className="td font-medium text-ink">Opening Balance</td><td className="td" colSpan={4} /><td className="td text-right font-medium">{signed(s.opening_balance_minor)}</td></tr>}
                            {(data?.rows || []).map((r: any, i: number) => (
                                <tr key={i} className={r.kind === 'memo' ? 'text-slate-400' : ''}>
                                    <td className="td">{formatDate(r.date)}</td>
                                    <td className="td">{r.particular}</td>
                                    <td className="td">{r.reference || '—'}</td>
                                    <td className="td">{r.po_id ? <Link href={`/vendor/orders/${r.po_id}`} className="text-brand-700 hover:underline">{r.po_number}</Link> : '—'}</td>
                                    <td className="td text-right">{r.kind === 'memo' ? '' : r.debit_minor ? formatMoney(r.debit_minor) : '—'}</td>
                                    <td className="td text-right">{r.kind === 'memo' ? `${formatMoney(r.memo_amount_minor)} (memo)` : r.credit_minor ? formatMoney(r.credit_minor) : '—'}</td>
                                    <td className="td text-right font-medium">{r.kind === 'memo' ? '' : signed(r.balance_minor)}</td>
                                </tr>
                            ))}
                            {s && <tr className="border-t-2 border-line bg-slate-50 font-semibold"><td className="td" /><td className="td">Closing Balance</td><td className="td" colSpan={2} /><td className="td text-right">{formatMoney(s.total_debit_minor)}</td><td className="td text-right">{formatMoney(s.total_credit_minor)}</td><td className="td text-right">{signed(s.closing_balance_minor)}</td></tr>}
                        </tbody>
                    </table>
                </div>
                {error && <p className="px-5 py-4 text-[13px] text-rose-600">{error}</p>}
                {data && !data.rows.length && <EmptyState title="No transactions in this period" />}
            </Card>
        </div>
    );
}

function Tile({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="card px-4 py-3">
            <p className="text-[12px] text-muted">{label}</p>
            <p className={`mt-0.5 text-lg font-semibold ${strong ? 'text-brand-700' : 'text-ink'}`}>{value}</p>
        </div>
    );
}
