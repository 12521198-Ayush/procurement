'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, Plus } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Field';
import { useAuth } from '@/lib/auth';
import { useDebounced, useList, useOptions } from '@/lib/hooks';
import { countdown, formatDate } from '@/lib/format';

type Rfq = {
    rfq_id: string;
    rfq_number: string;
    title: string;
    status: string;
    expires_at: string;
    created_at: string;
    vendor_count: number;
    quotation_count: number;
    is_expired: boolean;
};

const TABS = [
    { value: '', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'partially_responded', label: 'Partially responded' },
    { value: 'quotation_received', label: 'Quotations received' },
    { value: 'vendor_selected', label: 'Vendor selected' },
    { value: 'expired', label: 'Expired' }
];

export default function RfqListPage() {
    const { can } = useAuth();
    const [tab, setTab] = useState('');
    const [search, setSearch] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const debounced = useDebounced(search);

    const departments = useOptions('/procurement/departments/list', 'department_id');
    const list = useList<Rfq>('/procurement/rfq/list', {
        status: tab || undefined,
        search: debounced,
        department_id: departmentId || undefined
    });

    const columns: Column<Rfq>[] = [
        {
            key: 'rfq_number',
            header: 'RFQ',
            render: (r) => (
                <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{r.rfq_number}</p>
                    <p className="truncate text-[12px] text-muted">{r.title}</p>
                </div>
            )
        },
        {
            key: 'vendors',
            header: 'Responses',
            align: 'center',
            render: (r) => (
                <span className="text-[13px]">
                    <span className="font-medium text-ink">{r.quotation_count}</span>
                    <span className="text-muted"> / {r.vendor_count}</span>
                </span>
            )
        },
        {
            key: 'expires_at',
            header: 'Closes',
            render: (r) => {
                const c = countdown(r.expires_at);
                return (
                    <div>
                        <p className="text-[13px]">{formatDate(r.expires_at)}</p>
                        <p className={c.expired ? 'text-[11px] text-rose-600' : 'text-[11px] text-amber-600'}>{c.text}</p>
                    </div>
                );
            }
        },
        { key: 'created_at', header: 'Created', render: (r) => formatDate(r.created_at) },
        { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} /> },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (r) => (
                <Link
                    href={`/rfq/${r.rfq_id}`}
                    className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label={`Open ${r.rfq_number}`}
                >
                    <Eye className="h-4 w-4" />
                </Link>
            )
        }
    ];

    return (
        <div>
            <PageHeader
                title="Raise Bid / RFQ"
                subtitle="Invite vendors to quote and track their responses."
                action={
                    can('RFQ_CREATE') && (
                        <Link href="/rfq/new" className="btn-primary">
                            <Plus className="h-4 w-4" />
                            Raise RFQ
                        </Link>
                    )
                }
            />

            <div className="mb-4">
                <Tabs tabs={TABS} active={tab} onChange={setTab} />
            </div>

            <FilterBar search={search} onSearch={setSearch} placeholder="Search RFQ number or title...">
                <Select
                    className="w-48"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    options={departments}
                    placeholder="All departments"
                    aria-label="Filter by department"
                />
            </FilterBar>

            <DataTable
                columns={columns}
                rows={list.rows}
                rowKey={(r) => r.rfq_id}
                loading={list.loading}
                error={list.error}
                emptyTitle="No RFQs here"
                emptyHint="Raise an RFQ to invite vendors to quote."
                page={list.page}
                limit={list.limit}
                total={list.total}
                onPageChange={list.setPage}
            />
        </div>
    );
}
