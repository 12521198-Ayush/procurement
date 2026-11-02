'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, History, PencilLine, PiggyBank, Plus, TrendingDown, Wallet, X } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import StatCard from '@/components/ui/StatCard';
import { Tabs } from '@/components/ui/Tabs';
import { FilterBar, PageHeader } from '@/components/ui/PageHeader';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced, useList, useOptions } from '@/lib/hooks';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { QueryParams } from '@/lib/search-params';

type Budget = {
    budget_id: string;
    label: string;
    department_name: string | null;
    category_name: string | null;
    subcategory_name: string | null;
    financial_year: string;
    currency: string;
    original_allocated_minor: number;
    allocated_minor: number;
    used_minor: number;
    committed_minor: number;
    spent_minor: number;
    remaining_minor: number;
    utilisation_percent: number;
    is_exceeded: boolean;
    is_revised: boolean;
    revision_count: number;
};

type Revision = {
    revision_id: string;
    budget_id: string;
    budget_label: string;
    type: 'created' | 'manual_update' | 'approval_increase';
    currency: string;
    previous_allocated_minor: number;
    new_allocated_minor: number;
    delta_minor: number;
    used_minor: number;
    reason: string | null;
    po_id: string | null;
    po_number: string | null;
    vendor_name?: string | null;
    approved_by_name: string | null;
    approved_at: string | null;
    approval_comments: string | null;
    requested_by_name?: string | null;
    actor_name: string | null;
    ts: string;
};

type Approval = {
    approval_request_id: string;
    entity_type: string;
    entity_id: string;
    entity_number?: string;
    vendor_name?: string;
    kind?: string;
    amount_minor: number;
    currency?: string;
    requested_by_name: string;
    reason: string | null;
    status: string;
    awaiting_role: string | null;
    can_act: boolean;
    blocked_reason: string | null;
    waiting_hours: number;
    current_step: number;
    total_steps: number;
    created_at: string;
    decided_at?: string;
    decided_by_name?: string;
    decision_comments?: string | null;
    budget?: { label: string; allocated_minor: number; remaining_minor: number; shortfall_minor: number };
    budget_live?: { label: string; allocated_minor: number; used_minor: number; remaining_minor: number; shortfall_minor: number; revised_allocated_minor: number };
    budget_revision?: { budget_label: string; previous_allocated_minor: number; new_allocated_minor: number; delta_minor: number };
};

const TYPE_LABEL: Record<string, string> = {
    created: 'Allocated',
    manual_update: 'Revised manually',
    approval_increase: 'Raised by approval'
};

