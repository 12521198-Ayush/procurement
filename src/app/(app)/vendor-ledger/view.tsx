'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, Plus, Scale } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatCard from '@/components/ui/StatCard';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { api, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useOptions, useResource } from '@/lib/hooks';
import { formatDate, formatMoney } from '@/lib/format';
import { saveBlob } from '@/lib/vendor-api';

const TYPES = [
    { value: 'tax_invoice', label: 'Invoices' },
    { value: 'payment', label: 'Payments' },
    { value: 'adjustment', label: 'Notes & adjustments' }
];

const ADJUSTMENTS = [
    { value: 'opening_balance', label: 'Opening balance' },
    { value: 'debit_note', label: 'Debit note (reduces payable)' },
    { value: 'credit_note', label: 'Credit note from vendor (reduces payable)' },
    { value: 'adjustment', label: 'Adjustment' }
];

export default function VendorLedgerPage({ searchParams }: { searchParams?: { vendor?: string; po?: string } }) {
    const { can } = useAuth();
    const toast = useToast();
    const vendors = useOptions('/procurement/vendors/list', 'vendor_id', 'company_name');
    const [vendorId, setVendorId] = useState(searchParams?.vendor || '');
    const [filters, setFilters] = useState({ from: '', to: '', po_id: searchParams?.po || '', type: '', include_memo: false });
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search);
    const [adjustOpen, setAdjustOpen] = useState(false);
    const [adjustType, setAdjustType] = useState('debit_note');
    const [busy, setBusy] = useState(false);

    const body = { vendor_id: vendorId, ...filters, search: debounced, from: filters.from || undefined, to: filters.to || undefined, po_id: filters.po_id || undefined, type: filters.type || undefined };
    const ledger = useResource<any>(vendorId ? '/procurement/vendor-ledger' : null, body);
    const outstanding = useResource<any>(vendorId ? null : '/procurement/vendor-ledger/outstanding', {});
    const pos = useResource<any>(vendorId ? '/procurement/purchase-orders/list' : null, { vendor_id: vendorId, limit: 100 });

    async function exportXlsx() {
        try {
            const res = await api.post('/procurement/vendor-ledger/export', body, { responseType: 'blob' });
            saveBlob(res.data, `vendor-ledger-${ledger.data?.vendor?.company_name || 'vendor'}.xlsx`);
        } catch {
            toast.error('Could not export the ledger');
        }
    }

    async function adjust(form: FormData) {
        setBusy(true);
        try {
            const entry = await post('/procurement/vendor-ledger/adjust', {
                vendor_id: vendorId,
                type: form.get('type'),
                direction: form.get('direction') || undefined,
                amount: form.get('amount'),
                date: form.get('date') || undefined,
                reference: form.get('reference') || undefined,
                po_id: form.get('po_id') || undefined,
                narration: form.get('narration') || undefined,
                idempotency_key: `${vendorId}:${form.get('reference') || ''}:${form.get('amount')}:${Date.now()}`
            });
            toast.success(`Posted ${entry.entry_number}`);
            setAdjustOpen(false);
            ledger.reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    const s = ledger.data?.summary;
    const signed = (minor: number) => `${formatMoney(Math.abs(minor || 0))} ${minor >= 0 ? 'Cr' : 'Dr'}`;

    return (
        <div>
            <PageHeader
                title="Vendor Ledger"
                subtitle="The vendor's account in your books: invoices raise what you owe (Cr), payments and notes reduce it (Dr)."
                action={
                    vendorId && (
                        <div className="flex gap-2">
                            <button type="button" className="btn-ghost" onClick={exportXlsx}>
                                <Download className="h-4 w-4" /> Export
                            </button>
                            {can('ACCOUNTS_POST') && (
                                <button type="button" className="btn-primary" onClick={() => setAdjustOpen(true)}>
                                    <Plus className="h-4 w-4" /> Note / adjustment
                                </button>
                            )}
                        </div>
                    )
                }
            />

            <FilterBar search={vendorId ? search : undefined} onSearch={vendorId ? setSearch : undefined} placeholder="Search reference, PO or narration...">
                <Select className="w-64" value={vendorId} onChange={(e) => setVendorId(e.target.value)} options={vendors} placeholder="Select a vendor" aria-label="Vendor" />
                {vendorId && (
                    <>
                        <Select className="w-44" value={filters.po_id} onChange={(e) => setFilters({ ...filters, po_id: e.target.value })} options={(pos.data?.array || []).map((p: any) => ({ value: p.po_id, label: p.po_number }))} placeholder="All POs" aria-label="Purchase order" />
                        <Select className="w-48" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} options={TYPES} placeholder="All transactions" aria-label="Transaction type" />
                        <input type="date" className="input w-40" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} aria-label="From" />
                        <input type="date" className="input w-40" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} aria-label="To" />
                        <label className="flex items-center gap-2 text-[13px] text-slate-600">
                            <input type="checkbox" checked={filters.include_memo} onChange={(e) => setFilters({ ...filters, include_memo: e.target.checked })} className="h-4 w-4 rounded border-line" />
                            Show POs & PIs (memo)
                        </label>
                    </>
                )}
            </FilterBar>

            {!vendorId && (
                <Card padded={false}>
                    <CardHeader title="Outstanding by vendor" className="px-5 pt-5" />
                    {outstanding.data?.array?.length ? (
                        <ul className="divide-y divide-line">
                            {outstanding.data.array.map((r: any) => (
                                <li key={r.vendor_id} className="flex items-center justify-between px-5 py-3">
                                    <button type="button" className="text-[13px] font-medium text-brand-700 hover:underline" onClick={() => setVendorId(r.vendor_id)}>
                                        {r.vendor_name || r.vendor_id}
                                    </button>
                                    <span className={`text-[13px] font-semibold ${r.balance_minor >= 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{signed(r.balance_minor)}</span>
                                </li>
                            ))}
                            <li className="flex items-center justify-between bg-slate-50 px-5 py-3 text-[13px] font-semibold">
                                <span>Total payable / advances</span>
                                <span>
                                    {formatMoney(outstanding.data.total_payable_minor)} Cr · {formatMoney(outstanding.data.total_advance_minor)} Dr
                                </span>
                            </li>
                        </ul>
                    ) : (
                        <EmptyState title={outstanding.loading ? 'Loading…' : 'No vendor balances yet'} hint="Balances appear once invoices are approved or payments made." />
                    )}
                </Card>
            )}

            {vendorId && s && (
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard compact icon={Scale} tone="blue" label="Opening balance" value={signed(s.opening_balance_minor)} />
                    <StatCard compact icon={Scale} tone="violet" label="Invoiced" value={formatMoney(s.invoiced_minor)} caption={`PO value ${formatMoney(s.po_committed_minor)}`} />
                    <StatCard compact icon={Scale} tone="emerald" label="Paid" value={formatMoney(s.paid_minor)} caption={`Advance held ${formatMoney(Math.max(s.advance_balance_minor, 0))}`} />
                    <StatCard compact icon={Scale} tone={s.closing_balance_minor > 0 ? 'amber' : 'emerald'} label="Closing balance" value={signed(s.closing_balance_minor)} caption={`PI unpaid ${formatMoney(s.pi_unpaid_minor)}`} />
                </div>
            )}

            {vendorId && (
                <Card padded={false}>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-line bg-slate-50/80">
                                <tr>
                                    <th className="th">Date</th>
                                    <th className="th">Particular</th>
                                    <th className="th">Reference</th>
                                    <th className="th">PO / RFQ</th>
                                    <th className="th text-right">Debit</th>
                                    <th className="th text-right">Credit</th>
                                    <th className="th text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {ledger.loading && (
                                    <tr>
                                        <td className="td" colSpan={7}>
                                            <div className="h-6 animate-pulse rounded bg-slate-100" />
                                        </td>
                                    </tr>
                                )}
                                {s && (
                                    <tr className="bg-slate-50/60">
                                        <td className="td">{filters.from ? formatDate(filters.from) : '—'}</td>
                                        <td className="td font-medium text-ink">Opening Balance</td>
                                        <td className="td" colSpan={4} />
                                        <td className="td text-right font-medium">{signed(s.opening_balance_minor)}</td>
                                    </tr>
                                )}
                                {(ledger.data?.rows || []).map((r: any, i: number) => (
                                    <tr key={(r.entry_id || r.source_id) + i} className={r.kind === 'memo' ? 'text-slate-400' : ''}>
                                        <td className="td">{formatDate(r.date)}</td>
                                        <td className="td">
                                            <span className={r.kind === 'memo' ? 'italic' : 'font-medium text-ink'}>{r.particular}</span>
                                            {r.narration && <p className="max-w-[320px] truncate text-[11px] text-muted">{r.narration}</p>}
                                        </td>
                                        <td className="td">{r.reference || '—'}</td>
                                        <td className="td">
                                            {r.po_id ? (
                                                <Link href={`/purchase-orders/${r.po_id}`} className="text-brand-700 hover:underline">
                                                    {r.po_number}
                                                </Link>
                                            ) : (
                                                '—'
                                            )}
                                            {r.rfq_number && <p className="text-[11px] text-muted">{r.rfq_number}</p>}
                                        </td>
                                        <td className="td text-right">{r.kind === 'memo' ? '' : r.debit_minor ? formatMoney(r.debit_minor) : '—'}</td>
                                        <td className="td text-right">{r.kind === 'memo' ? formatMoney(r.memo_amount_minor) + ' (memo)' : r.credit_minor ? formatMoney(r.credit_minor) : '—'}</td>
                                        <td className="td text-right font-medium">{r.kind === 'memo' ? '' : signed(r.balance_minor)}</td>
                                    </tr>
                                ))}
                                {s && (
                                    <tr className="border-t-2 border-line bg-slate-50 font-semibold">
                                        <td className="td" />
                                        <td className="td text-ink">Closing Balance</td>
                                        <td className="td" colSpan={2} />
                                        <td className="td text-right">{formatMoney(s.total_debit_minor)}</td>
                                        <td className="td text-right">{formatMoney(s.total_credit_minor)}</td>
                                        <td className="td text-right">{signed(s.closing_balance_minor)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {ledger.error && <p className="px-5 py-4 text-[13px] text-rose-600">{ledger.error}</p>}
                    {ledger.data && !ledger.data.rows.length && <EmptyState title="No transactions in this period" />}
                </Card>
            )}

            <Modal
                open={adjustOpen}
                onClose={() => setAdjustOpen(false)}
                title="Post a note or adjustment"
                description="Posted as a balanced journal entry, so the general ledger moves with the vendor ledger."
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setAdjustOpen(false)}>
                            Cancel
                        </button>
                        <SubmitButton form="adjust-form" type="submit" busy={busy}>
                            Post
                        </SubmitButton>
                    </>
                }
            >
                <form id="adjust-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); adjust(new FormData(e.currentTarget)); }}>
                    <Field label="Type" required className="sm:col-span-2">
                        <Select name="type" value={adjustType} onChange={(e) => setAdjustType(e.target.value)} options={ADJUSTMENTS} />
                    </Field>
                    {(adjustType === 'opening_balance' || adjustType === 'adjustment') && (
                        <Field label="Direction" className="sm:col-span-2">
                            <Select name="direction" options={[{ value: 'credit', label: 'Credit - we owe the vendor more' }, { value: 'debit', label: 'Debit - we owe less / advance' }]} />
                        </Field>
                    )}
                    <Field label="Amount (INR)" required>
                        <Input name="amount" inputMode="decimal" required />
                    </Field>
                    <Field label="Date">
                        <Input name="date" type="date" />
                    </Field>
                    <Field label="Reference (note number)">
                        <Input name="reference" />
                    </Field>
                    <Field label="Against PO">
                        <Select name="po_id" options={(pos.data?.array || []).map((p: any) => ({ value: p.po_id, label: p.po_number }))} placeholder="None" />
                    </Field>
                    <Field label="Narration" className="sm:col-span-2">
                        <Textarea name="narration" rows={2} />
                    </Field>
                </form>
            </Modal>
        </div>
    );
}
