'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Paperclip } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import DocumentPanel from '@/components/procurement/DocumentPanel';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useList } from '@/lib/hooks';
import { formatDate, formatMoney } from '@/lib/format';

type Payment = {
    payment_id: string;
    payment_number: string;
    po_id: string;
    po_number: string;
    vendor_name: string;
    amount_minor: number;
    currency: string;
    payment_type: string;
    payment_method: string | null;
    reference_number?: string | null;
    proforma_number?: string | null;
    status: string;
    created_at: string;
    paid_at: string | null;
};

const TABS = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'receipts', label: 'Payment receipts' }
];

export default function PaymentsPage({ searchParams }: { searchParams?: { status?: string; tab?: string } }) {
    const { can } = useAuth();
    const toast = useToast();
    const [tab, setTab] = useState(searchParams?.tab || searchParams?.status || '');
    const [search, setSearch] = useState('');
    const [range, setRange] = useState({ from: '', to: '' });
    const [docsFor, setDocsFor] = useState<{ type: string; id: string; title: string } | null>(null);
    const debounced = useDebounced(search);

    const receipts = tab === 'receipts';
    const list = useList<any>(receipts ? '/procurement/payment-receipts/list' : '/procurement/payments/list', {
        status: !receipts && tab ? tab : undefined,
        search: debounced,
        from: range.from || undefined,
        to: range.to || undefined
    });

    async function markPaid(payment: Payment) {
        try {
            await post('/procurement/payments/mark-paid', { payment_id: payment.payment_id });
            toast.success(`${payment.payment_number} marked as paid`);
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    const columns: Column<any>[] = [
        {
            key: 'payment_number',
            header: 'Payment',
            render: (p) => (
                <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{p.payment_number}</p>
                    <Link href={`/purchase-orders/${p.po_id}`} className="truncate text-[12px] text-brand-600 hover:underline">
                        {p.po_number}
                    </Link>
                    {p.proforma_number && <span className="ml-1.5 text-[12px] text-muted">· {p.proforma_number}</span>}
                </div>
            )
        },
        { key: 'vendor_name', header: 'Vendor' },
        {
            key: 'amount_minor',
            header: 'Amount',
            align: 'right',
            render: (p) => <span className="font-medium text-ink">{formatMoney(p.amount_minor, p.currency)}</span>
        },
        {
            key: 'payment_type',
            header: 'Type',
            render: (p) => <StatusPill status={p.payment_type === 'full' ? 'completed' : 'partial'} />
        },
        { key: 'payment_method', header: 'Method', render: (p) => p.payment_method?.replace(/_/g, ' ') ?? '—' },
        { key: 'created_at', header: 'Date', render: (p) => formatDate(p.paid_at || p.created_at) },
        { key: 'status', header: 'Status', render: (p) => <StatusPill status={p.status} /> },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (p) => (
                <div className="flex items-center justify-end gap-2">
                    {p.status === 'pending' && can('PAYMENT_MARK_PAID') && (
                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700 hover:text-emerald-800"
                            onClick={() => markPaid(p)}
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark paid
                        </button>
                    )}
                    <button type="button" title="Payment proof" className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100" onClick={() => setDocsFor({ type: 'payment', id: p.payment_id, title: p.payment_number })}>
                        <Paperclip className="h-4 w-4" />
                    </button>
                </div>
            )
        }
    ];

    const receiptColumns: Column<any>[] = [
        { key: 'receipt_number', header: 'Receipt', render: (r) => <div><p className="font-medium text-ink">{r.receipt_number}</p><p className="text-[12px] text-muted">{r.payment_number}</p></div> },
        { key: 'vendor_name', header: 'Vendor' },
        { key: 'po_number', header: 'PO', render: (r) => <Link className="text-brand-700 hover:underline" href={`/purchase-orders/${r.po_id}`}>{r.po_number}</Link> },
        { key: 'amount_minor', header: 'Amount', align: 'right', render: (r) => formatMoney(r.amount_minor, r.currency) },
        { key: 'paid_at', header: 'Paid', render: (r) => formatDate(r.paid_at) },
        { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} /> },
        {
            key: 'docs', header: '', align: 'right',
            render: (r) => (
                <button type="button" title="Receipt documents" className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100" onClick={() => setDocsFor({ type: 'payment_receipt', id: r.receipt_id, title: r.receipt_number })}>
                    <Paperclip className="h-4 w-4" />
                </button>
            )
        }
    ];

    return (
        <div>
            <PageHeader
                title="Invoices & Payments"
                subtitle="Partial payments are supported; the total can never exceed the purchase order."
            />

            <div className="mb-4">
                <Tabs tabs={TABS} active={tab} onChange={setTab} />
            </div>

            <FilterBar search={search} onSearch={setSearch} placeholder={receipts ? 'Search receipt, payment, PO or vendor...' : 'Search payment, PO, PI or reference...'}>
                <input type="date" className="input w-40" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="From" />
                <input type="date" className="input w-40" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="To" />
            </FilterBar>

            <DataTable
                columns={receipts ? receiptColumns : columns}
                rows={list.rows}
                rowKey={(p) => (receipts ? p.receipt_id : p.payment_id)}
                loading={list.loading}
                error={list.error}
                emptyTitle="No payments yet"
                emptyHint="Record payments from a purchase order."
                page={list.page}
                limit={list.limit}
                total={list.total}
                onPageChange={list.setPage}
            />

            <Modal open={!!docsFor} onClose={() => setDocsFor(null)} title={`Documents - ${docsFor?.title || ''}`} size="lg">
                {docsFor && <DocumentPanel entityType={docsFor.type} entityId={docsFor.id} bare canUpload={can('DOCUMENT_UPLOAD')} canDelete={can('DOCUMENT_DELETE')} />}
            </Modal>
        </div>
    );
}
