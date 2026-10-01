'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Eye, FolderOpen, Search, XCircle } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { Field, Textarea } from '@/components/ui/Field';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import DocumentPanel from '@/components/procurement/DocumentPanel';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useList } from '@/lib/hooks';
import { formatDate, formatMoney } from '@/lib/format';

type Pi = {
    proforma_id: string;
    proforma_number: string;
    vendor_pi_number: string | null;
    po_id: string;
    po_number: string;
    rfq_number: string | null;
    vendor_name: string;
    grand_total_minor: number;
    amount_minor: number;
    paid_minor: number;
    currency: string;
    status: string;
    invoice_date: string;
    submitted_at: string | null;
    pi_type: string;
};

const TABS = [
    { value: 'pending', label: 'Pending review' },
    { value: 'payable', label: 'Approved, unpaid' },
    { value: 'paid', label: 'Paid' },
    { value: 'rejected', label: 'Rejected' },
    { value: '', label: 'All' }
];

export default function ProformaInvoicesPage({ searchParams }: { searchParams?: { status?: string; id?: string; po?: string } }) {
    const { can } = useAuth();
    const [tab, setTab] = useState(searchParams?.status ?? (searchParams?.id || searchParams?.po ? '' : 'pending'));
    const [search, setSearch] = useState('');
    const [range, setRange] = useState({ from: '', to: '' });
    const [openId, setOpenId] = useState<string | null>(searchParams?.id || null);
    const debounced = useDebounced(search);

    const list = useList<Pi>('/procurement/proforma/list', {
        status: tab || undefined,
        po_id: searchParams?.po || undefined,
        search: debounced,
        from: range.from || undefined,
        to: range.to || undefined
    });

    const columns: Column<Pi>[] = [
        {
            key: 'proforma_number',
            header: 'Proforma invoice',
            render: (p) => (
                <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{p.proforma_number}</p>
                    <p className="truncate text-[12px] text-muted">{p.vendor_pi_number ? `Vendor ref ${p.vendor_pi_number}` : p.pi_type === 'advance' ? 'Advance' : 'Itemised'}</p>
                </div>
            )
        },
        { key: 'vendor_name', header: 'Vendor' },
        {
            key: 'po_number',
            header: 'PO / RFQ',
            render: (p) => (
                <div>
                    <Link href={`/purchase-orders/${p.po_id}`} onClick={(e) => e.stopPropagation()} className="text-brand-700 hover:underline">
                        {p.po_number}
                    </Link>
                    <p className="text-[12px] text-muted">{p.rfq_number || '—'}</p>
                </div>
            )
        },
        { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-medium text-ink">{formatMoney(p.grand_total_minor ?? p.amount_minor, p.currency)}</span> },
        { key: 'paid', header: 'Paid', align: 'right', render: (p) => formatMoney(p.paid_minor || 0, p.currency) },
        { key: 'submitted_at', header: 'Submitted', render: (p) => formatDate(p.submitted_at || p.invoice_date) },
        { key: 'status', header: 'Status', render: (p) => <StatusPill status={p.status} /> },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: () => <Eye className="ml-auto h-4 w-4 text-slate-400" />
        }
    ];

    return (
        <div>
            <PageHeader title="Proforma Invoices" subtitle="Review vendor PIs before they are paid. Prices always come from the purchase order." />
            <div className="mb-4">
                <Tabs tabs={TABS} active={tab} onChange={setTab} />
            </div>
            <FilterBar search={search} onSearch={setSearch} placeholder="Search PI, PO, RFQ or vendor...">
                <input type="date" className="input w-40" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="PI date from" />
                <input type="date" className="input w-40" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="PI date to" />
            </FilterBar>
            <DataTable
                columns={columns}
                rows={list.rows}
                rowKey={(p) => p.proforma_id}
                loading={list.loading}
                error={list.error}
                onRowClick={(p) => setOpenId(p.proforma_id)}
                emptyTitle="No proforma invoices here"
                emptyHint="Vendors submit PIs from their portal once a PO is issued."
                page={list.page}
                limit={list.limit}
                total={list.total}
                onPageChange={list.setPage}
            />
            {openId && <PiDrawer id={openId} canReview={can('PI_REVIEW')} onClose={() => setOpenId(null)} onChanged={list.reload} />}
        </div>
    );
}

