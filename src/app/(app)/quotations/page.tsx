'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, GitCompare } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { useDebounced, useList } from '@/lib/hooks';
import { formatDate, formatMoney } from '@/lib/format';

type Quotation = {
    quotation_id: string;
    quotation_number: string;
    rfq_id: string;
    rfq_number: string | null;
    rfq_title: string | null;
    vendor_name: string;
    grand_total_minor: number;
    currency: string;
    status: string;
    submitted_at: string;
    delivery_days: number | null;
};

const TABS = [
    { value: '', label: 'All' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'selected', label: 'Selected' },
    { value: 'not_selected', label: 'Not selected' }
];

export default function QuotationsPage() {
    const [tab, setTab] = useState('');
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search);

    const list = useList<Quotation>('/procurement/quotations/list', {
        status: tab || undefined,
        search: debounced
    });

    const columns: Column<Quotation>[] = [
        {
            key: 'quotation_number',
            header: 'Quotation',
            render: (q) => (
                <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{q.quotation_number}</p>
                    <p className="truncate text-[12px] text-muted">{q.rfq_number ?? '—'}</p>
                </div>
            )
        },
        { key: 'vendor_name', header: 'Vendor' },
        {
            key: 'grand_total_minor',
            header: 'Amount',
            align: 'right',
            render: (q) => <span className="font-medium text-ink">{formatMoney(q.grand_total_minor, q.currency)}</span>
        },
        {
            key: 'delivery_days',
            header: 'Delivery',
            render: (q) => (q.delivery_days != null ? `${q.delivery_days} days` : '—')
        },
        { key: 'submitted_at', header: 'Submitted', render: (q) => formatDate(q.submitted_at) },
        { key: 'status', header: 'Status', render: (q) => <StatusPill status={q.status} /> },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (q) => (
                <Link
                    href={`/quotations/compare/${q.rfq_id}`}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-700"
                >
                    <GitCompare className="h-3.5 w-3.5" />
                    Compare
                </Link>
            )
        }
    ];

    return (
        <div>
            <PageHeader title="My Quotations" subtitle="Everything vendors have submitted against your RFQs." />

            <div className="mb-4">
                <Tabs tabs={TABS} active={tab} onChange={setTab} />
            </div>

            <FilterBar search={search} onSearch={setSearch} placeholder="Search quotation or vendor..." />

            <DataTable
                columns={columns}
                rows={list.rows}
                rowKey={(q) => q.quotation_id}
                loading={list.loading}
                error={list.error}
                emptyTitle="No quotations yet"
                emptyHint="Once vendors respond to your RFQs their quotations appear here."
                page={list.page}
                limit={list.limit}
                total={list.total}
                onPageChange={list.setPage}
            />
        </div>
    );
}
