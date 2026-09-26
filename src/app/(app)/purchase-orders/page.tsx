'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { useDebounced, useList } from '@/lib/hooks';
import { formatDate, formatMoney } from '@/lib/format';

type Po = {
    po_id: string;
    po_number: string;
    vendor_name: string;
    rfq_number: string | null;
    grand_total_minor: number;
    paid_minor: number;
    remaining_minor: number;
    currency: string;
    status: string;
    created_at: string;
};

const TABS = [
    { value: '', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'pending_approval', label: 'Pending approval' },
    { value: 'approved', label: 'Approved' },
    { value: 'sent', label: 'Sent' },
    { value: 'partially_fulfilled', label: 'Partially fulfilled' },
    { value: 'completed', label: 'Completed' }
];

export default function PurchaseOrdersPage() {
    const [tab, setTab] = useState('');
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search);

    const list = useList<Po>('/procurement/purchase-orders/list', {
        status: tab || undefined,
        search: debounced
    });

    const columns: Column<Po>[] = [
        {
            key: 'po_number',
            header: 'Purchase order',
            render: (p) => (
                <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{p.po_number}</p>
                    <p className="truncate text-[12px] text-muted">{p.rfq_number ?? '—'}</p>
                </div>
            )
        },
        { key: 'vendor_name', header: 'Vendor' },
        {
            key: 'grand_total_minor',
            header: 'Value',
            align: 'right',
            render: (p) => <span className="font-medium text-ink">{formatMoney(p.grand_total_minor, p.currency)}</span>
        },
        {
            key: 'paid',
            header: 'Paid',
            align: 'right',
            render: (p) => (
                <div>
                    <p className="text-[13px] text-emerald-700">{formatMoney(p.paid_minor, p.currency)}</p>
                    {p.remaining_minor > 0 && (
                        <p className="text-[11px] text-amber-600">{formatMoney(p.remaining_minor, p.currency)} due</p>
                    )}
                </div>
            )
        },
        { key: 'created_at', header: 'Created', render: (p) => formatDate(p.created_at) },
        { key: 'status', header: 'Status', render: (p) => <StatusPill status={p.status} /> },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (p) => (
                <Link
                    href={`/purchase-orders/${p.po_id}`}
                    className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label={`Open ${p.po_number}`}
                >
                    <Eye className="h-4 w-4" />
                </Link>
            )
        }
    ];

    return (
        <div>
            <PageHeader
                title="Purchase Orders"
                subtitle="Raised from the quotation you selected, so the figures always match."
            />

            <div className="mb-4">
                <Tabs tabs={TABS} active={tab} onChange={setTab} />
            </div>

            <FilterBar search={search} onSearch={setSearch} placeholder="Search PO number or vendor..." />

            <DataTable
                columns={columns}
                rows={list.rows}
                rowKey={(p) => p.po_id}
                loading={list.loading}
                error={list.error}
                emptyTitle="No purchase orders yet"
                emptyHint="Select a vendor from a quotation comparison to raise your first PO."
                page={list.page}
                limit={list.limit}
                total={list.total}
                onPageChange={list.setPage}
            />
        </div>
    );
}