function PiDrawer({ id, canReview, onClose, onChanged }: { id: string; canReview: boolean; onClose: () => void; onChanged: () => void }) {
    const toast = useToast();
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [rejecting, setRejecting] = useState(false);

    async function load() {
        try {
            setData(await post('/procurement/proforma/detail', { proforma_id: id }));
        } catch (err: any) {
            setError(err.message);
        }
    }
    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    async function review(action: string, remarks?: string) {
        setBusy(true);
        try {
            await post('/procurement/proforma/review', { proforma_id: id, action, remarks });
            toast.success(action === 'approve' ? 'PI approved for payment' : action === 'reject' ? 'PI rejected - vendor notified' : 'Marked under review');
            setRejecting(false);
            await load();
            onChanged();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    const pi = data?.proforma_invoice;
    const reviewable = pi && ['submitted', 'under_review'].includes(pi.status);

    return (
        <Modal open onClose={onClose} title={pi ? `Proforma invoice ${pi.proforma_number}` : 'Proforma invoice'} description={pi ? `${pi.vendor_name} · ${pi.po_number}` : undefined} size="xl"
            footer={
                pi && canReview && reviewable ? (
                    <>
                        {pi.status === 'submitted' && (
                            <button type="button" className="btn-ghost" onClick={() => review('start_review')} disabled={busy}>
                                <Search className="h-4 w-4" />
                                Start review
                            </button>
                        )}
                        <button type="button" className="btn-ghost text-rose-600" onClick={() => setRejecting(true)} disabled={busy}>
                            <XCircle className="h-4 w-4" />
                            Reject
                        </button>
                        <button type="button" className="btn-primary" onClick={() => review('approve')} disabled={busy}>
                            <CheckCircle2 className="h-4 w-4" />
                            Approve for payment
                        </button>
                    </>
                ) : undefined
            }
        >
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
            {!pi && !error && <div className="h-40 animate-pulse rounded-lg bg-slate-100" />}
            {pi && (
                <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={pi.status} />
                        <Link href={`/lifecycle?po=${pi.po_id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600">
                            <FolderOpen className="h-4 w-4" /> Procurement file
                        </Link>
                        {pi.review_remarks && <span className="text-[12px] text-rose-700">Review remarks: {pi.review_remarks}</span>}
                    </div>
                    <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                        <Info label="PO" value={pi.po_number} />
                        <Info label="RFQ" value={pi.rfq_number} />
                        <Info label="Vendor PI ref." value={pi.vendor_pi_number} />
                        <Info label="PI date" value={formatDate(pi.invoice_date)} />
                        <Info label="Valid until" value={formatDate(pi.valid_until)} />
                        <Info label="Expected delivery" value={formatDate(pi.expected_delivery_date)} />
                        <Info label="Payment terms" value={pi.payment_terms} />
                        <Info label="Shipping terms" value={pi.shipping_terms} />
                        <Info label="Payable now" value={formatMoney(data.payable_minor, pi.currency)} />
                    </dl>
                    <div className="overflow-x-auto rounded-lg border border-line">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="th">Item</th>
                                    <th className="th text-right">Qty</th>
                                    <th className="th text-right">Unit price</th>
                                    <th className="th text-right">Discount</th>
                                    <th className="th text-right">Tax</th>
                                    <th className="th text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {(pi.items || []).map((l: any) => (
                                    <tr key={l.line_no}>
                                        <td className="td">{l.name}</td>
                                        <td className="td text-right">
                                            {l.quantity} {l.unit}
                                        </td>
                                        <td className="td text-right">{formatMoney(l.unit_price_minor, pi.currency)}</td>
                                        <td className="td text-right">{formatMoney(l.discount_minor, pi.currency)}</td>
                                        <td className="td text-right">{formatMoney(l.tax_minor, pi.currency)}</td>
                                        <td className="td text-right font-medium">{formatMoney(l.total_minor, pi.currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-line bg-slate-50">
                                    <td className="td font-semibold" colSpan={5}>
                                        Total{pi.shipping_minor || pi.other_charges_minor ? ' (incl. shipping & charges)' : ''}
                                    </td>
                                    <td className="td text-right font-semibold">{formatMoney(pi.grand_total_minor ?? pi.amount_minor, pi.currency)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    {pi.bank_details && (
                        <div className="rounded-lg bg-slate-50 p-3 text-[13px] text-slate-600">
                            <p className="mb-1 font-medium text-ink">Bank details</p>
                            {[pi.bank_details.account_name, pi.bank_details.bank_name, pi.bank_details.account_number && `A/c ${pi.bank_details.account_number}`, pi.bank_details.ifsc && `IFSC ${pi.bank_details.ifsc}`, pi.bank_details.upi_id && `UPI ${pi.bank_details.upi_id}`]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                        </div>
                    )}
                    {pi.notes && <p className="text-[13px] text-slate-600">Notes: {pi.notes}</p>}
                    {data.payments.length > 0 && (
                        <div>
                            <p className="section-title mb-2">Payments</p>
                            <ul className="divide-y divide-line rounded-lg border border-line">
                                {data.payments.map((p: any) => (
                                    <li key={p.payment_id} className="flex items-center justify-between px-3 py-2 text-[13px]">
                                        <span>
                                            {p.payment_number} · {formatDate(p.paid_at || p.created_at)}
                                        </span>
                                        <span className="flex items-center gap-2">
                                            {formatMoney(p.amount_minor, p.currency)}
                                            <StatusPill status={p.status} />
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <DocumentPanel entityType="proforma_invoice" entityId={pi.proforma_id} title="PI documents" bare canUpload={false} />
                </div>
            )}

            <Modal open={rejecting} onClose={() => setRejecting(false)} title="Reject proforma invoice" description="The vendor sees this reason and can correct and resubmit." size="sm"
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setRejecting(false)}>
                            Cancel
                        </button>
                        <SubmitButton form="reject-pi" type="submit" busy={busy}>
                            Reject
                        </SubmitButton>
                    </>
                }
            >
                <form
                    id="reject-pi"
                    onSubmit={(e) => {
                        e.preventDefault();
                        review('reject', String(new FormData(e.currentTarget).get('remarks') || ''));
                    }}
                >
                    <Field label="Reason" required>
                        <Textarea name="remarks" rows={3} required />
                    </Field>
                </form>
            </Modal>
        </Modal>
    );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
            <dd className="text-ink">{value || '—'}</dd>
        </div>
    );
}
