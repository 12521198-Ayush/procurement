'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { useDebounced } from '@/lib/hooks';
import { P } from '@/lib/vendor-api';
import { useVendorList } from '@/lib/vendor-hooks';
import { formatDate, formatMoney } from '@/lib/format';

const TABS = [
    { value: '', label: 'All' },
    { value: 'to_accept', label: 'To accept' },
    { value: 'to_dispatch', label: 'To dispatch' },
    { value: 'status:partially_fulfilled', label: 'Partially received' },
    { value: 'status:received', label: 'Received' },
    { value: 'status:completed', label: 'Completed' },
    { value: 'status:cancelled', label: 'Cancelled' }
];

export default function VendorOrdersPage({ searchParams }: { searchParams?: { stage?: string } }) {
    const router = useRouter();
    const [tab, setTab] = useState(searchParams?.stage || '');
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search);
    const isStatus = tab.startsWith('status:');
    const list = useVendorList<any>(P + 'orders/list', { stage: !isStatus && tab ? tab : undefined, status: isStatus ? tab.slice(7) : undefined, search: debounced });

    const columns: Column<any>[] = [
        { key: 'po_number', header: 'Purchase order', render: (p) => <div><p className="font-medium text-ink">{p.po_number}</p><p className="text-[12px] text-muted">{p.rfq_number || '—'}</p></div> },
        { key: 'sent_at', header: 'Issued', render: (p) => formatDate(p.sent_at || p.created_at) },
        { key: 'expected_delivery_date', header: 'Deliver by', render: (p) => formatDate(p.expected_delivery_date) },
        { key: 'value', header: 'Value', align: 'right', render: (p) => <span className="font-medium text-ink">{formatMoney(p.grand_total_minor, p.currency)}</span> },
        { key: 'paid', header: 'Paid', align: 'right', render: (p) => formatMoney(p.paid_minor || 0, p.currency) },
        { key: 'status', header: 'Status', render: (p) => <StatusPill status={p.status} /> }
    ];

    return (
        <div>
            <PageHeader title="Purchase Orders" subtitle="Accept orders, raise proforma invoices, dispatch goods and invoice." />
            <div className="mb-4"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
            <FilterBar search={search} onSearch={setSearch} placeholder="Search PO, RFQ or quotation number..." />
            <DataTable columns={columns} rows={list.rows} rowKey={(p) => p.po_id} loading={list.loading} error={list.error}
                onRowClick={(p) => router.push(`/vendor/orders/${p.po_id}`)} emptyTitle="No purchase orders here"
                page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />
        </div>
    );
}
