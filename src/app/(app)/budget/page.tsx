'use client';

import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Modal, { SubmitButton } from '@/components/ui/Modal';
import StatusPill from '@/components/ui/StatusPill';
import StatCard from '@/components/ui/StatCard';
import { Card, EmptyState } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useList, useOptions } from '@/lib/hooks';
import { formatMoney } from '@/lib/format';
import { PiggyBank, Wallet, TrendingDown } from 'lucide-react';

type Budget = {
    budget_id: string;
    department_name: string;
    financial_year: string;
    allocated_minor: number;
    used_minor: number;
    remaining_minor: number;
    utilisation_percent: number;
    is_exceeded: boolean;
};

type Approval = {
    approval_request_id: string;
    entity_type: string;
    entity_id: string;
    amount_minor: number;
    requested_by_name: string;
    reason: string | null;
    status: string;
    awaiting_role: string | null;
    can_act: boolean;
    waiting_hours: number;
    current_step: number;
    total_steps: number;
};

export default function BudgetPage() {
    const { can } = useAuth();
    const toast = useToast();
    const [tab, setTab] = useState('budgets');

    const departments = useOptions('/procurement/departments/list', 'department_id');
    const budgets = useList<Budget>('/procurement/budgets/list', {});
    const approvals = useList<Approval>('/procurement/approvals/list', { status: 'pending' });

    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const totals = budgets.meta?.totals ?? { allocated_minor: 0, used_minor: 0, remaining_minor: 0 };

    async function createBudget(form: FormData) {
        setBusy(true);
        try {
            await post('/procurement/budgets/create', {
                department_id: form.get('department_id'),
                category_id: form.get('category_id') || null,
                allocated_amount: form.get('allocated_amount'),
                period: form.get('period')
            });
            toast.success('Budget allocated');
            setOpen(false);
            budgets.reload();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function act(request: Approval, action: 'approve' | 'reject') {
        try {
            await post('/procurement/approvals/act', { approval_request_id: request.approval_request_id, action });
            toast.success(action === 'approve' ? 'Approved' : 'Rejected');
            approvals.reload();
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    const budgetColumns: Column<Budget>[] = [
        { key: 'department_name', header: 'Department', render: (b) => <span className="font-medium text-ink">{b.department_name}</span> },
        { key: 'financial_year', header: 'Financial year' },
        { key: 'allocated_minor', header: 'Allocated', align: 'right', render: (b) => formatMoney(b.allocated_minor) },
        { key: 'used_minor', header: 'Used', align: 'right', render: (b) => formatMoney(b.used_minor) },
        {
            key: 'remaining_minor',
            header: 'Remaining',
            align: 'right',
            render: (b) => (
                <span className={b.is_exceeded ? 'font-medium text-rose-600' : 'font-medium text-emerald-700'}>
                    {formatMoney(b.remaining_minor)}
                </span>
            )
        },
        {
            key: 'utilisation_percent',
            header: 'Utilisation',
            render: (b) => (
                <div className="min-w-[120px]">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                            className={`h-full rounded-full ${b.is_exceeded ? 'bg-rose-500' : b.utilisation_percent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(b.utilisation_percent, 100)}%` }}
                        />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{b.utilisation_percent}%</p>
                </div>
            )
        }
    ];

    const approvalColumns: Column<Approval>[] = [
        {
            key: 'entity',
            header: 'Request',
            render: (a) => (
                <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{a.entity_type.replace(/_/g, ' ')}</p>
                    <p className="truncate text-[12px] text-muted">{a.reason || '—'}</p>
                </div>
            )
        },
        { key: 'amount_minor', header: 'Amount', align: 'right', render: (a) => formatMoney(a.amount_minor) },
        { key: 'requested_by_name', header: 'Requested by' },
        {
            key: 'step',
            header: 'Stage',
            render: (a) => (
                <div>
                    <p className="text-[13px]">
                        Step {a.current_step} of {a.total_steps}
                    </p>
                    <p className="text-[11px] text-muted">{a.awaiting_role ? `Waiting on ${a.awaiting_role}` : '—'}</p>
                </div>
            )
        },
        { key: 'waiting_hours', header: 'Waiting', render: (a) => `${a.waiting_hours}h` },
        { key: 'status', header: 'Status', render: (a) => <StatusPill status={a.status} /> },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (a) =>
                a.can_act && a.status === 'pending' ? (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-700 hover:text-emerald-800"
                            onClick={() => act(a, 'approve')}
                        >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[13px] font-medium text-rose-600 hover:text-rose-700"
                            onClick={() => act(a, 'reject')}
                        >
                            <X className="h-3.5 w-3.5" />
                            Reject
                        </button>
                    </div>
                ) : null
        }
    ];

    return (
        <div>
            <PageHeader
                title="Budget & Approvals"
                subtitle="Purchase orders above the remaining budget need approval before they can be sent."
                action={
                    tab === 'budgets' &&
                    can('BUDGET_CREATE') && (
                        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
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
                        { value: 'approvals', label: 'Pending approvals', count: approvals.total }
                    ]}
                    active={tab}
                    onChange={setTab}
                />
            </div>

            {tab === 'budgets' ? (
                <>
                    <div className="mb-5 grid gap-4 sm:grid-cols-3">
                        <StatCard icon={PiggyBank} tone="violet" label="Total allocated" value={formatMoney(totals.allocated_minor)} />
                        <StatCard icon={TrendingDown} tone="amber" label="Used" value={formatMoney(totals.used_minor)} />
                        <StatCard icon={Wallet} tone="emerald" label="Remaining" value={formatMoney(totals.remaining_minor)} />
                    </div>

                    <DataTable
                        columns={budgetColumns}
                        rows={budgets.rows}
                        rowKey={(b) => b.budget_id}
                        loading={budgets.loading}
                        error={budgets.error}
                        emptyTitle="No budgets allocated"
                        emptyHint="Allocate a budget per department to track utilisation and trigger approvals."
                        page={budgets.page}
                        limit={budgets.limit}
                        total={budgets.total}
                        onPageChange={budgets.setPage}
                    />
                </>
            ) : (
                <DataTable
                    columns={approvalColumns}
                    rows={approvals.rows}
                    rowKey={(a) => a.approval_request_id}
                    loading={approvals.loading}
                    error={approvals.error}
                    emptyTitle="Nothing waiting on you"
                    emptyHint="Requests that exceed budget appear here for approval."
                    page={approvals.page}
                    limit={approvals.limit}
                    total={approvals.total}
                    onPageChange={approvals.setPage}
                />
            )}

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="Allocate budget"
                footer={
                    <>
                        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
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
                        createBudget(new FormData(e.currentTarget));
                    }}
                    className="space-y-4"
                >
                    <Field label="Department" required>
                        <Select name="department_id" options={departments} placeholder="Select department" required />
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
                </form>
            </Modal>
        </div>
    );
}
