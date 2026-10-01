'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { useDebounced } from '@/lib/hooks';
import { P } from '@/lib/vendor-api';
import { useVendorList } from '@/lib/vendor-hooks';
import { countdown, formatDateTime, formatMoney } from '@/lib/format';

const TABS = [
    { value: '', label: 'All' },
    { value: 'new', label: 'New' },
    { value: 'in_progress', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'under_evaluation', label: 'Under evaluation' },
    { value: 'awarded', label: 'Awarded' },
    { value: 'not_selected', label: 'Not selected' },
    { value: 'closed', label: 'Closed' }
];

export default function VendorRfqsPage({ searchParams }: { searchParams?: { stage?: string } }) {
    const router = useRouter();
    const [tab, setTab] = useState(searchParams?.stage || '');
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search);
    const list = useVendorList<any>(P + 'rfqs/list', { stage: tab || undefined, search: debounced });

    const columns: Column<any>[] = [
        { key: 'rfq_number', header: 'RFQ', render: (r) => <div className="min-w-0"><p className="font-medium text-ink">{r.rfq_number}</p><p className="truncate text-[12px] text-muted">{r.title}</p></div> },
        {
            key: 'expires_at', header: 'Closes', render: (r) => {
                const c = countdown(r.expires_at);
                return <div><p className="text-[13px]">{formatDateTime(r.expires_at)}</p><p className={c.expired ? 'text-[11px] text-slate-400' : 'text-[11px] text-amber-600'}>{c.text}</p></div>;
            }
        },
        { key: 'quote', header: 'Your quotation', render: (r) => (r.quotation ? <span>{r.quotation.quotation_number}{r.quotation.version > 1 ? ` v${r.quotation.version}` : ''} · {formatMoney(r.quotation.grand_total_minor, r.quotation.currency)}</span> : '—') },
        { key: 'stage', header: 'Status', render: (r) => <StatusPill status={r.stage} /> },
        { key: 'go', header: '', align: 'right', render: (r) => <Link href={`/vendor/rfqs/${r.rfq_id}`} className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label={`Open ${r.rfq_number}`}><Eye className="h-4 w-4" /></Link> }
    ];

    return (
        <div>
            <PageHeader title="RFQs & Quotations" subtitle="Every RFQ you are invited to. Quotations are sealed until the buyer opens bids." />
            <div className="mb-4"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
            <FilterBar search={search} onSearch={setSearch} placeholder="Search RFQ number or title..." />
            <DataTable columns={columns} rows={list.rows} rowKey={(r) => r.rfq_id} loading={list.loading} error={list.error}
                onRowClick={(r) => router.push(`/vendor/rfqs/${r.rfq_id}`)}
                emptyTitle="No RFQs here" page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />
        </div>
    );
}
