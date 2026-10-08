'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { ShieldAlert } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { Input, Select } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { ADMIN_ROLE } from '@/components/layout/Sidebar';
import { useAuth } from '@/lib/auth';
import { formatDateTime, timeAgo } from '@/lib/format';
import { useDebounced, useList, useResource } from '@/lib/hooks';

type Activity = {
    activity_id: string;
    ts: string;
    kind: 'api' | 'page_view';
    actor_type: string;
    user_id: string | null;
    user_name: string | null;
    role: string | null;
    premise_id: string | null;
    method: string | null;
    path: string | null;
    module: string | null;
    screen: string | null;
    status_code: number | null;
    outcome: 'success' | 'failed';
    error_message: string | null;
    duration_ms?: number;
    entity_type: string | null;
    entity_id: string | null;
    request?: Record<string, unknown>;
    query?: Record<string, unknown> | null;
    ip: string | null;
    user_agent: string | null;
};

type Change = {
    _id: string;
    ts: string;
    actor_type: string;
    user_id: string | null;
    user_name: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    previous_value: unknown;
    new_value: unknown;
    remarks: string | null;
    ip: string | null;
    user_agent: string | null;
};

type Facets = {
    actors: { user_id: string; user_name: string | null; actor_type: string; role: string | null }[];
    modules: string[];
};

const ACTOR_LABEL: Record<string, string> = {
    procurement_user: 'Staff',
    vendor: 'Vendor',
    platform_admin: 'Platform admin',
    anonymous: 'Not signed in'
};