export default function BudgetPage({ searchParams }: { searchParams?: QueryParams }) {
    const { can } = useAuth();
    const toast = useToast();
    const [tab, setTab] = useState(searchParams?.tab || 'budgets');
    const [search, setSearch] = useState('');
    const debounced = useDebounced(search);

    const budgets = useList<Budget>('/procurement/budgets/list', { search: debounced });
    const pending = useList<Approval>('/procurement/approvals/list', { status: 'pending' });
    const decided = useList<Approval>('/procurement/approvals/list', { status: 'decided' });
    const history = useList<Revision>('/procurement/budgets/history', { search: tab === 'history' ? debounced : undefined });

    const [allocating, setAllocating] = useState(false);
    const [revising, setRevising] = useState<Budget | null>(null);
    const [historyFor, setHistoryFor] = useState<Budget | null>(null);
    const [deciding, setDeciding] = useState<{ request: Approval; action: 'approve' | 'reject' } | null>(null);
    const [busy, setBusy] = useState(false);

    const totals = budgets.meta?.totals ?? { allocated_minor: 0, used_minor: 0, remaining_minor: 0 };

    async function decide(form: FormData) {
        if (!deciding) return;
        setBusy(true);
        try {
            const res = await post<Approval>('/procurement/approvals/act', {
                approval_request_id: deciding.request.approval_request_id,
                action: deciding.action,
                comments: form.get('comments') || undefined
            });
            const rev = res.budget_revision;
            toast.success(
                deciding.action === 'reject'
                    ? 'Rejected - the purchase order was cancelled'
                    : rev && rev.delta_minor
                      ? `Approved. ${rev.budget_label} revised to ${formatMoney(rev.new_allocated_minor)}`
                      : 'Approved'
            );
            setDeciding(null);
            pending.reload();
            decided.reload();
            budgets.reload();
            history.reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    const budgetColumns: Column<Budget>[] = [
        {
            key: 'label',
            header: 'Budget',
            render: (b) => (
                <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{[b.category_name, b.subcategory_name].filter(Boolean).join(' / ') || b.department_name}</p>
                    <p className="truncate text-[12px] text-muted">
                        {b.subcategory_name ? 'Subcategory budget' : b.category_name ? 'Category budget' : 'Department budget'}
                        {b.department_name && (b.category_name || b.subcategory_name) ? ` · ${b.department_name}` : ''}
                    </p>
                </div>
            )
        },
        { key: 'financial_year', header: 'FY' },
        {
            key: 'allocated_minor',
            header: 'Allocated',
            align: 'right',
            render: (b) => (
                <div>
                    <p className="font-medium text-ink">{formatMoney(b.allocated_minor, b.currency)}</p>
                    {b.is_revised && (
                        <p className="text-[11px] text-violet-700" title={`${b.revision_count} revision(s)`}>
                            Revised from {formatMoney(b.original_allocated_minor, b.currency)}
                        </p>
                    )}
                </div>
            )
        },
        {
            key: 'used_minor',
            header: 'Committed / spent',
            align: 'right',
            render: (b) => (
                <div className="text-[13px]">
                    <p>{formatMoney(b.committed_minor || 0, b.currency)}</p>
                    <p className="text-[11px] text-muted">{formatMoney(b.spent_minor || 0, b.currency)} paid</p>
                </div>
            )
        },
        {
            key: 'remaining_minor',
            header: 'Remaining',
            align: 'right',
            render: (b) => (
                <span className={b.is_exceeded ? 'font-medium text-rose-600' : 'font-medium text-emerald-700'}>{formatMoney(b.remaining_minor, b.currency)}</span>
            )
        },
        {
            key: 'utilisation_percent',
            header: 'Utilisation',
            render: (b) => (
                <div className="min-w-[110px]">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                            className={`h-full rounded-full ${b.is_exceeded ? 'bg-rose-500' : b.utilisation_percent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(b.utilisation_percent, 100)}%` }}
                        />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{b.utilisation_percent}%</p>
                </div>
            )
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (b) => (
                <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700" onClick={() => setHistoryFor(b)}>
                        <History className="h-3.5 w-3.5" /> History
                    </button>
                    {can('BUDGET_CREATE') && (
                        <button type="button" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700" onClick={() => setRevising(b)}>
                            <PencilLine className="h-3.5 w-3.5" /> Revise
                        </button>
                    )}
                </div>
            )
        }
    ];

    const requestCell = (a: Approval) => (
        <div className="min-w-0">
            {a.entity_type === 'purchase_order' ? (
                <Link href={`/purchase-orders/${a.entity_id}`} className="font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
                    {a.entity_number || 'Purchase order'}
                </Link>
            ) : (
                <p className="font-medium text-ink">{a.entity_type.replace(/_/g, ' ')}</p>
            )}
            <p className="truncate text-[12px] text-muted">{[a.vendor_name, a.kind === 'budget_override' ? 'Out-of-budget' : null].filter(Boolean).join(' · ') || '—'}</p>
        </div>
    );

    const pendingColumns: Column<Approval>[] = [
        { key: 'entity', header: 'Request', render: requestCell },
        { key: 'amount_minor', header: 'Order value', align: 'right', render: (a) => formatMoney(a.amount_minor, a.currency) },
        {
            key: 'budget',
            header: 'Budget impact',
            render: (a) => {
                const live = a.budget_live;
                if (!live) return <span className="text-[12px] text-muted">{a.reason || '—'}</span>;
                return (
                    <div className="text-[12px] leading-relaxed">
                        <p className="font-medium text-ink">{live.label}</p>
                        <p className="text-muted">
                            Remaining {formatMoney(live.remaining_minor)} · short by <span className="font-medium text-rose-600">{formatMoney(live.shortfall_minor)}</span>
                        </p>
                        <p className="text-violet-700">
                            Approving revises {formatMoney(live.allocated_minor)} <ArrowRight className="inline h-3 w-3" /> {formatMoney(live.revised_allocated_minor)}
                        </p>
                    </div>
                );
            }
        },
        { key: 'requested_by_name', header: 'Requested by', render: (a) => <div><p>{a.requested_by_name}</p><p className="text-[11px] text-muted">{a.waiting_hours}h ago</p></div> },
        { key: 'awaiting', header: 'Waiting on', render: (a) => a.awaiting_role || '—' },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (a) =>
                a.can_act ? (
                    <div className="flex items-center justify-end gap-2">
                        <button type="button" className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-700 hover:text-emerald-800" onClick={() => setDeciding({ request: a, action: 'approve' })}>
                            <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button type="button" className="inline-flex items-center gap-1 text-[13px] font-medium text-rose-600 hover:text-rose-700" onClick={() => setDeciding({ request: a, action: 'reject' })}>
                            <X className="h-3.5 w-3.5" /> Reject
                        </button>
                    </div>
                ) : (
                    // A missing button with no explanation reads as a bug.
                    <p className="text-right text-[12px] text-muted">{a.blocked_reason || `Only ${a.awaiting_role ?? 'an approver'} can decide this`}</p>
                )
        }
    ];

    const decidedColumns: Column<Approval>[] = [
        { key: 'entity', header: 'Request', render: requestCell },
        { key: 'amount_minor', header: 'Order value', align: 'right', render: (a) => formatMoney(a.amount_minor, a.currency) },
        { key: 'status', header: 'Decision', render: (a) => <StatusPill status={a.status} /> },
        {
            key: 'revision',
            header: 'Budget revision',
            render: (a) =>
                a.budget_revision && a.budget_revision.delta_minor ? (
                    <div className="text-[12px]">
                        <p className="font-medium text-ink">{a.budget_revision.budget_label}</p>
                        <p className="text-violet-700">
                            {formatMoney(a.budget_revision.previous_allocated_minor)} <ArrowRight className="inline h-3 w-3" /> {formatMoney(a.budget_revision.new_allocated_minor)} (+{formatMoney(a.budget_revision.delta_minor)})
                        </p>
                    </div>
                ) : (
                    <span className="text-[12px] text-muted">—</span>
                )
        },
        { key: 'decided_by_name', header: 'Decided by', render: (a) => <div><p>{a.decided_by_name || '—'}</p><p className="text-[11px] text-muted">{formatDateTime(a.decided_at)}</p></div> },
        { key: 'decision_comments', header: 'Comments', render: (a) => <span className="text-[12px]">{a.decision_comments || '—'}</span> }
    ];

    const historyColumns: Column<Revision>[] = [
        { key: 'ts', header: 'When', render: (r) => <span className="text-[12px]">{formatDateTime(r.ts)}</span> },
        { key: 'budget_label', header: 'Budget', render: (r) => <span className="font-medium text-ink">{r.budget_label}</span> },
        { key: 'type', header: 'Change', render: (r) => <StatusPill status={r.type} className="whitespace-nowrap" /> },
        {
            key: 'amounts',
            header: 'Previous → revised',
            align: 'right',
            render: (r) => (
                <div className="text-[13px]">
                    <p>
                        {r.type === 'created' ? '—' : formatMoney(r.previous_allocated_minor, r.currency)} <ArrowRight className="inline h-3 w-3 text-muted" />{' '}
                        <span className="font-medium text-ink">{formatMoney(r.new_allocated_minor, r.currency)}</span>
                    </p>
                    <p className={`text-[11px] ${r.delta_minor >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {r.delta_minor >= 0 ? '+' : ''}
                        {formatMoney(r.delta_minor, r.currency)}
                    </p>
                </div>
            )
        },
        {
            key: 'details',
            header: 'Details',
            render: (r) => (
                <div className="max-w-[320px] text-[12px] leading-relaxed">
                    {r.reason && <p className="text-slate-700">{r.reason}</p>}
                    {r.po_number && (
                        <p className="text-muted">
                            <Link href={`/purchase-orders/${r.po_id}`} className="text-brand-700 hover:underline">{r.po_number}</Link>
                            {r.vendor_name ? ` · ${r.vendor_name}` : ''}
                            {r.requested_by_name ? ` · requested by ${r.requested_by_name}` : ''}
                        </p>
                    )}
                    {r.approved_by_name && (
                        <p className="text-violet-700">
                            Approved by {r.approved_by_name} {r.approved_at ? `on ${formatDateTime(r.approved_at)}` : ''}
                            {r.approval_comments ? ` - "${r.approval_comments}"` : ''}
                        </p>
                    )}
                </div>
            )
        },
        { key: 'actor_name', header: 'By', render: (r) => r.actor_name || '—' }
    ];

    return (
        <div>
            <PageHeader
                title="Budget & Approvals"
                subtitle="Purchases cannot exceed their budget. A Procurement Admin can approve an out-of-budget order; the budget is then revised and the change recorded."
                action={
                    tab === 'budgets' &&
                    can('BUDGET_CREATE') && (
                        <button type="button" className="btn-primary" onClick={() => setAllocating(true)}>
                            <Plus className="h-4 w-4" />
                            Allocate Budget
                        </button>
                    )
                }
            />

            <div className="mb-4">
                <Tabs
                    tabs={[
                        { value: 'budgets', label: 'Budgets', count: budgets.total },
                        { value: 'approvals', label: 'Pending approvals', count: pending.total },
                        { value: 'decided', label: 'Approval history' },
                        { value: 'history', label: 'Budget history' }
                    ]}
                    active={tab}
                    onChange={setTab}
                />
            </div>

            {tab === 'budgets' && (
                <>
                    <div className="mb-5 grid gap-4 sm:grid-cols-3">
                        <StatCard icon={PiggyBank} tone="violet" label="Total allocated" value={formatMoney(totals.allocated_minor)} />
                        <StatCard icon={TrendingDown} tone="amber" label="Committed & spent" value={formatMoney(totals.used_minor)} />
                        <StatCard icon={Wallet} tone="emerald" label="Remaining" value={formatMoney(totals.remaining_minor)} />
                    </div>
                    <FilterBar search={search} onSearch={setSearch} placeholder="Search category, subcategory or department..." />
                    <DataTable
                        columns={budgetColumns}
                        rows={budgets.rows}
                        rowKey={(b) => b.budget_id}
                        loading={budgets.loading}
                        error={budgets.error}
                        onRowClick={(b) => setHistoryFor(b)}
                        emptyTitle="No budgets allocated"
                        emptyHint="Allocate a budget per subcategory (or category / department) to stop purchases going over it."
                        page={budgets.page}
                        limit={budgets.limit}
                        total={budgets.total}
                        onPageChange={budgets.setPage}
                    />
                </>
            )}

            {tab === 'approvals' && (
                <DataTable
                    columns={pendingColumns}
                    rows={pending.rows}
                    rowKey={(a) => a.approval_request_id}
                    loading={pending.loading}
                    error={pending.error}
                    emptyTitle="Nothing waiting for approval"
                    emptyHint="Purchase orders that exceed their budget appear here for a Procurement Admin."
                    page={pending.page}
                    limit={pending.limit}
                    total={pending.total}
                    onPageChange={pending.setPage}
                />
            )}

            {tab === 'decided' && (
                <DataTable
                    columns={decidedColumns}
                    rows={decided.rows}
                    rowKey={(a) => a.approval_request_id}
                    loading={decided.loading}
                    error={decided.error}
                    emptyTitle="No decisions yet"
                    page={decided.page}
                    limit={decided.limit}
                    total={decided.total}
                    onPageChange={decided.setPage}
                />
            )}

            {tab === 'history' && (
                <>
                    <FilterBar search={search} onSearch={setSearch} placeholder="Search budget, PO, reason or person..." />
                    <DataTable
                        columns={historyColumns}
                        rows={history.rows}
                        rowKey={(r) => r.revision_id}
                        loading={history.loading}
                        error={history.error}
                        emptyTitle="No budget changes recorded yet"
                        page={history.page}
                        limit={history.limit}
                        total={history.total}
                        onPageChange={history.setPage}
                    />
                </>
            )}

            {allocating && (
                <AllocateModal
                    onClose={() => setAllocating(false)}
                    onDone={() => {
                        setAllocating(false);
                        budgets.reload();
                        history.reload();
                    }}
                />
            )}

            <Modal
                open={!!revising}
                onClose={() => setRevising(null)}
                title={`Revise ${revising?.label ?? 'budget'}`}
                description="Every revision is recorded in the budget history with your reason."
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setRevising(null)}>
                            Cancel
                        </button>
                        <SubmitButton form="revise-form" type="submit" busy={busy}>
                            Save revision
                        </SubmitButton>
                    </>
                }
            >
                {revising && (
                    <form
                        id="revise-form"
                        className="space-y-4"
                        onSubmit={async (e) => {
                            e.preventDefault();
                            const form = new FormData(e.currentTarget);
                            setBusy(true);
                            try {
                                await post('/procurement/budgets/update', { budget_id: revising.budget_id, allocated_amount: form.get('allocated_amount'), reason: form.get('reason') });
                                toast.success('Budget revised');
                                setRevising(null);
                                budgets.reload();
                                history.reload();
                            } catch (err: any) {
                                toast.error(err.message);
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 px-4 py-3 text-[13px]">
                            <div><p className="text-muted">Allocated</p><p className="font-medium text-ink">{formatMoney(revising.allocated_minor)}</p></div>
                            <div><p className="text-muted">Committed & spent</p><p className="font-medium text-ink">{formatMoney(revising.used_minor)}</p></div>
                            <div><p className="text-muted">Remaining</p><p className="font-medium text-ink">{formatMoney(revising.remaining_minor)}</p></div>
                        </div>
                        <Field label="New allocated amount" required hint="Cannot be lower than what is already committed or spent.">
                            <Input name="allocated_amount" inputMode="decimal" required defaultValue={(revising.allocated_minor / 100).toFixed(2)} />
                        </Field>
                        <Field label="Reason" required>
                            <Textarea name="reason" rows={2} required />
                        </Field>
                    </form>
                )}
            </Modal>

            {historyFor && <BudgetHistoryModal budget={historyFor} onClose={() => setHistoryFor(null)} />}

            <Modal
                open={!!deciding}
                onClose={() => setDeciding(null)}
                title={deciding?.action === 'approve' ? `Approve ${deciding?.request.entity_number ?? 'request'}?` : `Reject ${deciding?.request.entity_number ?? 'request'}?`}
                description={
                    deciding?.action === 'approve'
                        ? 'The order can then be sent to the vendor.'
                        : 'The purchase order will be cancelled.'
                }
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setDeciding(null)}>
                            Cancel
                        </button>
                        <SubmitButton form="decide-form" type="submit" busy={busy}>
                            {deciding?.action === 'approve' ? 'Approve' : 'Reject'}
                        </SubmitButton>
                    </>
                }
            >
                {deciding && (
                    <form
                        id="decide-form"
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            decide(new FormData(e.currentTarget));
                        }}
                    >
                        {deciding.action === 'approve' && deciding.request.budget_live && (
                            <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] text-violet-900">
                                <p className="font-medium">{deciding.request.budget_live.label}</p>
                                <p className="mt-1">
                                    Order value {formatMoney(deciding.request.amount_minor)} exceeds the remaining {formatMoney(deciding.request.budget_live.remaining_minor)} by{' '}
                                    {formatMoney(deciding.request.budget_live.shortfall_minor)}.
                                </p>
                                <p className="mt-1 font-medium">
                                    The budget will be revised from {formatMoney(deciding.request.budget_live.allocated_minor)} to {formatMoney(deciding.request.budget_live.revised_allocated_minor)}.
                                </p>
                            </div>
                        )}
                        <Field label="Comments" required={deciding.action === 'reject'} hint="Recorded in the budget history and the audit trail.">
                            <Textarea name="comments" rows={3} required={deciding.action === 'reject'} />
                        </Field>
                    </form>
                )}
            </Modal>
        </div>
    );
}

function AllocateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const toast = useToast();
    const [categoryId, setCategoryId] = useState('');
    const [busy, setBusy] = useState(false);
    const departments = useOptions('/procurement/masters/department/list', 'department_id');
    const categories = useOptions('/procurement/masters/category/list', 'category_id');
    const subcategories = useOptions('/procurement/masters/subcategory/list', 'subcategory_id', 'name', categoryId ? { category_id: categoryId } : null);

    async function submit(form: FormData) {
        setBusy(true);
        try {
            await post('/procurement/budgets/create', {
                department_id: form.get('department_id') || null,
                category_id: form.get('category_id') || null,
                subcategory_id: form.get('subcategory_id') || null,
                allocated_amount: form.get('allocated_amount'),
                period: form.get('period'),
                financial_year: form.get('financial_year') || undefined,
                reason: form.get('reason') || undefined
            });
            toast.success('Budget allocated');
            onDone();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Modal
            open
            onClose={onClose}
            title="Allocate budget"
            description="Set a budget for a subcategory, a whole category or a department. Purchases are checked against the most specific one."
            footer={
                <>
                    <button type="button" className="btn-ghost" onClick={onClose}>
                        Cancel
                    </button>
                    <SubmitButton form="budget-form" type="submit" busy={busy}>
                        Allocate
                    </SubmitButton>
                </>
            }
        >
            <form
                id="budget-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit(new FormData(e.currentTarget));
                }}
                className="grid gap-4 sm:grid-cols-2"
            >
                <Field label="Category">
                    <Select name="category_id" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={categories} placeholder="Select category" />
                </Field>
                <Field label="Subcategory" hint={categoryId ? undefined : 'Choose a category first'}>
                    <Select name="subcategory_id" options={subcategories} placeholder="Whole category" disabled={!categoryId} />
                </Field>
                <Field label="Department" hint="Optional - limit the budget to one department.">
                    <Select name="department_id" options={departments} placeholder="Any department" />
                </Field>
                <Field label="Allocated amount" required>
                    <Input name="allocated_amount" inputMode="decimal" required placeholder="0.00" />
                </Field>
                <Field label="Period">
                    <Select
                        name="period"
                        defaultValue="yearly"
                        options={[
                            { value: 'yearly', label: 'Yearly' },
                            { value: 'quarterly', label: 'Quarterly' },
                            { value: 'monthly', label: 'Monthly' }
                        ]}
                    />
                </Field>
                <Field label="Financial year" hint="Defaults to the current year, e.g. 2026-2027.">
                    <Input name="financial_year" placeholder="Current year" pattern="\d{4}-\d{4}" />
                </Field>
                <Field label="Notes" className="sm:col-span-2">
                    <Input name="reason" placeholder="Recorded as the reason for the initial allocation" />
                </Field>
            </form>
        </Modal>
    );
}

function BudgetHistoryModal({ budget, onClose }: { budget: Budget; onClose: () => void }) {
    const history = useList<Revision>('/procurement/budgets/history', { budget_id: budget.budget_id }, { limit: 50 });
    return (
        <Modal open onClose={onClose} size="lg" title={`History - ${budget.label}`} description={`FY ${budget.financial_year}`}>
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 px-4 py-3 text-[13px] sm:grid-cols-4">
                <div><p className="text-muted">Original</p><p className="font-medium text-ink">{formatMoney(budget.original_allocated_minor)}</p></div>
                <div><p className="text-muted">Current</p><p className="font-medium text-ink">{formatMoney(budget.allocated_minor)}</p></div>
                <div><p className="text-muted">Committed & spent</p><p className="font-medium text-ink">{formatMoney(budget.used_minor)}</p></div>
                <div><p className="text-muted">Remaining</p><p className="font-medium text-ink">{formatMoney(budget.remaining_minor)}</p></div>
            </div>
            {history.loading ? (
                <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
            ) : (
                <ol className="relative space-y-4 border-l border-line pl-5">
                    {history.rows.map((r) => (
                        <li key={r.revision_id} className="relative">
                            <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600 ring-1 ring-brand-200" />
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13px] font-medium text-ink">{TYPE_LABEL[r.type] || r.type}</span>
                                <span className="text-[12px] text-muted">{formatDateTime(r.ts)}{r.actor_name ? ` · ${r.actor_name}` : ''}</span>
                            </div>
                            <p className="mt-0.5 text-[13px]">
                                {r.type === 'created' ? '' : `${formatMoney(r.previous_allocated_minor)} → `}
                                <span className="font-medium text-ink">{formatMoney(r.new_allocated_minor)}</span>
                                {r.type !== 'created' && (
                                    <span className={r.delta_minor >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                                        {' '}({r.delta_minor >= 0 ? '+' : ''}{formatMoney(r.delta_minor)})
                                    </span>
                                )}
                            </p>
                            {r.reason && <p className="text-[12px] text-slate-600">{r.reason}</p>}
                            {r.po_number && (
                                <p className="text-[12px] text-muted">
                                    <Link href={`/purchase-orders/${r.po_id}`} className="text-brand-700 hover:underline">{r.po_number}</Link>
                                    {r.vendor_name ? ` · ${r.vendor_name}` : ''}
                                </p>
                            )}
                            {r.approved_by_name && (
                                <p className="text-[12px] text-violet-700">
                                    Approved by {r.approved_by_name}{r.approval_comments ? ` - "${r.approval_comments}"` : ''}
                                </p>
                            )}
                        </li>
                    ))}
                    {!history.rows.length && <p className="text-[13px] text-muted">No changes recorded.</p>}
                </ol>
            )}
        </Modal>
    );
}
