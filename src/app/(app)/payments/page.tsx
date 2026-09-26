'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
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
    status: string;
    created_at: string;
    paid_at: string | null;
};

const TABS = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' }
];

export default function PaymentsPage() {
    const { can } = useAuth();
    const toast = useToast();
    const [tab, setTab] = useState('');
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search);

    const list = useList<Payment>('/procurement/payments/list', { status: tab || undefined, search: debounced });

    async function markPaid(payment: Payment) {
        try {
            await post('/procurement/payments/mark-paid', { payment_id: payment.payment_id });
            toast.success(`${payment.payment_number} marked as paid`);
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    const columns: Column<Payment>[] = [
        {
            key: 'payment_number',
            header: 'Payment',
            render: (p) => (
                <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{p.payment_number}</p>
                    <Link href={`/purchase-orders/${p.po_id}`} className="truncate text-[12px] text-brand-600 hover:underline">
                        {p.po_number}
                    </Link>
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
            render: (p) =>
                p.status === 'pending' && can('PAYMENT_MARK_PAID') ? (
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700 hover:text-emerald-800"
                        onClick={() => markPaid(p)}
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark paid
                    </button>
                ) : null
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

            <FilterBar search={search} onSearch={setSearch} placeholder="Search payment, PO or reference..." />

            <DataTable
                columns={columns}
                rows={list.rows}
                rowKey={(p) => p.payment_id}
                loading={list.loading}
                error={list.error}
                emptyTitle="No payments yet"
                emptyHint="Record payments from a purchase order."
                page={list.page}
                limit={list.limit}
                total={list.total}
                onPageChange={list.setPage}
            />
        </div>
    );
}
