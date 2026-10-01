'use client';

import { useState } from 'react';
import Link from 'next/link';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { useDebounced } from '@/lib/hooks';
import { P, vendorPost } from '@/lib/vendor-api';
import { useVendorList } from '@/lib/vendor-hooks';
import { formatDate, formatMoney } from '@/lib/format';

const TABS = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'In process' },
    { value: 'completed', label: 'Received' }
];

export default function VendorPaymentsPage() {
    const toast = useToast();
    const [tab, setTab] = useState('');
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search);
    const list = useVendorList<any>(P + 'payments/list', { status: tab || undefined, search: debounced });

    async function acknowledge(receiptId: string) {
        try {
            await vendorPost(P + 'receipts/acknowledge', { receipt_id: receiptId });
            toast.success('Receipt acknowledged');
            list.reload();
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    const columns: Column<any>[] = [
        { key: 'payment_number', header: 'Payment', render: (p) => <div><p className="font-medium text-ink">{p.payment_number}</p><p className="text-[12px] text-muted">{p.proforma_number || 'Against PO'}</p></div> },
        { key: 'po_number', header: 'PO', render: (p) => <Link href={`/vendor/orders/${p.po_id}`} className="text-brand-700 hover:underline">{p.po_number}</Link> },
        { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-medium text-ink">{formatMoney(p.amount_minor, p.currency)}</span> },
        { key: 'method', header: 'Method / ref', render: (p) => <span className="text-[12px]">{(p.payment_method || '—').replace(/_/g, ' ')}{p.reference_number ? ` · ${p.reference_number}` : ''}</span> },
        { key: 'date', header: 'Date', render: (p) => formatDate(p.paid_at || p.created_at) },
        { key: 'status', header: 'Status', render: (p) => <StatusPill status={p.status} /> },
        {
            key: 'receipt', header: 'Receipt', align: 'right',
            render: (p) => p.receipt ? (
                p.receipt.status === 'issued' ? (
                    <button type="button" className="text-[13px] font-medium text-brand-600 hover:underline" onClick={() => acknowledge(p.receipt.receipt_id)}>Acknowledge {p.receipt.receipt_number}</button>
                ) : <span className="text-[12px] text-emerald-700">{p.receipt.receipt_number} ✓</span>
            ) : '—'
        }
    ];

    return (
        <div>
            <PageHeader title="Payments" subtitle="Payments released to you, with their payment receipts." />
            <div className="mb-4"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
            <FilterBar search={search} onSearch={setSearch} placeholder="Search payment, PO, PI or reference..." />
            <DataTable columns={columns} rows={list.rows} rowKey={(p) => p.payment_id} loading={list.loading} error={list.error}
                emptyTitle="No payments yet" page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />
        </div>
    );
}