function titleCase(value: string) {
    return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** `/procurement/purchase-orders/send` -> `Purchase Orders › Send`. */
function describeApi(path: string | null) {
    if (!path) return '—';
    return path
        .replace(/^\/procurement\//, '')
        .split('/')
        .filter(Boolean)
        .map(titleCase)
        .join(' › ');
}

function Outcome({ ok, code }: { ok: boolean; code: number | null }) {
    return (
        <span
            className={clsx(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-rose-50 text-rose-700 ring-rose-600/20'
            )}
        >
            {ok ? 'Success' : 'Failed'}
            {code != null && <span className="ml-1 opacity-70">{code}</span>}
        </span>
    );
}

function Who({ name, sub }: { name: string | null; sub: string | null }) {
    return (
        <div className="min-w-0">
            <p className="truncate font-medium text-ink">{name || '—'}</p>
            {sub && <p className="truncate text-[12px] text-muted">{sub}</p>}
        </div>
    );
}

function When({ ts }: { ts: string }) {
    return (
        <div className="whitespace-nowrap">
            <p>{formatDateTime(ts)}</p>
            <p className="text-[12px] text-muted">{timeAgo(ts)}</p>
        </div>
    );
}

function Json({ value }: { value: unknown }) {
    if (value === null || value === undefined) return <p className="text-[13px] text-slate-400">—</p>;
    return (
        <pre className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-700">
            {JSON.stringify(value, null, 2)}
        </pre>
    );
}

function Detail({ rows }: { rows: [string, React.ReactNode][] }) {
    return (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {rows.map(([label, value]) => (
                <div key={label} className="min-w-0">
                    <dt className="text-[12px] text-muted">{label}</dt>
                    <dd className="break-words text-[13px] text-ink">{value ?? '—'}</dd>
                </div>
            ))}
        </dl>
    );
}

function DateFilters({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
    return (
        <>
            <Input type="date" className="w-40" value={from} onChange={(e) => onFrom(e.target.value)} aria-label="From date" />
            <Input type="date" className="w-40" value={to} onChange={(e) => onTo(e.target.value)} aria-label="To date" />
        </>
    );
}

function ActivityTab({ facets }: { facets: Facets | null }) {
    const [search, setSearch] = useState('');
    const [userId, setUserId] = useState('');
    const [kind, setKind] = useState('');
    const [outcome, setOutcome] = useState('');
    const [module, setModule] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [selected, setSelected] = useState<Activity | null>(null);
    const debounced = useDebounced(search);

    const list = useList<Activity>(
        '/procurement/activity-log/list',
        {
            search: debounced || undefined,
            user_id: userId || undefined,
            kind: kind || undefined,
            outcome: outcome || undefined,
            module: module || undefined,
            from: from || undefined,
            to: to || undefined
        },
        { limit: 50 }
    );

    const columns: Column<Activity>[] = [
        { key: 'ts', header: 'Time', render: (a) => <When ts={a.ts} /> },
        {
            key: 'user_name',
            header: 'User',
            render: (a) => <Who name={a.user_name} sub={a.role || ACTOR_LABEL[a.actor_type] || a.actor_type} />
        },
        {
            key: 'activity',
            header: 'Activity',
            render: (a) =>
                a.kind === 'page_view' ? (
                    <div className="min-w-0">
                        <p className="truncate font-medium text-ink">Opened screen</p>
                        <p className="truncate text-[12px] text-muted">{a.screen}</p>
                    </div>
                ) : (
                    <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{describeApi(a.path)}</p>
                        <p className="truncate font-mono text-[11px] text-muted">
                            {a.method} {a.path}
                        </p>
                    </div>
                )
        },
        {
            key: 'screen',
            header: 'Screen',
            render: (a) => (a.kind === 'api' && a.screen ? <span className="font-mono text-[12px]">{a.screen}</span> : <span className="text-slate-400">—</span>)
        },
        {
            key: 'entity',
            header: 'Record',
            render: (a) =>
                a.entity_id ? (
                    <div className="min-w-0">
                        <p className="text-[12px] text-muted">{titleCase(a.entity_type || '')}</p>
                        <p className="max-w-[160px] truncate font-mono text-[11px]">{a.entity_id}</p>
                    </div>
                ) : (
                    <span className="text-slate-400">—</span>
                )
        },
        {
            key: 'outcome',
            header: 'Result',
            render: (a) => (
                <div className="min-w-0">
                    <Outcome ok={a.outcome === 'success'} code={a.kind === 'api' ? a.status_code : null} />
                    {a.error_message && <p className="mt-1 max-w-[220px] truncate text-[12px] text-rose-600">{a.error_message}</p>}
                </div>
            )
        },
        { key: 'ip', header: 'IP', render: (a) => <span className="font-mono text-[12px]">{a.ip || '—'}</span> }
    ];

    return (
        <>
            <FilterBar search={search} onSearch={setSearch} placeholder="Search user, API, screen, record or IP...">
                <Select
                    className="w-48"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    options={(facets?.actors || []).map((u) => ({
                        value: u.user_id,
                        label: `${u.user_name || u.user_id} (${u.role || ACTOR_LABEL[u.actor_type] || u.actor_type})`
                    }))}
                    placeholder="All users"
                    aria-label="Filter by user"
                />
                <Select
                    className="w-40"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    options={[
                        { value: 'api', label: 'Actions (API)' },
                        { value: 'page_view', label: 'Screen views' }
                    ]}
                    placeholder="All activity"
                    aria-label="Filter by type"
                />
                <Select
                    className="w-44"
                    value={module}
                    onChange={(e) => setModule(e.target.value)}
                    options={(facets?.modules || []).map((m) => ({ value: m, label: titleCase(m) }))}
                    placeholder="All modules"
                    aria-label="Filter by module"
                />
                <Select
                    className="w-36"
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    options={[
                        { value: 'success', label: 'Success' },
                        { value: 'failed', label: 'Failed' }
                    ]}
                    placeholder="Any result"
                    aria-label="Filter by result"
                />
                <DateFilters from={from} to={to} onFrom={setFrom} onTo={setTo} />
            </FilterBar>

            <DataTable
                columns={columns}
                rows={list.rows}
                rowKey={(a) => a.activity_id}
                loading={list.loading}
                error={list.error}
                emptyTitle="No activity recorded"
                emptyHint="Actions and screen visits appear here as soon as users work in procurement."
                onRowClick={setSelected}
                page={list.page}
                limit={list.limit}
                total={list.total}
                onPageChange={list.setPage}
            />

            <Modal
                open={!!selected}
                onClose={() => setSelected(null)}
                title={selected?.kind === 'page_view' ? 'Screen view' : describeApi(selected?.path || null)}
                description={selected ? formatDateTime(selected.ts) : undefined}
                size="lg"
            >
                {selected && (
                    <div className="space-y-5">
                        <Detail
                            rows={[
                                ['User', selected.user_name],
                                ['Role / type', selected.role || ACTOR_LABEL[selected.actor_type] || selected.actor_type],
                                ['User ID', selected.user_id],
                                ['Society', selected.premise_id],
                                ['Screen', selected.screen],
                                ['Request', selected.path ? `${selected.method} ${selected.path}` : null],
                                ['Result', <Outcome key="o" ok={selected.outcome === 'success'} code={selected.kind === 'api' ? selected.status_code : null} />],
                                ['Duration', selected.duration_ms != null ? `${selected.duration_ms} ms` : null],
                                ['Record', selected.entity_id ? `${titleCase(selected.entity_type || '')} · ${selected.entity_id}` : null],
                                ['IP address', selected.ip],
                                ['Error', selected.error_message],
                                ['Device', selected.user_agent]
                            ]}
                        />
                        {selected.kind === 'api' && (
                            <div>
                                <p className="mb-1.5 text-[12px] font-medium text-muted">Request data (secrets redacted)</p>
                                <Json value={selected.query ? { ...selected.request, query: selected.query } : selected.request} />
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </>
    );
}

function ChangesTab({ facets }: { facets: Facets | null }) {
    const [search, setSearch] = useState('');
    const [userId, setUserId] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [selected, setSelected] = useState<Change | null>(null);
    const debounced = useDebounced(search);

    const list = useList<Change>(
        '/procurement/audit-log/list',
        { search: debounced || undefined, user_id: userId || undefined, from: from || undefined, to: to || undefined },
        { limit: 50 }
    );

    const columns: Column<Change>[] = [
        { key: 'ts', header: 'Time', render: (c) => <When ts={c.ts} /> },
        { key: 'user_name', header: 'User', render: (c) => <Who name={c.user_name} sub={ACTOR_LABEL[c.actor_type] || c.actor_type} /> },
        { key: 'action', header: 'Action', render: (c) => <span className="font-medium text-ink">{titleCase(c.action.toLowerCase())}</span> },
        {
            key: 'entity',
            header: 'Record',
            render: (c) => (
                <div className="min-w-0">
                    <p className="text-[12px] text-muted">{titleCase(c.entity_type || '')}</p>
                    <p className="max-w-[180px] truncate font-mono text-[11px]">{c.entity_id || '—'}</p>
                </div>
            )
        },
        { key: 'remarks', header: 'Remarks', render: (c) => <span className="line-clamp-2 max-w-[260px]">{c.remarks || '—'}</span> },
        { key: 'ip', header: 'IP', render: (c) => <span className="font-mono text-[12px]">{c.ip || '—'}</span> }
    ];

    return (
        <>
            <FilterBar search={search} onSearch={setSearch} placeholder="Search action, record or user...">
                <Select
                    className="w-48"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    options={(facets?.actors || []).map((u) => ({ value: u.user_id, label: u.user_name || u.user_id }))}
                    placeholder="All users"
                    aria-label="Filter by user"
                />
                <DateFilters from={from} to={to} onFrom={setFrom} onTo={setTo} />
            </FilterBar>

            <DataTable
                columns={columns}
                rows={list.rows}
                rowKey={(c) => c._id}
                loading={list.loading}
                error={list.error}
                emptyTitle="No changes recorded"
                onRowClick={setSelected}
                page={list.page}
                limit={list.limit}
                total={list.total}
                onPageChange={list.setPage}
            />

            <Modal
                open={!!selected}
                onClose={() => setSelected(null)}
                title={selected ? titleCase(selected.action.toLowerCase()) : ''}
                description={selected ? formatDateTime(selected.ts) : undefined}
                size="lg"
            >
                {selected && (
                    <div className="space-y-5">
                        <Detail
                            rows={[
                                ['User', selected.user_name],
                                ['User ID', selected.user_id],
                                ['Record', `${titleCase(selected.entity_type || '')} · ${selected.entity_id || '—'}`],
                                ['IP address', selected.ip],
                                ['Remarks', selected.remarks],
                                ['Device', selected.user_agent]
                            ]}
                        />
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                                <p className="mb-1.5 text-[12px] font-medium text-muted">Before</p>
                                <Json value={selected.previous_value} />
                            </div>
                            <div>
                                <p className="mb-1.5 text-[12px] font-medium text-muted">After</p>
                                <Json value={selected.new_value} />
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}

export default function AuditLogsPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === ADMIN_ROLE;
    const [tab, setTab] = useState('activity');
    const facets = useResource<Facets>(isAdmin ? '/procurement/activity-log/facets' : null);

    if (!isAdmin) {
        return (
            <div className="card mx-auto mt-10 max-w-md px-6 py-10 text-center">
                <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-rose-50 text-rose-500">
                    <ShieldAlert className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">Restricted</p>
                <p className="mt-1 text-[13px] text-muted">Only a Procurement Admin can view audit logs.</p>
            </div>
        );
    }

    return (
        <div>
            <PageHeader
                title="Audit Logs"
                subtitle="Every action and screen visit by staff and vendors in this society. Visible to Procurement Admins only."
            />
            <div className="mb-4">
                <Tabs
                    tabs={[
                        { value: 'activity', label: 'User activity' },
                        { value: 'changes', label: 'Change history' }
                    ]}
                    active={tab}
                    onChange={setTab}
                />
            </div>
            {tab === 'activity' ? <ActivityTab facets={facets.data} /> : <ChangesTab facets={facets.data} />}
        </div>
    );
}
